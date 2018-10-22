const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const app = express();
const wss = require('express-ws')(app).getWss('/');
const dirs = {
    base: __dirname,
    nodeModules: path.join(__dirname, '..', '..', '..', 'node_modules'),
    constants: path.join(__dirname, 'client', 'utils'),
    rootPage: path.join(__dirname, 'blank.html')
};
const { Constants, Utils } = require('@ove-lib/utils')(app, 'core', dirs);
const log = Utils.Logger('OVE');
const server = require(path.join(__dirname, 'server', 'main'));

log.debug('Starting OVE Core');
log.debug('Application directories:', JSON.stringify(dirs));
log.debug('Using CORS middleware');
app.use(cors());
log.debug('Using Express JSON middleware');
app.use(express.json());

const clients = JSON.parse(fs.readFileSync(path.join(__dirname, 'client', Constants.CLIENTS_JSON_FILENAME)));
server(app, wss, clients, log, Utils, Constants);

app.listen(process.env.PORT || 8080);
log.info('OVE Core started');
