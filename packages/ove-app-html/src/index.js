const { app } = require('@ove/ove-app-base')(__dirname, 'html');
const server = require('http').createServer(app);

server.listen(process.env.PORT || 8080);
