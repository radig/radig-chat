var config = {
	host: '127.0.0.1',
	channel: 'chat',
	port: 8060,
};

var contact = {
	id: null,
	name: ''
};

var ChatSessions = {};

var ContactList = {};

function countChats() {
	i = 0;
	
	for(a in ChatSessions)
		i++;
	
	return i;
}

Socket = io.connect( config.host + '/' + config.channel, {port: config.port, 'connect timout': 2000} );

Socket.on('contact-list join', function(contact) {
	addContact(contact);
});

Socket.on('contact-list quit', function(contact) {
	removeContact(contact);
});

Socket.on('connect', function () {
	contact.id = authKey;
	
	Socket.emit('identification', contact);
});

Socket.on('new chat id', function(cid) {
	ChatSessions[cid] = {participants: []};
});

Socket.on('open chat', function(cid, contacts) {
	winTitle = "";
	
	for(i in contacts) {
		ChatSessions[cid].participants.push(contacts[i]);
		
		if(contact.id != contacts[i].id)
			winTitle += contacts[i].name + " ";
	}
	
	addChatBox(cid, winTitle);
});

Socket.on('user message', function(cid, msg) {
	$("#chat_" + cid).chatbox("option", "boxManager").addMsg(msg.from, msg.content);
});

function sendMessage(cid, message) {
	Socket.emit('chat message', cid, message);
};

function addChatBox(id, title) {
	$('body').append('<div id="chat_' + id + '"></div>');
	
	$("#chat_" + id).chatbox({
		id : "chat_" + id,
		title : title,
		width : 250,
		offset: (250 + 20) * (countChats() - 1),
		messageSent: function(id, author, msg) {
			sendMessage(id, msg);
			this.boxManager.addMsg(contact.name, msg);
    	},
    	boxClosed: function(id) {
    		
    	}
	});
}

function addContact(contact) {
	
	ContactList[contact.id] = contact;
	
	$('body').append('<a href="#' + contact.id + '" class="chat-contact">' + contact.name + '</a>');
	bt = $('a[href=#' + contact.id + ']');
	
	bt.button();
	
	bt.bind('click', function(e) {
		console.log(e);
		key = String($(this).attr('href')).substring(1);
		
		Socket.emit('chat request', ContactList[key]);
	});
}

function removeContact(contact) {
	delete ContactList[contact.id];
	$('a').remove('[href=#' + contact.id + ']');
}