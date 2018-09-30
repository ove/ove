const { Constants } = require('./client/constants/charts');
const path = require('path');
const { express, app, nodeModules } = require('@ove/ove-lib-appbase')(__dirname, Constants.APP_NAME);
const server = require('http').createServer(app);

for (const mod of ['vega', 'vega-lite', 'vega-embed']) {
    app.use('/', express.static(path.join(nodeModules, mod, 'build')));
}

server.listen(process.env.PORT || 8080);
