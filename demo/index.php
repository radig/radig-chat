<?php session_start(); ?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
	<meta content="text/html; charset=utf-8" http-equiv="Content-Type">
	<title>Radig Chat - Demo</title>
	<link rel="icon" type="image/x-icon" href="img/radig.icon.gif">
	<link rel="shortcut icon" type="image/x-icon" href="img/radig.icon.gif">
	
	<link href="css/main.css" type="text/css" rel="stylesheet">
	
	<link href="css/jquery-ui.css" type="text/css" rel="stylesheet">
	
	<link href="../libs/client/chatbox/jquery.ui.chatbox.css" type="text/css" rel="stylesheet">
	
	<script src="http://<?php echo $_SERVER['SERVER_ADDR'];?>:8060/socket.io/socket.io.js" type="text/javascript"></script>
	
	<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.min.js" type="text/javascript"></script>
	<script src="https://ajax.googleapis.com/ajax/libs/jqueryui/1.8.16/jquery-ui.min.js" type="text/javascript"></script>
	
	<script src="../libs/client/chatbox/jquery.ui.chatbox.js" type="text/javascript"></script>
	<script src="../libs/client/chat_client.js" type="text/javascript"></script>
	<script type="text/javascript">
		var config = {
			id: "_<?php echo session_id(); ?>",
			nickname: "Demo (<?php echo substr(session_id(), 0, 2); ?>)",
			host: '127.0.0.1',
			channel: 'chat',
			port: 8060,
			contactList: {
				wrapper: '#contacts',
				prepend: '<li>',
				pospend: '</li>'
			}
		};

		var cc = new ChatClient(config);

		// Inicia chat cliente
		cc.connect();
	</script>
</head>
<body>
	<div id="container">
		<div style="background-color:#507cab" id="header">
				
		</div>
		<div id="content">
		Troque idéias.
		
		</div>
		
		<ul id="contacts"></ul>
		<div id="chats"></div>
		
		<div id="footer">
			<div id="footer_bottom">
				<a href="http://www.radig.com.br/"><img border="0" target="_blank" alt="desenvolvido por Radig - Soluções em TI" src="img/radig.icon.gif"></a>
			</div>
		</div>
	</div>
</body>
</html>