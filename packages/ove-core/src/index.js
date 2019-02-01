const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const request = require('request');
const app = express();
const wss = require('express-ws')(app).getWss('/');
const dirs = {
    base: __dirname,
    nodeModules: path.join(__dirname, '..', '..', '..', 'node_modules'),
    constants: path.join(__dirname, 'client', 'utils'),
    rootPage: path.join(__dirname, 'landing.html')
};
const { Constants, Utils } = require('@ove-lib/utils')('core', app, dirs);
const log = Utils.Logger('OVE');
const server = require(path.join(__dirname, 'server', 'main'));

log.debug('Starting OVE Core');
log.debug('Application directories:', JSON.stringify(dirs));
log.debug('Using CORS middleware');
app.use(cors());
log.debug('Using Express JSON middleware');
app.use(express.json());

log.debug('Using module:', 'github-markdown-css');
app.use('/', express.static(path.join(dirs.nodeModules, 'github-markdown-css')));

log.debug('Using module:', 'd3');
app.use('/', express.static(path.join(dirs.nodeModules, 'd3', 'dist')));

// The spaces configuration can be loaded either from a URL specified by an environment
// variable or through a local file.
/* jshint ignore:start */
// current version of JSHint does not support async/await
let getSpaces = async function () {
    let spaces;
    // BACKWARDS-COMPATIBILITY: For <= v0.2.0
    const spacesJSONEnvVar = process.env.OVE_SPACES_JSON || process.env.OVE_CLIENTS_JSON;
    if (spacesJSONEnvVar) {
        log.info('Loading spaces configuration from environment variable:', spacesJSONEnvVar);
        await new Promise(function (resolve) {
            request(spacesJSONEnvVar, { json: true }, function (err, _res, body) {
                if (err) {
                    log.error('Failed to load spaces configuration:', err);
                    resolve('spaces failed to load');
                } else {
                    spaces = body;
                    resolve('spaces loaded');
                }
            });
        });
    }
    if (!spaces) {
        const spacesPath = path.join(__dirname, 'client', Constants.SPACES_JSON_FILENAME);
        log.info('Loading spaces configuration from path:', spacesPath);
        spaces = JSON.parse(fs.readFileSync(spacesPath));
    }
    return spaces;
};
/* jshint ignore:end */

getSpaces().then(spaces => {
    server(app, wss, spaces, log, Utils, Constants);

    app.listen(process.env.PORT || 8080);
    log.info('OVE Core started');
});
