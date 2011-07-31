var sanitize = require('validator').sanitize;
var uuid = require('node-uuid');

var Db = require('mongodb').Db,
	Connection = require('mongodb').Connection,
	Server = require('mongodb').Server,
	BSON = require('mongodb').BSONNative;

var ChatSessions = new Array();
var online = {};


var io = require('socket.io').listen(8060);
io.of('/chat').on('connection', function(socket) {
	
	socket.on('identification', function(info) {
		
		info.id = sanitize(info.id).xss();
		info.name = sanitize(info.name).xss();
		
		// associa a chave de sessão do usuário com ID socket
		online[info.id] = {sid: socket.id, name: info.name};
		
		socket.set('me', info);
		
		io.of('/chat').emit('contact-list join', info);
	});
	
	// requisição de conexão
	socket.on('chat request', function(another) {
		// cria uma sessão de chat e um id para a mesma
		cid = '_' . uuid();
		ChatSessions[cid] = {participants: {}};
		
		// Adiciona contato à lista de participantes do chat
		ChatSessions[cid].participants[another.id] = {id: another.id, name: another.name};
		
		// Adiciona a sí na lista de participantes do chat
		socket.get('me', function(err, info) {
			ChatSessions[cid].participants[info.id] = {id: info.id, name: info.name};
		});
		
		socket.emit('new chat id', cid);
		io.of('/chat').sockets[online[another.id].sid].emit('new chat id', cid);
		
		// avisa a outra parte que ele deve abrir uma janela de chat
		socket.emit('open chat', cid, ChatSessions[cid].participants);
		io.of('/chat').sockets[online[another.id].sid].emit('open chat', cid, ChatSessions[cid].participants);
	});
	
	socket.on('chat opened', function(chatId) {
		chatId = sanitize(chatId).xss();
		
		for(i in ChatSessions[chatId].participants) {
			to = online[ChatSessions[chatId].participants[i].id].sid;
			if(to != socket.id) {
				io.of('/chat').sockets[to].emit('chat ready', chatId);
			}
		}
	});
	
	// mensagem recebida
	socket.on('chat message', function(chatId, msg) {
		chatId = sanitize(chatId).xss();
		msg = sanitize(msg).xss();
		
		socket.get('me', function (err, info) {
			
			// envia mensagem para todos os participantes
			for(i in ChatSessions[chatId].participants)
			{
				to = online[ChatSessions[chatId].participants[i].id].sid;
				
				if(to != socket.id) {
					io.of('/chat').sockets[to].emit('user message', chatId, {from: info.name, content: msg});
				}
			}
		});
	});
	
	// quando o cliente é desconectado, o servidor tem de avisar a outra parte
	socket.on('disconnect', function(chatId) {
		chatId = sanitize(chatId).xss();
		
		/**
		 * @todo veficar se não uma reconexão, caso
		 * demore mais do que X segundos, daí notifica
		 * os participantes que ele está indisponível
		 */
		
		socket.get('me', function (err, info) {
			io.of('/chat').emit('contact-list quit', info);
		});
	});
});