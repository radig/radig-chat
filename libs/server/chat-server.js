var io = require('socket.io').listen(8060);

var ChatSessions = new Array();
var online = {};

io.of('/chat').on('connection', function(socket) {
	
	socket.on('identification', function(info) {
		// associa a chave de sessão do usuário com ID socket
		online[info.id] = {sid: socket.id, name: info.name};
		
		socket.set('me', info);
	});
	
	// requisição de conexão
	socket.on('chat request', function(another) {
		// cria uma sessão de chat e um id para a mesma
		cid = ChatSessions.push({participants: {}}) - 1;
		
		io.of('/chat').sockets[online[another.id].sid].join('chat session ' + cid);
		
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
		
		for(i in ChatSessions[chatId].participants) {
			to = online[ChatSessions[chatId].participants[i].id].sid;
			if(to != socket.id) {
				io.of('/chat').sockets[to].emit('chat ready', chatId);
			}
		}
	});
	
	// mensagem recebida
	socket.on('chat message', function(chatId, msg) {
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
		/**
		 * @todo veficar se não uma reconexão, caso
		 * demore mais do que X segundos, daí notifica
		 * os participantes que ele está indisponível
		 */
	});
});