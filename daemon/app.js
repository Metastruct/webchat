require('buffertools').extend();

const crypto = require('crypto'),
  fs = require("fs");
  
var util = require("util");
var assert = require("assert");
var npid = require('npid');
var https = require('https');
var express = require('express');

try {
    var pid = npid.create('webchat.pid',true);
    pid.removeOnExit();
} catch (err) {
    console.log(err);
    process.exit(1);
}


var CFG=require('./config.json');

var plugins = CFG.plugins;

var events = require('events');
var hooks = new events.EventEmitter();

if (plugins) {
	for (var i=0; i<plugins.length; i++) {
		require(plugins[i])(hooks,CFG);
	}
}


var AUTHPORT = CFG.AUTHPORT;
var WEBPORT = CFG.WEBPORT;
var GAMEPORT = CFG.GAMEPORT;
var TEAM_WEBCHAT = CFG.TEAM_WEBCHAT || 1;
var WHITELIST = CFG.WHITELIST;
var AUTHSERVER = CFG.AUTHSERVER;
//------

var net = require('net');
var express = require('express');
var cors = require('cors');

var privateKey  = fs.readFileSync('key.pem', 'utf8');  
var certificate = fs.readFileSync('cert.pem', 'utf8');
var credentials = {key: privateKey, cert: certificate};

var app = express();
var httpsServer = https.createServer(credentials, app);
var srv = httpsServer.listen(WEBPORT);


var corsOptions = {
  origin: 'https://www3.metastruct.net'
};
 
app.options('*', cors(corsOptions)); 

var io = require('socket.io')(srv);

io.set( 'origins', '*www3.metastruct.net*:*' );

var servers = {}; //sockets of game servers that are currently connected
var tokens = {}; //valid user tokens
var clients = {}; //authed web users
var socketdata = {};

var lockdown = false;
var current_userid = 0; //unique id for each web user (some steamids/tokens may not be unique to 1 user)

var nullbyte = Buffer.from('\0');

net.Socket.prototype.SendTable = function(data) {
    try {
        var msg = JSON.stringify(data);
        var buf = new Buffer.from(msg+'\0');
        this.write(buf);
    } catch (e) {
        console.log("[GAME] ERROR: Couldn't send table: " + e);
    }
};

//---AUTH SERVER---

console.log('[AUTH] Listening on port ' + AUTHPORT);

net.createServer(function(sock) {
    sock.setTimeout(5000, function() { sock.destroy(); });
    
    if ((sock.remoteAddress || sock._remoteAddress) != AUTHSERVER) {
        console.log('[AUTH] Rejected connection from ' + (sock.remoteAddress || sock._remoteAddress));
        sock.destroy();
        return;
    }
	
 	sock.on('error', function(err) {
		console.log('[AUTH] Error: ' + err);
	});
	
    sock.on('data', function(data) {
        try {
            var json = JSON.parse(data);
			
			
			
            //token, steamid, name
            if (!json[3] && json[0] && json[1] && json[2]) {
				var steamid = json[1];
                tokens[json[0]] = { steamid: steamid, name: json[2] };
                console.log('[AUTH] Added '+steamid);
            } else {
				hooks.emit('authdata',json);
			}
        } catch(e) {
            console.log('[AUTH] Invalid auth info from ' + (sock.remoteAddress || sock._remoteAddress)+': '+e);
            sock.destroy();
        }
    });
}).listen(AUTHPORT, "0.0.0.0");

//---WEB SERVER---


function sendToServers(socketid, data) {
    for (var s in servers) {
        var srv = servers[s];
		
		if (srv && srv.socket) {
			srv.socket.SendTable(data);
		} else {
			console.log('[WEB] Unable to send to "'+srv+'", server down?');
		}
    }
}

//setTimeout(function(){
//    for (var s in servers) {
//        var srv = servers[s];
//		
//		console.log('[info] Connected to '+srv+' '+s);
//		
//    }
//},5000);

// webchat client disconnects
function onDisconnect(socket,UserID) {
	var clientdata = clients[UserID];
	
	assert(clientdata,"the hell!?");
	
	var steamid = clientdata.steamid;
	var name = clientdata.name;
	console.log('[WEB] ' + name + ' ('+steamid+') disconnected (uid '+UserID+')');
	
	sendToServers(socket.id, [ 'leave', UserID, steamid ]);
	socket.broadcast.emit('leave', { name: name, steamid: steamid });
		
	delete clients[UserID];
	
}

function GETIP(client ) { return client.request.headers['x-forwarded-for'] || client.request.headers['X-forwarded-for'] || client.request.connection.remoteAddress;};

// webchat connect
io.sockets.on('connection', function(socket) {
	if (lockdown) {
		socket.disconnect();
		return;
	};
    var tokentimeout = setTimeout(function() {
        if (typeof socket.handshake === "undefined") {
			return;
        } else {
            console.log('[WEB] ' + GETIP(socket) + ' timed out before auth');
			socket.disconnect();
		}
    }, 7000); //if they haven't sent a token in 5 secs d/c them
    	
    socket.on('token', function(token) {
        var UserID = false;
		var tokendata = token && token.trim() != "" && tokens[token];
		var clientdata={};
		if (tokendata) {

			for (client in clients) {
				var dat = clients[client];
				if ( dat.steamid == tokendata.steamid ) {
					socket.disconnect();
					return;
				}
			}
		
			delete tokens[token];
            clearTimeout(tokentimeout);
            
			// TODO: steamid usercount check
			// something else ???
			
			current_userid++;
            UserID = current_userid;
			var clientdata = {};
			clientdata.userid = UserID;
			clientdata.UserID = UserID;
			clientdata.name = tokendata.name; 
			clientdata.steamid = tokendata.steamid;
			clientdata.socket = socket;
			

			clients[UserID] = clientdata;
			
			
            socket.emit('ready');
        } else {
			
			console.log('[WEB] Invalid token from ' + GETIP(socket) );
            socket.emit('invalidtoken');
            socket.disconnect();
            return;
        }


		var steamid = clients[UserID].steamid;
		var name = clients[UserID].name;

		console.log('[WEB] ' + name + ' ('+steamid+') connected (userid ' + UserID+').');

		
		sendToServers(socket.id, [ 'join', UserID, steamid, name, TEAM_WEBCHAT ]); 
		socket.broadcast.emit('join', { name: clients[UserID].name, steamid: clients[UserID].steamid });
		
		socket.on('message', function(message) {
			if (message.trim() == "") {
				return;
			}
			//console.log('[WEB] ' + name + ' (' + socket.handshake.address.address + '): ' + message);
			var name = clients[UserID].name;
			
			hooks.emit('message',message,clients[UserID],name);
			sendToServers(socket.id, [ 'say', UserID, message ]);
			
			io.sockets.emit('chat', { name: name, steamid: steamid, message: message });
		});

		socket.on('disconnect', function() {
			onDisconnect(socket,UserID);
		});
    });
        
});

hooks.on('sendToServers',function(msg,sender){
	console.log("AddonMsg");
	sendToServers(0,msg);
})

//---GAME SERVER---

console.log('[GAME] Listening on port ' + GAMEPORT);


function ParseReceivedData(sock,data) {
	var sendtype = data[0];

	switch (sendtype) {
		case 'hello':
			var ID = String(data[1]);
			var serverpw = String(data[2]);
			
			if ( (!sock.ourconn) && (serverpw != CFG.SHARED_SECRET) ) {
				console.log('[GAME] Invalid hello password from ' + (sock.remoteAddress || sock._remoteAddress) + ': '+serverpw);
				sock.destroy();
				return;
			}
			
			clearTimeout(sock.logintimeout);
			sock.socket = sock;
			sock.ID = ID;
			
			if (servers[sock.ID] && servers[sock.ID].socket) {
				servers[sock.ID].socket.destroy();
			}
			sock.tried = false;
			servers[sock.ID] = { socket: sock, users: {} };
			

			var count = 0;
			for (client in clients) count++;
			
			if (!sock.ourconn) {
				sock.SendTable([ 'hello', 0, CFG.SHARED_SECRET ]);
			}
			
			sock.SendTable([ 'players', count ]);
			
			for (client in clients) {
				var dat = clients[client];
				sock.SendTable([ 'join', dat.userid, dat.steamid, dat.name, TEAM_WEBCHAT ]);
			}
			
			sock.SendTable([ 'endburst' ]);
			
			console.log('[GAME] ' + (sock.remoteAddress || sock._remoteAddress) + ' identified as server ' + sock.ID);
			break;
		
		case 'players':
			break;
		
		case 'endburst':
			sock.endburst = true;
			break;
			
		case 'say':
			if (!sock.ID) {
				break; 
			}
			var UserID = data[1];
			var txt = data[2];
			var usr = servers[sock.ID].users[UserID];
			if (usr) {
				var Name = usr.Name || "PLAYER MISSING??";
				
				//console.log('[GAME] ' + Name + ': ' + txt);
				
				hooks.emit('message',txt,usr,Name);
				
				var dat = { server: parseInt(sock.ID), name: Name, steamid: usr.SteamID, message: txt };
				
				io.sockets.emit('chat', dat);
			} else {
				console.trace('PROTOCOL VIOLATION: Server #'+sock.ID+' sent say event for UserID ' + UserID + ', but that userid does not exist!?');
			}
		
			break;
			
		case 'join':
			if (!sock.ID) { break; }
			var UserID = data[1];
			var SteamID = data[2];
			var Name = data[3];
			
			servers[sock.ID].users[UserID] = { SteamID: SteamID, Name: Name };
			//console.log('#'+sock.ID+' ' + Name + ' joined (' + SteamID+ ')');
			io.sockets.emit('join', { server: parseInt(sock.ID), name: Name, steamid: SteamID });
			break;
			
		case 'lockdown':
			if (!sock.ID) { break; }
			lockdown = data[1];
		case 'leave':
			if (!sock.ID) { break; }
			var UserID = data[1];
			var SteamID = data[2];
			var usr = servers[sock.ID].users[UserID];
			if (usr) {
				var Name = usr.Name || "PLAYER MISSING??";
			
				//console.log('#'+sock.ID+' ' + Name + ' left (' + SteamID+ ')');
				io.sockets.emit('leave', { server: parseInt(sock.ID), name: Name, steamid: SteamID });
				delete servers[sock.ID].users[UserID];
			} else {
				console.trace('PROTOCOL VIOLATION: Server #'+sock.ID+' sent leave event for UserID ' + UserID + ', but that userid does not exist!?');
			}
			break;
		
		case 'partyline':
			var msg = data[1];
			console.log('[PARTYLINE #'+sock.ID+'] ' + msg);
			break;
		case 'ctime':
			var msg = data[1];
			console.log('[Time Query Response] Uptime: '+msg);
			break;
		case 'ctimeq':
			console.log('[Time Query] Sending...');
			sock.SendTable([ 'ctime', Math.floor(process.uptime())]);
			break;
		case 'eval':
			if (!sock.ID) {
				break; 
			}
			var id = data[1];
			var code = data[2];
			console.log('[WRANING] Evaling code from '+sock.ID+': '+code+'.');
			var ok = false;
			var retval = "?";
			try {
				retval = "compile";
				var fn = new Function(code);
				retval = fn(sock,app,hooks);
				ok = true;
			} catch (e) {
				retval=e.message;
				ok = false;
			}
			sock.SendTable([ 'evaled', id, ok, retval]);
			break;
		case 'evalsb':
			if (!sock.ID) {
				break; 
			}
			var Sandbox = require("sandbox") , s = new Sandbox();
			
			var id = data[1];
			var code = data[2];
			console.log('Evaling code from '+sock.ID+'.');
			s.run( code, function( output ) {
				sock.SendTable([ 'evalsb_ret', id, output]);			  
			});
			break;
		case 'oob':
			var msg = data[1];
			console.log('[OOB] ' + msg);
			break;
		case 'blacklist':
			var sid = data[1];
			console.log('[BAN] Banning ' + sid);
			//TODO: Blacklist(sid);
			break;
		default:
			hooks.emit('sendtype',data,sock);
			break;
	}
}

function serverfunc(sock) {
    if (!sock.ourconn) {
		console.log('[GAME] Received connection from ' + (sock.remoteAddress || sock._remoteAddress) + ':' + (sock.remotePort || sock._remotePort));
    }
	
	sock.on('error', function(err) {
		console.log('[GAME] Error: ' + err);
	});
	
	if ((sock.remoteAddress || sock._remoteAddress) !== undefined && WHITELIST.indexOf((sock.remoteAddress || sock._remoteAddress)) == -1) {
        //console.log('[GAME] Non-whitelisted connection from ' + (sock.remoteAddress || sock._remoteAddress));
        //sock.destroy();
        //return;
    }
    
    
    var logintimeout = setTimeout(function() { sock.destroy(); }, 5000);
    sock.logintimeout=logintimeout;
    sock.endburst = false;
    var databuff = false;
    
    sock.on('data', function(chunk) {
        if (databuff)
            databuff = databuff.concat(chunk);
        else
            databuff = chunk;
        
        // Process each complete message
        while (databuff && databuff.length > 0) {
            var pos = databuff.indexOf(nullbyte);
            if (pos < 0) {
                console.log('[GAME] Data did not contain zero byte');
                break;
            }
            
            var msg = databuff.toString('utf8', 0, pos);
            
            if (pos + 1 < databuff.length)
                databuff = databuff.slice(pos + 1);
            else
                databuff = false;
            
            var data;
            
            try {
                data = JSON.parse(msg);
            } catch (e) {
                console.log('[GAME] Received invalid data from ' + (sock.remoteAddress || sock._remoteAddress) + ' (' + e + '): \'' + msg + '\'');
                sock.destroy();
                return;
            }
            try {
				ParseReceivedData(sock,data);
			} catch(error) {
				console.log("[GAME] ParseReceivedData: " + error);
				console.log(error.stack);
				server_sock_disconn(sock);
			}
        }
    });
    function server_sock_disconn(sock) {
		if (servers[sock.ID]) {
            delete servers[sock.ID];
		} else {
			console.log('[GAME] Deleting non-existent #'+sock.ID);
		};
		
        console.log('[GAME] ' + (sock.remoteAddress || sock._remoteAddress) + ' disconnected!');
		
		if (sock.ourconn) {
			if (sock.tried) {
				console.log('[GAME] 	Cancelling reconnect to server #'+sock.ID+"!");
			} else {
				console.log('[GAME] 	Reconnecting to server #'+sock.ID+"...");
				link_server(sock.serverinfo,true);
			}
		}
	}
	
    sock.on('end', function() {
        server_sock_disconn(sock);
    });
    sock.on('close', function() {
        server_sock_disconn(sock);
    });
	
    sock.on('connect', function() {
		
		if (sock.ourconn) {
			console.log('[GAME] We Connected, helloing ' + ((sock.remoteAddress || sock._remoteAddress) || sock._remoteAddress));
			sock.SendTable([ 'hello', 0, CFG.SHARED_SECRET ]);
		} else {
			console.log('[GAME] Got connection from ' + ((sock.remoteAddress || sock._remoteAddress) || sock._remoteAddress));
		}
    });
	
}
net.createServer(serverfunc).listen(GAMEPORT, "0.0.0.0");



function link_server(serverinfo,tried) {
	var host = serverinfo[0];
	
	if (host == undefined) {
		return; 
	}
	
	var port = serverinfo[2];
	var ID 	 = serverinfo[3];
	console.log('[GAME] Connecting to server #'+ID +' on '+ host +':'+ port);
    var client = net.createConnection(port,host);
	client._remoteAddress = host;
	client._remotePort = port;
	client.ourconn = true;
	client.ID = ID;
	client.serverinfo = serverinfo;
	client.tried = tried;
	serverfunc(client);
};

// webchat remains always linked even with no players
for (var i=0; i<CFG.servers.length; i++) {
	link_server(CFG.servers[i],false);
}
