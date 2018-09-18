const path = require('path');
const { express, app, nodeModules } = require('@ove/ove-app-base')(__dirname, 'charts');
const server = require('http').createServer(app);

app.use('/', express.static(path.join(nodeModules, 'vega', 'build')));
app.use('/', express.static(path.join(nodeModules, 'vega-lite', 'build')));
app.use('/', express.static(path.join(nodeModules, 'vega-embed', 'build')));

server.listen(process.env.PORT || 8080);
