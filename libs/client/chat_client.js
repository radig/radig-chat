var ChatClient = function() {
	
	this.settings = {
		id: null,	
		nickname: '',
		host: '127.0.0.1',
		channel: 'chat',
		port: 8060,
		contactList: {
			classes: 'contact-list-contact',
			prepend: '',
			pospend: ''
		}
	};
	
	this.sessions = {};
	
	this.contacts = {};
	
	this.sessionsCount = 0;
	
	this.socket = null;
	
	this.connect = function() {
		var self = this;
		
		self.socket = io.connect( config.host + '/' + config.channel, {port: config.port, 'connect timout': 2000} );
		
		// requisita contatos
		self.socket.emit('contact-list request');
		
		// trata entrada de novo contato
		self.socket.on('contact-list join', function(contact) {
			self.addContact(contact);
		});

		// saída de um contato
		self.socket.on('contact-list quit', function(contact) {
			self.removeContact(contact);
		});

		// identificação do cliente
		self.socket.on('connect', function () {
			self.socket.emit('identification', {id: self.settings.id, name: self.settings.nickname});
		});

		// criação de nova sessão chat
		self.socket.on('new chat id', function(id) {
			self.sessions[id] = {participants: []};
		});

		// pedido de abertura de nova janela
		self.socket.on('open chat', function(id, contacts) {
			winTitle = "";
			
			for(i in self.contacts) {
				self.sessions[id].participants.push(self.contacts[i]);
				
				if(self.settings.id != self.contacts[i].id)
					winTitle += self.contacts[i].name + " ";
			}
			
			self.sessionsCount++;
			self.addChatBox(id, winTitle);
		});
		
		// mensagem vinda
		self.socket.on('user message', function(id, msg) {
			$("#chat_" + id).chatbox("option", "boxManager").addMsg(msg.from, msg.content);
		});
	};
	
	this.addContact = function(contact) {
		var self = this;
		
		self.contacts[contact.id] = contact;
		
		$('body').append('<a href="#' + contact.id + '" class="chat-contact">' + contact.name + '</a>');
		bt = $('a[href=#' + contact.id + ']');
		
		bt.button();
		
		bt.bind('click', function(e) {
			key = String($(this).attr('href')).substring(1);
			
			self.socket.emit('chat request', self.contacts[key]);
			
			return false;
		});
	};
	
	this.removeContact = function(contact) {
		var self = this;
		
		delete self.contacts[contact.id];
		
		$('a').remove('[href=#' + contact.id + ']');
	};
	
	this.addChatBox = function(cid, title) {
		var self = this;
		
		$('body').append('<div id="chat_' + cid + '"></div>');
		
		$("#chat_" + cid).chatbox({
			id : "chat_" + cid,
			title : title,
			width : 250,
			offset: (250 + 20) * (self.sessionsCount - 1),
			messageSent: function(id, author, msg) {
				self.sendMessage(cid, msg);
				this.boxManager.addMsg(self.settings.nickname, msg);
	    	},
	    	boxClosed: function(id) {
	    		self.sessionsCount--;
	    	}
		});
	};
	
	this.sendMessage = function(id, message) {
		this.socket.emit('chat message', id, message);
	};
};