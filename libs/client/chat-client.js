var ChatClient = function() {
	
	this.settings = {
		id: null,	
		nickname: '',
		host: '127.0.0.1',
		channel: 'chat',
		port: 8060
	};
	
	this.sessions = {};
	
	this.contacts = {};
	
	this.contactsCount = 0;
	
	this.socket = null;
	
	this.connect = function() {
		self = this;
		
		self.socket = io.connect( config.host + '/' + config.channel, {port: config.port, 'connect timout': 2000} );
		
		self.socket.on('contact-list join', function(contact) {
			self.addContact(contact);
		});

		self.socket.on('contact-list quit', function(contact) {
			self.removeContact(contact);
		});

		self.socket.on('connect', function () {
			self.socket.emit('identification', {id: self.settings.id, name: self.settings.nickname});
		});

		self.socket.on('new chat id', function(id) {
			self.sessions[id] = {participants: []};
		});

		self.socket.on('open chat', function(id, contacts) {
			winTitle = "";
			
			for(i in self.contacts) {
				self.sessions[id].participants.push(self.contacts[i]);
				
				if(self.settings.id != self.contacts[i].id)
					winTitle += self.contacts[i].name + " ";
			}
			
			self.addChatBox(id, winTitle);
		});

		self.socket.on('user message', function(id, msg) {
			$("#chat_" + id).chatbox("option", "boxManager").addMsg(msg.from, msg.content);
		});
	};
	
	this.addContact = function(contact) {
		self = this;
		
		self.contacts[contact.id] = contact;
		self.contactsCount++;
		
		$('body').append('<a href="#' + contact.id + '" class="chat-contact">' + contact.name + '</a>');
		bt = $('a[href=#' + contact.id + ']');
		
		bt.button();
		
		bt.bind('click', function(e) {
			key = String($(this).attr('href')).substring(1);
			
			self.socket.emit('chat request', self.contacts[key]);
		});
	};
	
	this.removeContact = function(contact) {
		self = this;
		
		delete self.contacts[contact.id];
		self.contactsCount--;
		
		$('a').remove('[href=#' + contact.id + ']');
	};
	
	this.addChatBox = function(cid, title) {
		self = this;
		
		$('body').append('<div id="chat_' + cid + '"></div>');
		
		$("#chat_" + cid).chatbox({
			id : "chat_" + cid,
			title : title,
			width : 250,
			offset: (250 + 20) * (self.contactsCount - 1),
			messageSent: function(id, author, msg) {
				self.sendMessage(cid, msg);
				this.boxManager.addMsg(self.settings.nickname, msg);
	    	},
	    	boxClosed: function(id) {
	    		
	    	}
		});
	};
	
	this.sendMessage = function(id, message) {
		this.socket.emit('chat message', id, message);
	};
};