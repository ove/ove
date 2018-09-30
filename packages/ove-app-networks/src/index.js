const { Constants } = require('./client/constants/networks');
const path = require('path');
const { express, app, nodeModules } = require('@ove/ove-lib-appbase')(__dirname, Constants.APP_NAME);
const server = require('http').createServer(app);

app.use('/', express.static(path.join(nodeModules, 'sigma', 'build')));

server.listen(process.env.PORT || 8080);
