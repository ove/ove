const path = require('path');
const { express, app, nodeModules } = require('@ove/ove-app-base')(__dirname, 'images');
const server = require('http').createServer(app);

app.use('/', express.static(path.join(nodeModules, 'openseadragon', 'build', 'openseadragon')));

server.listen(process.env.PORT || 8080);
