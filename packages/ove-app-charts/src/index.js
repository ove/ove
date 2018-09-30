const { Constants } = require('./client/constants/charts');
const path = require('path');
const { express, app, log, nodeModules } = require('@ove/ove-lib-appbase')(__dirname, Constants.APP_NAME);
const server = require('http').createServer(app);

for (const mod of ['vega', 'vega-lite', 'vega-embed']) {
    log.debug('Using module:', mod);
    app.use('/', express.static(path.join(nodeModules, mod, 'build')));
}

const port = process.env.PORT || 8080;
server.listen(port);
log.info(Constants.APP_NAME, 'application started, port:', port);
