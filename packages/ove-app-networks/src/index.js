const { Constants } = require('./client/constants/networks');
const path = require('path');
const { express, app, log, nodeModules } = require('@ove/ove-lib-appbase')(__dirname, Constants.APP_NAME);
const server = require('http').createServer(app);

log.debug('Using module:', 'sigma');
app.use('/', express.static(path.join(nodeModules, 'sigma', 'build')));

const port = process.env.PORT || 8080;
server.listen(port);
log.info(Constants.APP_NAME, 'application started, port:', port);
