var ChatServer = exports.ChatServer = function() {
	this.settings = {
		port: 8060,
		persistence: {
			database: 'default',
			username: 'user',
			password: 'senha'
		}
	};
	
	this.io = null;
	
	this.sanitize = null;
	
	this.messages = null;
	
	this.online = {};
	
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
				
				// associa a chave de sessão do usuário com ID socket
				self.online[info.id] = {sid: socket.id, name: info.name};
				
				socket.set('me', info);
				
				self.io.of('/chat').emit('contact-list join', info);
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
				self.io.of('/chat').sockets[self.online[another.id].sid].emit('new chat id', cid);
				
				// avisa a outra parte que ele deve abrir uma janela de chat
				socket.emit('open chat', cid, self.sessions[cid].participants);
				self.io.of('/chat').sockets[self.online[another.id].sid].emit('open chat', cid, self.sessions[cid].participants);
			});
			
			socket.on('chat opened', function(chatId) {
				chatId = self.sanitize(chatId).xss();
				
				for(i in self.sessions[chatId].participants) {
					to = self.online[self.sessions[chatId].participants[i].id].sid;
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
					for(i in self.sessions[chatId].participants)
					{
						to = self.online[self.sessions[chatId].participants[i].id].sid;
						
						if(to != socket.id) {
							self.io.of('/chat').sockets[to].emit('user message', chatId, {from: info.name, content: msg});
							self.persistMessage(chatId, {from: info, to: self.online[self.sessions[chatId].participants[i].id], when: new Date(), content: msg});
						}
						else
							self.persistMessage(chatId, {from: info, to: self.online[self.sessions[chatId].participants[i].id], when: new Date(), content: msg});
					}
				});
			});
			
			// quando o cliente é desconectado, o servidor tem de avisar a outra parte
			socket.on('disconnect', function() {
				/**
				 * @todo veficar se não uma reconexão, caso
				 * demore mais do que X segundos, daí notifica
				 * os participantes que ele está indisponível
				 */
				
				socket.get('me', function (err, info) {
					self.io.of('/chat').emit('contact-list quit', info);
				});
			});
		});
	};
	
	this.persistMessage = function(chatId, info) {
		var self = this;
		
		self.messages.save(chatId, info.from, info.to, info.when, info.content);
	};
};

var cs = new ChatServer();

cs.settings.persistence = {
	database: 'demo',
	username: 'dotti',
	password: 'senha'
};

cs.init();

cs.start();
