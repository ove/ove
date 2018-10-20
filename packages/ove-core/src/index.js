const path = require('path');
const express = require('express');
const cors = require('cors');
const app = express();
const dirs = {
    base: __dirname,
    nodeModules: path.join(__dirname, '..', '..', '..', 'node_modules'),
    constants: path.join(__dirname, 'client', 'utils'),
    rootPage: path.join(__dirname, 'blank.html')
};
const { Constants, Utils } = require('@ove-lib/utils')(app, 'core', dirs);
const log = Utils.Logger('OVE');
const server = require(path.join(__dirname, 'server'));

log.debug('Starting OVE Core');
log.debug('Application directories:', JSON.stringify(dirs));
log.debug('Using CORS middleware');
app.use(cors());
log.debug('Using Express JSON middleware');
app.use(express.json());

server(app, log, Utils, Constants);

app.listen(process.env.PORT || 8080);
log.info('OVE Core started');
