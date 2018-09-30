const { Constants } = require('./client/constants/maps');
const path = require('path');
const { express, app, config } = require('@ove/ove-lib-appbase')(__dirname, Constants.APP_NAME);
const request = require('request');
const server = require('http').createServer(app);

let layers = [];
// The map layers can be provided as an embedded JSON data structure or as a URL pointing
// to a location at which it is stored externally.
if (typeof config.layers === 'string') {
    request(config.layers, { json: true }, function (err, _res, body) {
        if (err) {
            console.error(err);
        } else {
            layers = body;
        }
    });
} else {
    layers = config.layers;
}
app.get('/layers.json', function (_req, res) {
    res.send(JSON.stringify(layers));
});
app.use('/', express.static(path.join(__dirname, 'ol3-cesium-v1.6')));

server.listen(process.env.PORT || 8080);
