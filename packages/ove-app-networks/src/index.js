const path = require('path');
const { express, app, nodeModules } = require('@ove/ove-app-base')(__dirname, 'networks');
const server = require('http').createServer(app);

app.use('/', express.static(path.join(nodeModules, 'sigma', 'build')));

server.listen(process.env.PORT || 8080);
