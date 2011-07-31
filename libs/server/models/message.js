/**
 * Copyright 2011, Radig Soluções em TI. (http://www.radig.com.br)
 *
 * Licensed under The MIT License
 * Redistributions of files must retain the above copyright notice.
 *
 * @filesource
 * @copyright     Copyright 2011, Radig Soluções em TI. (http://www.radig.com.br)
 * @link          http://www.radig.com.br
 * @package       radig
 * @subpackage    radig.sessions
 * @license       http://www.opensource.org/licenses/mit-license.php The MIT License
 */

/**
 * Carregamento das classes necessárias a comunicação com MongoDB
 * Utiliza o módulo mongodb-native para conexão (instalar via NPM).
 */ 
var Db = require('mongodb').Db,
	Connection = require('mongodb').Connection,
	Server = require('mongodb').Server,
	BSON = require('mongodb').BSONNative;

/**
 * Classe que representa uma mensagem de chat
 * 
 * Faz a conexão no banco de dados (no caso MongoDB),
 * acessa coleção/tabela de sessções e busca pelo ID
 * informado (normalmente a sessão corrente).
 * 
 */
var ChatMessage = exports.ChatMessage = function() {
	this.settings = {
		db: {
			host: 'localhost',
			port: '27017',
			database: 'default',
			collection: 'default',
			username: false,
			password: false
		}
	};
	
	this.db = null;
	
	this.conn = null;
	
	this.messages = null;
	
	/**
	 * Efetua conexão com banco de dados.
	 * 
	 */
	this.connect = function() {
		self = this;
		
		self.conn = new Db(this.settings.db.database, new Server(self.settings.db.host, self.settings.db.port, {}), {native_parser:true});
		
		self.conn.open(function(err, db) {
			if(db === null)
			{
				console.log("ChatMessage: Não foi possível abrir o BD.");
				console.log(err);
				
				return false;
			}
			
			self.db = db;
		});
	};
	
	/**
	 * Método para recuperar as últimas 'l' mensagens do
	 * chat com sessão chatSession.
	 * 
	 */
	this.getLatests = function(chatSession, l) {
		self = this;
		msgs = null;
		
		// caso conexão ainda não tenha sido estabelecida, tenta estabeler uma
		if(self.db === null) {
			self.connect();
			
			// caso não haja sucesso, retorna false e printa mensagem no console
			if(self.db === null) {
				console.log("ChatMessage: É preciso conectar ao Banco antes de utilizar seus dados.");
				return false;
			}
		}
		
		self.db.collection(self.settings.db.collection, function(err, collection) {
			if(collection === null)
			{
				console.log("ChatMessage: Não é possível acessar a coleção.");
				console.log(err);
					
				return false;
			}
			
			collection.find({'chatSession': chatSession, 'to': to}, function(err, messages) {
				if(messages != 'undefined') {
					msgs = messages;
				}
			}).limit(l);
		});
		
		return msgs;
	};
	
	/**
	 * Método responsável por retornar um determinado valor da sessão
	 * salva no banco.
	 *  
	 * Recebe como parâmetro uma identificação do usuário remetente,
	 * 
	 */
	this.save = function(chatSession, from, to, when, message) {
		self = this;
		
		// caso conexão ainda não tenha sido estabelecida, tenta estabeler uma
		if(self.db === null) {
			self.connect();
			
			// caso não haja sucesso, retorna false e printa mensagem no console
			if(self.db === null) {
				console.log("ChatMessage: É preciso conectar ao Banco antes de utilizar seus dados.");
				return false;
			}
		}
		
		self.db.collection(self.settings.db.collection, function(err, collection) {
			if(collection === null)
			{
				console.log("ChatMessage: Não é possível acessar a coleção.");
				console.log(err);
					
				return false;
			}
			
			data = {
				chatSession: chatSession,
				from: from,
				to: to,
				date: when,
				content: message
			};
			
			collection.insert(data);
		});
		
		return true;
	};
};