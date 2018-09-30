const { Constants } = require('./client/constants/html');
const { app, log } = require('@ove/ove-lib-appbase')(__dirname, Constants.APP_NAME);
const server = require('http').createServer(app);

const port = process.env.PORT || 8080;
server.listen(port);
log.info(Constants.APP_NAME, 'application started, port:', port);
