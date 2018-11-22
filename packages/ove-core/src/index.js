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
    rootPage: path.join(__dirname, 'blank.html')
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

// Clients can be loaded either from a URL specified by an environment variable or through
// a local file.
/* jshint ignore:start */
// current version of JSHint does not support async/await
let getClients = async function () {
    let clients;
    // To support backwards compatibility with v0.2.0
    const spacesJSONEnvVar = process.env.OVE_SPACES_JSON || process.env.OVE_CLIENTS_JSON;
    if (spacesJSONEnvVar) {
        log.info('Loading clients from environment variable:', spacesJSONEnvVar);
        await new Promise(function (resolve) {
            request(spacesJSONEnvVar, { json: true }, function (err, _res, body) {
                if (err) {
                    log.error('Failed to load clients:', err);
                    resolve('clients failed to load');
                } else {
                    clients = body;
                    resolve('clients loaded');
                }
            });
        });
    }
    if (!clients) {
        const clientsPath = path.join(__dirname, 'client', Constants.SPACES_JSON_FILENAME);
        log.info('Loading clients from path:', clientsPath);
        clients = JSON.parse(fs.readFileSync(clientsPath));
    }
    return clients;
};
/* jshint ignore:end */

getClients().then(clients => {
    server(app, wss, clients, log, Utils, Constants);

    app.listen(process.env.PORT || 8080);
    log.info('OVE Core started');
});
