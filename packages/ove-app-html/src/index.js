const { Constants } = require('./client/constants/html');
const { app } = require('@ove/ove-app-base')(__dirname, Constants.APP_NAME);
const server = require('http').createServer(app);

server.listen(process.env.PORT || 8080);
