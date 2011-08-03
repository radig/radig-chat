var ChatServer = require('../libs/server/chat_server').ChatServer;

// Configuração do servidor
var config = {
	// Configuração do DB que persistirá as mensagens trocada
	persistence: {
		database: 'demo',
		username: 'usuario',
		password: 'senha'
	}	
};

var cs = new ChatServer(config);

cs.init();

cs.start();