function textToLink(text) {
    var exp = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    return text.replace(exp, '<a href="$1" target="_blank">$1</a>'); 
}

function escapeEntities(text) {
    return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

var token = window.location.hash.substring(1);
if ( typeof io == 'undefined' )
{
	var div = $('<div>IO LIBRARY NOT LOADED. SERVER BROKEN!</div>');
	$("#chat").prepend(div.fadeIn(200));

} 

if (token)
    var socket = io.connect('http://arsenic.iriz.uk.to:9080');
else
    window.location = "http://metastruct.org/webchat";

socket.on('connect', function() {
    socket.emit('token', token);
    
    socket.on('invalidtoken', function() {
        window.location = "http://metastruct.org/webchat";
    });
    
    socket.on('ready', function() {
        $("#chat").prepend('<div><p>Connected!</p></div>');
        
        socket.on('chat', function(data) {
            var div = $('<div></div>');
            
            div.append('<span class="time">' + new Date().format('HH:MM:ss') + ' | #' + ((data.server) ? data.server : 'WEB') + '</span>');
            
            var p = $('<p class="message"></p>');
            
            if (data.steamid)
                p.append('<a href="http://steamcommunity.com/profiles/' + data.steamid + '" target="_blank">' + escapeEntities(data.name) + '</a>: ');
            else
                p.append(escapeEntities(data.name) + ': ');
            
            p.append(textToLink(escapeEntities(data.message)));
            
            div.append(p);

            $('#chat div:nth-child(20)').remove();
            $("#chat").prepend(div.fadeIn(200));
        });
        
        socket.on('join', function(data) {
            var div = $('<div></div>');
            
            div.append('<span class="time">' + new Date().format('HH:MM:ss') + ' | #' + ((data.server) ? data.server : 'WEB') + '</span>');
            
            if (data.steamid)
                div.append('<p class="join"><a href="http://steamcommunity.com/profiles/' + data.steamid + '" target="_blank">' + escapeEntities(data.name) + '</a> joined the server</p>');
            else
                div.append('<p class="join">' + escapeEntities(data.name) + ' joined the server</p>');
            
            $('#chat div:nth-child(20)').remove();
            
            $("#chat").prepend(div.fadeIn(200));
        });
        
        socket.on('leave', function(data) {
            var div = $('<div></div>');
            
            div.append('<span class="time">' + new Date().format('HH:MM:ss') + ' | #' + ((data.server) ? data.server : 'WEB') + '</span>');
            
            if (data.steamid)
                div.append('<p class="leave"><a href="http://steamcommunity.com/profiles/' + data.steamid + '" target="_blank">' + escapeEntities(data.name) + '</a> left the server</p>');
            else
                div.append('<p class="leave">' + escapeEntities(data.name) + ' left the server</p>');
            
            $('#chat div:nth-child(20)').remove();
            $("#chat").prepend(div.fadeIn(200));
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