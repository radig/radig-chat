#!/bin/bash
clear
echo "-----------------------------------------------------------------------------"
echo "Você precisa ter o NPM instalado"
echo "-----------------------------------------------------------------------------"
echo "Iniciando instalação dos módulos............................................."
echo ""
echo "Instalando módulo Mongo (https://github.com/christkv/node-mongodb-native)...."
npm install mongodb --mongodb:native
clear
echo "Instalando módulo Socket.io (https://github.com/LearnBoost/socket.io)........"
npm install socket.io
clear
echo "Instalando módulo Validator (https://github.com/chriso/node-validator)......."
npm install validator
clear
echo "Instalando módulo Mhash (https://github.com/Sembiance/node-mhash)..........."
npm install mhash
clear
echo "Instalando módulo Timerjs (https://github.com/minodisk/timer-js)............."
npm install timerjs
echo "-----------------------------------------------------------------------------"
echo "Dependências instaladas"
echo "-----------------------------------------------------------------------------"
