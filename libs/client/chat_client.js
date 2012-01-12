/**
 * Copyright 2011-2012, Radig Soluções em TI. (http://www.radig.com.br)
 *
 * Licensed under The MIT License
 * Redistributions of files must retain the above copyright notice.
 *
 * @filesource
 * @copyright     Copyright 2011-2012, Radig Soluções em TI. (http://www.radig.com.br)
 * @link          http://www.radig.com.br
 * @package       radig
 * @subpackage    radig.chat.client
 * @license       http://www.opensource.org/licenses/mit-license.php The MIT License
 */

/**
 * Classe para controlar as ações do lado cliente
 * em um sistema de IM (instante messaging) estilo
 * GTalk
 * 
 */
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
			if(contact.id != self.settings.id) {
				self.addContact(contact);
			}
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
			if(typeof self.sessions[id] == 'undefined') {
				self.sessions[id] = {participants: []};
			}
		});

		// pedido de abertura de nova janela
		self.socket.on('open chat', function(id, contacts) {
			var winTitle = "";
			var boxWin = $('#chatbox-' + 'chat_' + id);
			
			if(typeof self.sessions[id] != 'undefined' && boxWin.length == 0) {
				for(i in contacts) {
					self.sessions[id].participants.push(contacts[i]);
					
					if(self.settings.id != contacts[i].id) {
						
						if(winTitle.length > 0)
							winTitle += ",";
					
						winTitle += self.nameFormat(contacts[i].name) + " ";
					}
				}
				
				self.sessionsCount++;
				self.addChatBox(id, winTitle);
			}
			else if(boxWin.length > 0) {
				boxWin.show();
			}
		});
		
		// mensagem vinda
		self.socket.on('user message', function(id, msg) {
			$("#chat_" + id).chatbox("option", "boxManager").addMsg(self.nameFormat(msg.from), msg.content);
		});
		
		self.socket.on('chat status', function(id, status) {
			var input;
			
			// caso esteja abrindo um chat pré-existente
			if(status == 'already exist') {
				$("#chat_" + id).text('');
				self.socket.emit('request recent historic', id);
			}
			else if(status == 'contact offline') {
				input = $('#chatbox-' + 'chat_' + id + ' textarea');
				
				if(input.length > 0) {
					input.prop('disabled', true);
				}
			}
			else if(status == 'contact online') {
				input = $('#chatbox-' + 'chat_' + id + ' textarea');
				
				if(input.length > 0) {
					input.prop('disabled', false);
				}
			}
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
		
		// Caso usuário já esteja na lista de contatos, ignora-o
		if(typeof self.contacts[contact.id] != 'undefined') {
			return;
		}
		
		self.contacts[contact.id] = contact;
		
		var link = config.prepend
					+ '<a href="#' + contact.id + '" class="jsContactLink ' + config.classes + '">'
					+ self.nameFormat(contact.name)
					+ '</a>'
					+ config.pospend;
		
		$(self.settings.contactList.wrapper).append(link);
		
		$(self.settings.contactList.wrapper).trigger('contact_list_add', contact.id);
		
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
		$(self.settings.contactList.wrapper).height('auto');
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
	    		cid = id.substring(5);
	    		self.socket.emit('chat close', cid);
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
	
	/**
	 * Truna nome para não extrapolar título
	 * na janela de chat
	 */
	this.nameFormat = function(name) {
		var limit = 18;
		
		if(name.length > limit) {
			return name.substr(0, 15) + '...';
		}
		
		return name;
	};
};