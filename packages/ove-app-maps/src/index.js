const { Constants } = require('./client/constants/maps');
const path = require('path');
const { express, app, log, config } = require('@ove/ove-lib-appbase')(__dirname, Constants.APP_NAME);
const request = require('request');
const server = require('http').createServer(app);

let layers = [];
// The map layers can be provided as an embedded JSON data structure or as a URL pointing
// to a location at which it is stored externally.
if (typeof config.layers === 'string') {
    log.info('Loading map layers from URL:', config.layers);
    request(config.layers, { json: true }, function (err, _res, body) {
        if (err) {
            log.error('Failed to load map layers:', err);
        } else {
            layers = body;
        }
    });
} else {
    log.info('Loading map layers from configuration');
    layers = config.layers;
}
app.get('/layers.json', function (_req, res) {
    res.send(JSON.stringify(layers));
});
log.debug('Using module:', 'OpenLayers');
app.use('/', express.static(path.join(__dirname, 'ol3-cesium-v1.6')));

const port = process.env.PORT || 8080;
server.listen(port);
log.info(Constants.APP_NAME, 'application started, port:', port);
