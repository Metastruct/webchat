

var fs = require('fs');

module.exports = function(hooks,CFG){

	var util = require('util');
	
	var Pusher = require('pusher');
	var sending = true;
	
	var pusher = new Pusher(CFG.pusher);

	function Now() {
		return Math.round((new Date()).getTime() / 1000);
	};


	function PushMsg(msg,pl,name) {
		var dat = [msg,name]
		
		pusher.trigger('c', 'c', {
		  "message": dat
		});
	};

	function OnMessage( msg ,info,name ) {
		if (typeof msg == 'string' || msg instanceof String)
		{
			PushMsg( msg,info,name );
		}
	};
	function OnWebhook( dat ) {
		if (!dat.time_ms) return;
		if (!dat.events) return;
		dat.events.forEach(function(event) {
			var name = event.name;
			var channel = event.channel;
			if (channel == "c"){
				if (name=="channel_vacated") 
				{
					console.log("[pusher] stopping sending");
					sending=false;
				}
				else if (name=="channel_occupied") 
				{
					console.log("[pusher] sending");
					sending=true;
				}
				else
				{
					console.log("[pusher] wat: "+name);
				}
			}
		});
	};
	
	hooks.on('message',function(msg,info,name){
		try {
			OnMessage(msg,info,name);
		} catch (err) { 
			console.log("[puhser] msg error: "+util.inspect(err));
		}
	});
	hooks.on('authdata',function(msg){
		try {
			OnWebhook(msg);
		} catch (err) { 
			console.log("[pusher] msg error: "+util.inspect(err));
		}
	});
}