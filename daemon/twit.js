
var fs = require('fs');

module.exports = function(hooks,CFG){

	var util = require('util'),
		twitter = require('twitter');
	var twit = new twitter({
		consumer_key: CFG.consumer_key,
		consumer_secret: CFG.consumer_secret,
		access_token_key: CFG.access_token_key,
		access_token_secret: CFG.access_token_secret
	});

	function Now() {
		return Math.round((new Date()).getTime() / 1000);
	};

	var LastTweet = 0;

	function CanTweet() {
		if (LastTweet<1) {
			var lasttwit = require("./lasttwit.json");
			LastTweet = lasttwit.LastTweet;
		}
		
		if (LastTweet<1) return false;
		
		var day = 60*60*(24+1);
		
		return Now() - LastTweet > day;

	};

	function PreTweet( msg ) {
		LastTweet = Now();
		fs.writeFile( "lasttwit.json", JSON.stringify( { LastTweet: LastTweet, tweet: msg } ), "utf8", function() {} );
	};

	function DoTweet( msg ) {
		if (!CanTweet()) return;
		PreTweet( msg );
		
		twit.updateStatus( msg,
			function(data) {
				console.log("[Twitter] updateStatus: "+util.inspect(data));
			}
		);

	};

	function Tweetable(msg) {
		if (msg.length>139) return false;
		if (msg.length<5) return false;
		if (msg.search("^[!\\.\\\\/]") == 0 ) return false; 
		if (msg.search("[a-zA-Z]") == -1 ) return false; 
		if (msg.indexOf("http://")>=0) return false;
		if (msg.indexOf("https://")>=0) return false;
		if (msg.indexOf(" ")==-1) return false;
		
		return true;
	};

	function OnMessage( msg ) {
		if (CanTweet() && // should we tweet this one
			(typeof msg == 'string' || msg instanceof String) &&
			Tweetable( msg )) // is it something we want to tweet?
		{
			DoTweet( msg );
		}
	};
	
	hooks.on('message',function(msg,info){
		try {
			OnMessage(msg);
		} catch (err) { 
			console.log("[Twitter] msg error: "+util.inspect(err));
		}
	});
}