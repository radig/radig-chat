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
 * @subpackage    radig.sessions
 * @license       http://www.opensource.org/licenses/mit-license.php The MIT License
 */

/**
 * Classe que representa uma mensagem de chat
 * 
 * Faz a conexão no banco de dados (no caso MongoDB),
 * acessa coleção/tabela de sessções e busca pelo ID
 * informado (normalmente a sessão corrente).
 * 
 */
exports.ChatMessage = function(config) {
	this.settings = {
		host: 'localhost',
		port: 27017,
		database: 'default',
		collection: 'chats',
		username: false,
		password: false
	};
	
	this.db = null;
	
	this.messages = null;
	
	/**
	 * Efetua conexão com banco de dados.
	 * 
	 */
	this.query = function(callback) {
		var self = this;

		self.db.open(function(err, conn) {
			
			if(err) {
				log("ChatMessage: Não foi possível abrir conexão com o BD.");
				log(err);
				
			} else if(typeof callback == 'undefined' || callback == null) {
				log("ChatMessage: Forneça um callback para receber a conexão com o BD.");
				
			} else {
				conn.collection(self.settings.collection, function(err, collection) {
					if(err) {
						log("ChatMessage: Não foi possível selecionar a coleção " + self.settings.collection);
						log(err);
						
						return;
					}
					
					callback(collection);
				});
			}
		});
	};
	
	/**
	 * Método para recuperar as últimas 'l' mensagens do
	 * chat com sessão chatSession.
	 * 
	 */
	this.getLatests = function(chatSession, l, callback) {
		var self = this;
		
		self.query(function(collection) {
			
			collection.count({'chatSession': chatSession}, function(err1, count) {
				var skip = 0;
				
				if(err1) {
					log("ChatMessage: Falha ao contar mensagens disponíveis.");
					log(err1);
					
					return;
				}
				
				if(count - 1 > l)
					skip = count - l - 1;
				
				collection.find({'chatSession': chatSession}, {'skip' : skip, 'sort': [['date', 1]]}, function(err2, cursor) {
					if(err2) {
						log("ChatMessage: Falha ao recuperar mensagens.");
						log(err2);
						
						return;
					}
					
					cursor.each(function(err3, doc) {
						if(err3) {
							log("ChatMessage: Falha ao iterar sob mensagens.");
							log(err3);
						
							callback(null);
						} else {
							callback(doc);
						}
					});
				});
			});
		});
	};
	
	/**
	 * Método responsável por retornar um determinado valor da sessão
	 * salva no banco.
	 *  
	 * Recebe como parâmetro uma identificação do usuário remetente,
	 * 
	 */
	this.save = function(chatSession, from, to, when, message) {
		var self = this;
		
		self.query(function(collection) {
			
			var data = {
				chatSession: chatSession,
				from: from,
				to: to,
				date: when,
				content: message
			};
			
			collection.insert(data);
		});
	};
	
	//############################# Inicialização ##############################
	
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
	
	if(typeof config != 'undefined' && config !== null) {
		this.settings = this.mergeProperties(this.settings, config);
	}
	
	/**
	 * Carregamento das classes necessárias a comunicação com MongoDB
	 * Utiliza o módulo mongodb-native para conexão (instalar via NPM).
	 */ 
	var Db = require('mongodb').Db,
		Server = require('mongodb').Server;
	
	this.db = new Db(this.settings.database, new Server(this.settings.host, this.settings.port, {}));
};

/**
 * Retorna a data e hora atual (yyyy-mm-dd hh:mm:ss)
 * @returns String
 */
function getCurrentDate()
{
	date = new Date();
	
	year = date.getFullYear();
	month = date.getMonth()+1;
	
	
	if(month < 10)
		month = '0' + month;
	
	day = date.getDate();
	if(day < 10)
		day = '0' + day;
	
	hour = date.getHours();
	if(hour < 10)
		hour = '0' + hour;
	
	minute = date.getMinutes();
	if(minute < 10)
		minute = '0' + minute;
	
	second = date.getSeconds();
	if(second < 10)
		second = '0' + second;
	
	return year + '-' +  month + '-' + day + ' ' + hour + ':' + minute + ':' + second ;
}

function log(message) {
	console.log("[" + getCurrentDate() + "] " + message + "\n");
}