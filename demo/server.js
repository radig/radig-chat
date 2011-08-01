var ChatServer = require('../libs/server/chat_server').ChatServer;

var cs = new ChatServer();

// Configuração do DB que persistirá as mensagens trocada
cs.settings.persistence = {
	database: 'demo',
	username: 'usuario',
	password: 'senha'
};

cs.init();

cs.start();