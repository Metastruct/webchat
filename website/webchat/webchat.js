var chaturl = "http://metastruct.org/webchat";
var chatserv = 'http://arsenic.iriz.uk.to:9080';

function textToLink(text) {
    var exp = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    return text.replace(exp, '<a href="$1" target="_blank">$1</a>'); 
}

function escapeEntities(text) {
    return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function NewMessage() {
	var container = $('<tr />');
	var ServerBox = $('<td />');
	var NickBox = $('<td />');
	var MessageBox = $('<td />');
	var TimeBox = $('<td />');
	TimeBox.text( new Date().format('HH:MM:ss') );
	container.append(ServerBox);
	container.append(NickBox);
	container.append(MessageBox);
	container.append(TimeBox);
	$("#chat").prepend(container.fadeIn(200));
	$('#chat tr:nth-child(1000)').remove();
	return {srv:ServerBox,nick:NickBox,msg:MessageBox,time:TimeBox};
}

function PrintInfo(message) {
	var c = NewMessage();
	c.time.text( new Date().format('HH:MM:ss') );
	c.msg.text(message);
	c.nick.text("<SYSTEM>");
}

PrintInfo("Connecting to server...");

var token = window.location.hash.substring(1);
if ( typeof io == 'undefined' )
{
	PrintInfo("IO LIBRARY NOT LOADED. SERVER BROKEN!");
} 

if (token)
    var socket = io.connect(chatserv);
else
    window.location = chaturl;

	


socket.on('connect', function() {
    socket.emit('token', token);
    
    socket.on('invalidtoken', function() {
        window.location = chaturl+"?nocache="+Math.floor((Math.random()*10000000)+1);;
    });
    
    socket.on('ready', function() {
        PrintInfo("Connected!");
        
        socket.on('chat', function(data) {
			var c = NewMessage();
			
			c.msg.text(data.message);
			c.srv.text('#' + ((data.server) ? data.server : 'WEB'));
			
            if (data.steamid) {
				$('<a>',{	text: data.name,
							target: "_blank",
							href: 'http://steamcommunity.com/profiles/' + data.steamid,
						}).appendTo(c.nick);
            } else {
				c.nick.text(data.name);
			}
			
            c.msg.html(textToLink(escapeEntities(data.message)));
            
        });
        
        socket.on('join', function(data) {
			var c = NewMessage();
			
			c.msg.text("Joined the server!");
			c.msg.addClass('join');
			c.srv.text('#' + ((data.server) ? data.server : 'WEB'));
			
            if (data.steamid) {
				$('<a>',{	text: data.name,
							target: "_blank",
							href: 'http://steamcommunity.com/profiles/' + data.steamid,
						}).appendTo(c.nick);
            } else {
				c.nick.text(data.name);
			}
			
        });
        
        socket.on('leave', function(data) {
			var c = NewMessage();
			
			c.msg.text("Left the server!");
			c.msg.addClass('leave');
			c.srv.text('#' + ((data.server) ? data.server : 'WEB'));
			
            if (data.steamid) {
				$('<a>',{	text: data.name,
							target: "_blank",
							href: 'http://steamcommunity.com/profiles/' + data.steamid,
						}).appendTo(c.nick);
            } else {
				c.nick.text(data.name);
			}
        });
        
        $('form').submit(function(e) {
            e.preventDefault();
            if ($('#chattext').val().trim() == "") return;
            socket.emit('message', $('#chattext').val());
            $('#chattext').val('');
        });
        
        $("input[type=checkbox]").change(function() {
            if ($(this).checked)
                socket.emit('join', parseInt($(this).data("server")));
            else
                socket.emit('leave', parseInt($(this).data("server")));
        });
    });
});