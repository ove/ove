const path = require('path');
const { express, app, nodeModules } = require('@ove/ove-app-base')(__dirname, 'alignment');
const server = require('http').createServer(app);

app.use('/', express.static(path.join(nodeModules, 'd3', 'dist')));

server.listen(process.env.PORT || 8080);
