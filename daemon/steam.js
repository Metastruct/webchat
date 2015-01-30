module.exports = function(hooks,CFG){

	var fs = require('fs');
	var Steam = require('steam');

	var keyfile = 'sentry.key';
	var steamGuard = require('fs').existsSync(keyfile) ? require('fs').readFileSync(keyfile) : undefined;
	var sendmsgs=false;

	// if we've saved a server list, use it
	if (fs.existsSync('servers')) {
	  Steam.servers = JSON.parse(fs.readFileSync('servers'));
	}

	var bot = new Steam.SteamClient();
	bot.logOn({
	  accountName: CFG.steam_account,
	  password: CFG.steam_pw
	  //,authCode: 'asd'
	  ,shaSentryfile: steamGuard
	});


	bot.on('sentry', function(sentryHash) {
		/**/console.log('Saving sentry file hash');
		require('fs').writeFile(keyfile,sentryHash,function(err) {
			if(err){
				/**/console.log(err);
			} else {
				/**/console.log('Saved sentry');
			}
		});
	});


	bot.on('loggedOn', function() {
	  console.log('Logged in!');
	  bot.setPersonaState(Steam.EPersonaState.Online); // to display your bot's status as "Online"
	  bot.setPersonaName(CFG.steam_display_name); // to change its nickname
	  bot.joinChat(CFG.chatroom); // the group's SteamID as a string
	});

	bot.on('servers', function(servers) {
	  fs.writeFile('servers', JSON.stringify(servers));
	});

	bot.on('chatInvite', function(chatRoomID, chatRoomName, patronID) {
	  console.log('Got an invite to ' + chatRoomName + ' from ' + bot.users[patronID].playerName);
	  //bot.joinChat(chatRoomID); // autojoin on invite
	});

	bot.on('message', function(source, message, type, chatter) {
	  // respond to both chat room and private messages
	  //console.log('Received message: ' + message);
	  if (message == 'on') {
		sendmsgs=true;
	  } 
	  if (message == 'off') {
		sendmsgs=false;
	  }
	});

	bot.on('chatStateChange', function(stateChange, chatterActedOn, steamIdChat, chatterActedBy) {
	  if (stateChange == Steam.EChatMemberStateChange.Kicked && chatterActedOn == bot.steamID) {
		//bot.joinChat(steamIdChat);  // autorejoin!
	  }
	});

	bot.on('announcement', function(group, headline) { 
	  console.log('Group with SteamID ' + group + ' has posted ' + headline);
	});


	var util = require('util');

	function OnMessage( msg, info, name ) {
		if (typeof msg == 'string' || msg instanceof String)
		{
			if (bot.loggedOn && sendmsgs) {
				bot.sendMessage(CFG.chatroom, name+": "+msg);
			}
		}
	};
	
	hooks.on('message',function(msg,info,name){
		try {
			OnMessage(msg,info,name);
		} catch (err) { 
			console.log("[Twitter] msg error: "+util.inspect(err));
		}
	});
};