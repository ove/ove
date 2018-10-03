const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const HttpStatus = require('http-status-codes');
const app = express();

module.exports = function (baseDir, appName) {
    const dirs = {
        base: baseDir,
        nodeModules: path.join(baseDir, '..', '..', '..', 'node_modules'),
        constants: path.join(baseDir, 'client', 'constants')
    };
    const { Constants, Utils } = require('@ove-lib/utils')(app, appName, dirs);
    const log = Utils.Logger(appName);

    log.debug('Starting application:', appName);
    log.debug('Application directories:', JSON.stringify(dirs));
    log.debug('Using CORS middleware');
    app.use(cors());
    log.debug('Using Express JSON middleware');
    app.use(express.json());

    module.exports.express = express;
    module.exports.app = app;
    module.exports.config = JSON.parse(fs.readFileSync(path.join(baseDir, 'config.json'), Constants.UTF8));
    module.exports.nodeModules = dirs.nodeModules;
    module.exports.log = log;

    // Exported functionality from Utils
    module.exports.Utils = {
        JSON: Utils.JSON,
        sendMessage: Utils.sendMessage,
        sendEmptySuccess: Utils.sendEmptySuccess,
        isNullOrEmpty: Utils.isNullOrEmpty
    };

    /**************************************************************
               APIs Exposed by all Apps (required by OVE)
    **************************************************************/
    var state = [];

    const createStateByName = function (req, res) {
        log.info('Creating named state:', req.params.name);
        if (Constants.Logging.DEBUG) {
            log.debug('Got state configuration:', JSON.stringify(req.body));
        }
        module.exports.config.states[req.params.name] = req.body;
        Utils.sendEmptySuccess(res);
    };

    const readStateByName = function (req, res) {
        const namedState = module.exports.config.states[req.params.name];
        if (!namedState) {
            log.error('Invalid state name:', req.params.name);
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid state name' }));
        } else {
            log.debug('Reading state by name:', req.params.name);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(namedState));
        }
    };

    const readState = function (_req, res) {
        if (state.length > 0) {
            log.debug('Reading state configuration');
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(state));
        } else {
            log.debug('No state configurations found');
            res.sendStatus(HttpStatus.NO_CONTENT);
        }
    };

    const readStateOfSection = function (req, res) {
        if (state[req.params.id]) {
            log.debug('Reading state configuration for section:', req.params.id);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(state[req.params.id]));
        } else {
            log.debug('No state configurations found for section:', req.params.id);
            res.sendStatus(HttpStatus.NO_CONTENT);
        }
    };

    const updateStateOfSection = function (req, res) {
        log.debug('Updating state of section:', req.params.id);
        state[req.params.id] = req.body;
        Utils.sendEmptySuccess(res);
    };

    const flush = function (_req, res) {
        log.debug('Flushing application');
        state = [];
        module.exports.config = JSON.parse(fs.readFileSync(path.join(baseDir, 'config.json'), Constants.UTF8));
        Utils.sendEmptySuccess(res);
    };

    app.post('/state/:name', createStateByName);
    app.get('/state/:name', readStateByName);
    app.get('/state', readState);
    app.get('/:id/state', readStateOfSection);
    app.post('/:id/state', updateStateOfSection);
    app.post('/flush', flush);

    // Swagger API documentation
    const swaggerPath = path.join(__dirname, 'swagger.yaml');
    const packagePath = path.join(baseDir, '..', 'package.json');
    const swaggerExtPath = path.join(baseDir, 'swagger-extensions.yaml');
    Utils.buildAPIDocs(swaggerPath, packagePath, swaggerExtPath);

    /**************************************************************
                    Embedded Data and Static Content
    **************************************************************/
    app.use('/data', express.static(path.join(baseDir, 'data')));

    Utils.registerRoutesForContent();
    app.use('/', express.static(path.join(baseDir, 'client')));

    return module.exports;
};
