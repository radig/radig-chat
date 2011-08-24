var ChatServer = exports.ChatServer = function(config) {
	this.settings = {
		port: 8060,
		contactTimout: 3000, // 3 seg
		persistence: {
			database: 'default',
			username: 'user',
			password: 'senha'
		},
		authorization: null
	};
	
	// lib socket.io
	this.io = null;
	
	// lib para "limpeza" das entradas
	this.sanitize = null;
	
	// lib para gerar hashs
	this.hashlib = null;
	
	// persistência das mensagens
	this.messages = null;
	
	// contatos online
	this.online = {};
	
	// contatos que estão temporiariamente? indisponíveis
	this.refreshing = {};
	
	// sessões de chat abertas
	this.sessions = {};
	
	// usuário corrente está autorizado?
	this.authorized = false;
	
	this.init = function() {
		var self = this;
		
		if(typeof config != 'undefined' && config !== null) {
			self.settings = self.mergeProperties(self.settings, config);
		}
		
		self.sanitize = require('validator').sanitize;
		
		self.hashlib = require('hashlib');
		
		self.io = require('socket.io').listen(self.settings.port);
		
		self.io.configure('production', function(){
			self.io.enable('browser client minification');
			self.io.enable('browser client etag');
			self.io.set('log level', 1);
			self.io.set('transports', ['websocket', 'flashsocket', 'xhr-polling', 'jsonp-polling']);
		});
		
		ChatMessage = require('./models/chat_message').ChatMessage;
		
		self.messages = new ChatMessage({db: self.settings.persistence});
	};
	
	this.start = function() {
		var self = this;
		
		if(self.messages === null || self.io === null) {
			self.init();
		}
		
		self.io.of('/chat').on('connection', function(socket) {
			
			socket.on('identification', function(info) {
				info.id = self.sanitize(info.id).xss();
				info.name = self.sanitize(info.name).xss();
				
				self.authorize(info);
				
				setTimeout(function() {
					// se após timeout não estiver autorizado
					if(self.authorized === false) {
						// força desconexão
						socket.disconnect();
					}
				}, 500);
				
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
				// senão atualiza seu socket
				else {
					self.online[info.id].socketId = socket.id;

					// re-abre cada um dos chats do qual pertença
					for(cid in self.sessions) {
						
						for(i in self.sessions[cid].participants) {
							
							if(self.sessions[cid].participants[i].id == info.id) {
								socket.emit('new chat id', cid);
								socket.emit('open chat', cid, self.sessions[cid].participants);
								self.sendRecentHistory(cid, socket);
							}
						}
					}
				}
				
				socket.set('me', info);
			});
			
			// requisição de conexão
			socket.on('chat request', function(another) {
				
				// Recupera informações de sí
				socket.get('me', function(err, info) {
					
					// monta uma string contendo a sessao de ambos os contatos, concatenadas
					// em ordem crescente pelo username
					id = info.id;
					
					if(info.name > another.name) {
						id += another.id;
					}
					else {
						id = another.id + id;
					}
					
					// cria o id para a sessão
					cid = '_' + self.hashlib.md5(id);
					
					// caso a sessão ainda não exista, cria uma
					if(typeof self.sessions[cid] == 'undefined') {
						self.sessions[cid] = {participants: {}};
						
						// Adiciona contato à lista de participantes do chat
						self.sessions[cid].participants[another.id] = {id: another.id, name: another.name};
						
						// Adiciona a sí na lista de participantes do chat
						self.sessions[cid].participants[info.id] = {id: info.id, name: info.name};
						
						socket.emit('new chat id', cid);
						self.io.of('/chat').sockets[self.online[another.id].socketId].emit('new chat id', cid);
						
						// avisa a outra parte que ele deve abrir uma janela de chat
						socket.emit('open chat', cid, self.sessions[cid].participants);
						
						self.io.of('/chat').sockets[self.online[another.id].socketId].emit('open chat', cid, self.sessions[cid].participants);
					}
					// caso contrário
					else {
						var to = null;
						
						for(i in self.sessions[cid].participants) {
							to = self.online[self.sessions[cid].participants[i].id].socketId;
							
							self.io.of('/chat').sockets[to].emit('open chat', cid, self.sessions[cid].participants);
						}
					}
						
				});
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
					if(info !== null) {
						self.refreshing[info.id] = new Date().getTime();
					}
				});
			});
		});
		
		// invoca rotina para limpar lista de contatos constantemente
		this.clenaupContacts();
	};
	
	/**
	 * Persiste as mensagens trocadas
	 */
	this.persistMessage = function(chatId, info) {
		var self = this;
		
		self.messages.save(chatId, info.from, info.to, info.when, info.content);
	};
	
	/**
	 * Envia histórico recente de mensagem
	 */
	this.sendRecentHistory = function(chatId, client) {
		var self = this;
		
		self.messages.getLatests(chatId, 5, function(err, msg) {
				if(msg != null) {
					client.emit('user message', chatId, {from: msg.from.name, content: msg.content});
				}
			}
		);
	};
	
	/**
	 * Limpa a lista de contatos, removendo os inativos (desconectados)
	 */
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
	
	/**
	 * Verifica se o usuário conectado possuí permissão para
	 * usar o chat
	 */
	this.authorize = function(user) {
		
		if(this.settings.authorization !== null) {
			this.authorized = this.settings.authorization(user);
		}
		
		this.authorized = true;
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