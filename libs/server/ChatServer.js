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
 * @subpackage    radig.chat.server
 * @license       http://www.opensource.org/licenses/mit-license.php The MIT License
 */

/**
 * Classe para fazer toda a lógica de funcionamento
 * de um sistema de IM (instante messaging) estilo
 * GTalk
 * 
 */
exports.ChatServer = function(config) {
	var Timer = require('timerjs').Timer;
	
	this.settings = {
		port: 8060,
		contactTimout: 5000, // 5 seg
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
	
	/**
	 * Verifica se o usuário conectado possuí permissão para
	 * usar o chat
	 */
	this.authorize = function(user, callback) {
		
		// Caso haja uma função própria para autorização, faz sua chamada
		if(this.settings.authorization !== null && typeof callback != 'undefined') {
			this.settings.authorization(user, callback);
		}
		// Caso contrário libera o acesso
		else {
			callback(true);
		}
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
	
	this.start = function() {
		var self = this;
		
		// inicialização/re-inicialização dos atributos da classe
		self.sanitize = require('validator').sanitize;
		self.hashlib = require('mhash').hash;
		self.online = {};
		self.refreshing = {};
		self.sessions = {};
		
		// inicializa parâmetros do servidor, caso ainda não estejam definido
		if(self.messages === null || self.io === null) {
			if(typeof config != 'undefined' && config !== null) {
				self.settings = self.mergeProperties(self.settings, config);
			}
			
			self.io = require('socket.io').listen(self.settings.port);
			
			self.io.configure('production', function() {
				self.io.enable('browser client minification');
				self.io.enable('browser client etag');
				self.io.set('flash policy port', 7666);
				self.io.set('log level', 1);
				self.io.set('transports', ['websocket', 'flashsocket']);
			});
			
			self.io.configure('development', function(){
				self.io.enable('browser client minification');
				self.io.enable('browser client etag');
				self.io.set('flash policy port', 7666);
				self.io.set('transports', ['flashsocket', 'websocket']);
			});
			
			ChatMessage = require('./models/ChatMessage').ChatMessage;
			
			self.messages = new ChatMessage(self.settings.persistence);
		}
		
		// inicia servidor no namespace chat
		self.io.of('/chat').on('connection', function(socket) {
			
			socket.on('identification', function(info) {
				info.id = self.sanitize(info.id).xss();
				info.name = self.sanitize(info.name).xss();
				
				self.authorize(info, function(authorized) {
					
					if(authorized === false) {
						// força desconexão
						socket.disconnect();
					}
					else {
						// caso o contato esteja na fila de timouts, o remove dela
						if(typeof self.refreshing[info.id] != 'undefined') {
							// finaliza timout
							self.refreshing[info.id].stop();
							
							delete self.refreshing[info.id];
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
									
									if(self.sessions[cid].participants[i].id == info.id && self.sessions[cid].participants[i].autoReOpen == true) {
										socket.emit('new chat id', cid);
										socket.emit('open chat', cid, self.sessions[cid].participants);
										self.sendRecentHistory(cid, socket);
									}
								}
							}
						}
						
						var validSession;
						// avisa cada um dos contatos que o cliente voltou (caso ainda haja sessão aberta)
						for(cid in self.sessions) {
							validSession = false;
							
							for(i in self.sessions[cid].participants) {
								if(self.sessions[cid].participants[i].id == info.id) {
									validSession = true;
								}
							}
							
							if(validSession === true) {
								for(i in self.sessions[cid].participants) {
									if(self.sessions[cid].participants[i].id != info.id && (typeof self.online[self.sessions[cid].participants[i].id] != 'undefined')) {
										to = self.online[self.sessions[cid].participants[i].id].socketId;
										
										if(typeof self.io.of('/chat').sockets[to] != 'undefined') {
											self.io.of('/chat').sockets[to].emit('chat status', cid, 'contact online');
										}
									}
								}
							}
						}
						
						socket.set('me', info);
					}
				});
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
					cid = '_' + self.hashlib('md5', id);
					
					// caso a sessão ainda não exista, cria uma
					if(typeof self.sessions[cid] == 'undefined') {
						self.sessions[cid] = {participants: {}};
						
						// Adiciona contato à lista de participantes do chat
						self.sessions[cid].participants[another.id] = {id: another.id, name: another.name, autoReOpen: true};
						
						// Adiciona a sí na lista de participantes do chat
						self.sessions[cid].participants[info.id] = {id: info.id, name: info.name, autoReOpen: true};
						
						// avisa à si e a outra parte que ele deve abrir uma janela de chat
						if((typeof self.online[another.id] != 'undefined') && (typeof self.io.of('/chat').sockets[self.online[another.id].socketId] != 'undefined')) {
							socket.emit('new chat id', cid);
							self.io.of('/chat').sockets[self.online[another.id].socketId].emit('new chat id', cid);
							
							socket.emit('open chat', cid, self.sessions[cid].participants);
							self.io.of('/chat').sockets[self.online[another.id].socketId].emit('open chat', cid, self.sessions[cid].participants);
						}
					}
					// caso contrário, apenas reabre as janelas de chat
					else {
						// para si
						socket.emit('new chat id', cid);
						socket.emit('open chat', cid, self.sessions[cid].participants);
						
						if(self.sessions[cid].participants[info.id].autoReOpen === false) {
							socket.emit('chat status', cid, 'already exist');
						
							self.sessions[cid].participants[info.id].autoReOpen = true;
						}
						
						// para os contatos
						for(i in self.sessions[cid].participants) {
							to = self.online[self.sessions[cid].participants[i].id].socketId;
							
							if(to != socket.id && (typeof self.io.of('/chat').sockets[to] != 'undefined')) {
								self.io.of('/chat').sockets[to].emit('new chat id', cid);
								self.io.of('/chat').sockets[to].emit('open chat', cid, self.sessions[cid].participants);
							}
							else if(typeof self.io.of('/chat').sockets[to] == 'undefined') {
								socket.emit('chat status', 'contact offline');
							}
						}
					}
				});
			});
			
			// solicitação para fechar janela de chat (não reabri-la automaticamente)
			socket.on('chat close', function(chatId) {
				chatId = self.sanitize(chatId).xss();
				
				socket.get('me', function(err, info) {
					if(typeof self.sessions[chatId].participants[info.id].autoReOpen == 'undefined' || self.sessions[chatId].participants[info.id].autoReOpen === true) {
						self.sessions[chatId].participants[info.id].autoReOpen = false;
					}
				});
			});
			
			// mensagem recebida
			socket.on('chat message', function(chatId, msg) {
				chatId = self.sanitize(chatId).xss();
				msg = self.sanitize(msg).xss();
				
				socket.get('me', function (err, info) {
					// envia mensagem para todos os participantes
					for(i in self.sessions[chatId].participants) {
						
						if((typeof self.sessions[chatId].participants[i] != 'undefined') && (typeof self.online[self.sessions[chatId].participants[i].id] != 'undefined')) {
							to = self.online[self.sessions[chatId].participants[i].id].socketId;
						
							if(to != socket.id) {
								self.io.of('/chat').sockets[to].emit('user message', chatId, {from: info.name, content: msg});
								self.persistMessage(chatId, {from: info, to: self.online[self.sessions[chatId].participants[i].id], when: new Date(), content: msg});
							}
						}
					}
				});
			});
			
			// resposta à requisição do histórico recente de mensagens para uma sessão
			socket.on('request recent historic', function(chatId) {
				self.sendRecentHistory(chatId, socket);
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
						self.refreshing[info.id] = new Timer(self.settings.contactTimout, 1);
						
						self.hasReturned(info.id);
					}
				});
			});
		});
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
		
		self.messages.getLatests(chatId, 5, function(msg) {
				if(msg != null) {
					client.emit('user message', chatId, {from: msg.from.name, content: msg.content});
				}
			}
		);
	};
	
	/**
	 * Cliente reconecta ao servidor
	 * 
	 */
	this.hasReturned = function(clientId) {
		var self = this;
		
		self.refreshing[clientId].addListener('timer', function() {
			// se após o timout o cliente não tiver retornado, faz sua exclusão
			if(typeof self.refreshing[clientId] != 'undefined') {
				self.io.of('/chat').emit('contact-list quit', {id: clientId});
				
				var validSession;
				
				// avisa cada um dos contatos que o cliente saiu
				for(cid in self.sessions) {
					validSession = false;
					
					for(i in self.sessions[cid].participants) {
						if(self.sessions[cid].participants[i].id == clientId) {
							validSession = true;
						}
					}
					
					if(validSession === true) {
						for(i in self.sessions[cid].participants) {
							if(self.sessions[cid].participants[i].id != clientId  && (typeof self.online[self.sessions[cid].participants[i].id] != 'undefined')) {
								to = self.online[self.sessions[cid].participants[i].id].socketId;
								
								if(typeof self.io.of('/chat').sockets[to] != 'undefined') {
									self.io.of('/chat').sockets[to].emit('chat status', cid, 'contact offline');
								}
							}
						}
					}
				}
				
				delete self.online[clientId];
				delete self.refreshing[clientId];
			}
		});
		
		self.refreshing[clientId].start();
	};
	
	/**
	 * Finalização do servidor socket
	 * 
	 */
	this.stop = function() {
		this.io.server.close();
	};
};