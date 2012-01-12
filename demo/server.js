var ChatServer = require('../libs/server/ChatServer').ChatServer;

// Configuração do servidor
var config = {
	// Configuração do DB que persistirá as mensagens trocada
	persistence: {
		database: 'demo',
		username: 'usuario',
		password: 'senha'
	},
	authorization: function(user, callback) {
		console.log(user);
		
		callback(true);
	}
};

var cs = new ChatServer(config);
cs.start();