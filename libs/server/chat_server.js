var ChatServer = exports.ChatServer = function() {
	this.settings = {
		port: 8060,
		contactTimout: 3000, // 3 seg
		persistence: {
			database: 'default',
			username: 'user',
			password: 'senha'
		}
	};
	
	// lib socket.io
	this.io = null;
	
	// lib para "limpeza" das entradas
	this.sanitize = null;
	
	// persistência das mensagens
	this.messages = null;
	
	// contatos online
	this.online = {};
	
	// contatos que estão temporiariamente? indisponíveis
	this.refreshing = {};
	
	// sessões de chat abertas
	this.sessions = {};
	
	this.init = function() {
		var self = this;
		
		self.sanitize = require('validator').sanitize;
		
		self.io = require('socket.io').listen(self.settings.port);
		
		ChatMessage = require('./models/chat_message').ChatMessage;
		
		self.messages = new ChatMessage();
		
		self.messages.settings.db.database = self.settings.persistence.database;
		self.messages.settings.db.username = self.settings.persistence.username;
		self.messages.settings.db.password = self.settings.persistence.password;
		
		self.messages.connect();
	};
	
	this.start = function() {
		var self = this;
		
		self.io.of('/chat').on('connection', function(socket) {
			
			socket.on('identification', function(info) {
				info.id = self.sanitize(info.id).xss();
				info.name = self.sanitize(info.name).xss();
				
				// caso o contato esteja na fila de timouts, o remove dela
				if(typeof self.refreshing[socket.id] != 'undefined') {
					delete self.refreshing[socket.id];
				}
				
				// caso o contato ainda não esteja registrado
				if(typeof self.online[info.id] == 'undefined') {
					// associa a chave de sessão do usuário com ID socket
					self.online[info.id] = {socketId: socket.id, name: info.name};
					
					self.io.of('/chat').emit('contact-list join', info);
				}
				
				socket.set('me', info);
			});
			
			// requisição de conexão
			socket.on('chat request', function(another) {
				// cria uma sessão de chat e um id para a mesma
				cid = '_' + new Date().getTime();
				
				self.sessions[cid] = {participants: {}};
				
				// Adiciona contato à lista de participantes do chat
				self.sessions[cid].participants[another.id] = {id: another.id, name: another.name};
				
				// Adiciona a sí na lista de participantes do chat
				socket.get('me', function(err, info) {
					self.sessions[cid].participants[info.id] = {id: info.id, name: info.name};
				});
				
				socket.emit('new chat id', cid);
				self.io.of('/chat').sockets[self.online[another.id].socketId].emit('new chat id', cid);
				
				// avisa a outra parte que ele deve abrir uma janela de chat
				socket.emit('open chat', cid, self.sessions[cid].participants);
				self.io.of('/chat').sockets[self.online[another.id].socketId].emit('open chat', cid, self.sessions[cid].participants);
			});
			
			socket.on('chat opened', function(chatId) {
				chatId = self.sanitize(chatId).xss();
				
				for(i in self.sessions[chatId].participants) {
					to = self.online[self.sessions[chatId].participants[i].id].socketId;
					if(to != socket.id) {
						self.io.of('/chat').sockets[to].emit('chat ready', chatId);
					}
				}
			});
			
			// mensagem recebida
			socket.on('chat message', function(chatId, msg) {
				chatId = self.sanitize(chatId).xss();
				
				msg = self.sanitize(msg).xss();
				
				socket.get('me', function (err, info) {
					
					// envia mensagem para todos os participantes
					for(i in self.sessions[chatId].participants) {
						
						to = self.online[self.sessions[chatId].participants[i].id].socketId;
						
						if(to != socket.id) {
							self.io.of('/chat').sockets[to].emit('user message', chatId, {from: info.name, content: msg});
							self.persistMessage(chatId, {from: info, to: self.online[self.sessions[chatId].participants[i].id], when: new Date(), content: msg});
						}
					}
				});
			});
			
			// resposta à pedido de lista de contato
			socket.on('contact-list request', function() {
				for(i in self.online) {
					socket.emit('contact-list join', {id: i, name: self.online[i].name});
				}
			});
			
			// quando o cliente é desconectado, o servidor tem de avisar a outra parte
			socket.on('disconnect', function() {
				
				socket.get('me', function (err, info) {
					self.refreshing[info.id] = new Date().getTime();
					// @todo definir um timout pra função cleanupContacts
				});
			});
		});
	};
	
	this.persistMessage = function(chatId, info) {
		var self = this;
		
		self.messages.save(chatId, info.from, info.to, info.when, info.content);
	};
	
	this.clenaupContacts = function() {
		var self = this;
		
		var Timer = require('timerjs').Timer;
		var timer = new Timer(2000);

		timer.addListener('timer', function () {
			var current = new Date().getTime();
			var init = 0;
			
			for(i in self.refreshing) {
				
				init = self.refreshing[i];
				
				if(init + self.settings.contactTimout >= current) {
					self.io.of('/chat').emit('contact-list quit', {id: i});
					
					delete self.online[i];
					delete self.refreshing[i];
				}
			}
		});
	};
};