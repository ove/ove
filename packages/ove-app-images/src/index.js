const { Constants } = require('./client/constants/images');
const path = require('path');
const { express, app, nodeModules } = require('@ove/ove-lib-appbase')(__dirname, Constants.APP_NAME);
const server = require('http').createServer(app);

app.use('/', express.static(path.join(nodeModules, 'openseadragon', 'build', 'openseadragon')));

server.listen(process.env.PORT || 8080);
