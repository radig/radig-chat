var ChatClient = function(config) {
	this.settings = {
		id: null,	
		nickname: '',
		host: '127.0.0.1',
		channel: 'chat',
		port: 8060,
		contactList: {
			wrapper: '#contact-list',
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
		
		if(typeof config != 'undefined' && config !== null) {
			self.settings = self.mergeProperties(self.settings, config);
		}
		
		self.socket = io.connect( self.settings.host + '/' + self.settings.channel, {port: self.settings.port, 'connect timout': 2000} );
		
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
	
	/**
	 * Cria um link semi-formatado cotendo o nome do contato
	 * e a identificação local dele.
	 * 
	 * Associa o evento clique com a ação de abrir um novo chat
	 */
	this.addContact = function(contact) {
		var self = this;
		var config = self.settings.contactList;
		
		self.contacts[contact.id] = contact;
		
		var link = '<a href="#' + contact.id + '" class="jsContactLink ' + config.classes + '">'
					+ config.prepend
					+ contact.name
					+ config.pospend
					+ '</a>';
		
		$(self.settings.contactList.wrapper).append(link);
		
		$('.jsContactLink').bind('click', function(event) {
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
	
	/**
	 * Mescla recursivamente os atributos de dois objetos
	 */
	this.mergeProperties = function(destination, source) {
		var self = this;
		
		for (var property in source) {
			if (source.hasOwnProperty(property) && (source[property] != '' && source[property] !== null)) {
				
				if(typeof source[property] == 'object' && source[property] !== null) {
					destination[property] = self.mergeProperties(destination[property], source[property]);
				}
				else {
					destination[property] = source[property];
				}
			}
		}
		
		return destination;
	};
};