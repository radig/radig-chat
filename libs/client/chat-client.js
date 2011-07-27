var config = {
	host: '127.0.0.1',
	channel: 'chat',
	port: 8060,
};

var contact = {
	id: null,
	name: 'Teste 1'
};

var ChatSessions = {};

function countChats() {
	i = 0;
	
	for(a in ChatSessions)
		i++;
	
	return i;
}

Socket = io.connect( config.host + '/' + config.channel, {port: config.port, 'connect timout': 2000} );

Socket.on('connect', function () {
	contact.id = 'ss_' + authKey;
	
	if(authKey == 'ftmblhc4rucagguasdk900pkl0hsjpqj')
	{
		Socket.emit('identification', contact);
		
		// para teste
		Socket.emit('chat request', {id: "ss_10397o7khrci7q9dppvqrh26jgtsli9v", name: "Teste 2"});
	}
	else if(authKey == 'fne883fijucu5lnbjargt61rnb26sk6p')
	{
		contact.name = 'Teste 3';
		
		Socket.emit('identification', contact);
		
		Socket.emit('chat request', {id: "ss_10397o7khrci7q9dppvqrh26jgtsli9v", name: "Teste 2"});
	}
	else
	{
		contact.name = 'Teste 2';
		
		Socket.emit('identification', contact);
	}
	
	console.log('conectado ao servidor');
});

Socket.on('new chat id', function(cid) {
	ChatSessions[cid] = {participants: []};
	
	console.log('chat n: ' + cid);
});

Socket.on('open chat', function(cid, contacts) {
	console.log('abrir chat ' + cid);
	winTitle = "";
	
	for(i in contacts) {
		ChatSessions[cid].participants.push(contacts[i]);
		
		if(contact.id != contacts[i].id)
			winTitle += contacts[i].name + " ";
	}
	
	$('body').append('<div id="chat_' + cid + '"></div>');
	
	$("#chat_" + cid).chatbox({
		id : "chat_" + cid,
		title : winTitle,
		width : 250,
		offset: (250 + 20) * (countChats() - 1),
		messageSent: function(id, author, msg) {
			sendMessage(cid, msg);
			this.boxManager.addMsg(contact.name, msg);
    	},
    	boxClosed: function(id) {
    		
    	}
	});
});

Socket.on('user message', function(cid, msg) {
	$("#chat_" + cid).chatbox("option", "boxManager").addMsg(msg.from, msg.content);
});

Socket.on('remove participant', function(cid, participant) {
	for(i in ChatSessions[cid].participants) {
		if(ChatSessions[cid].participants[i] == participant) {
			delete ChatSessions[cid].participants[i];
		}
	}
});

function sendMessage(cid, message) {
	Socket.emit('chat message', cid, message);
};