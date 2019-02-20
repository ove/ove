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
        constants: path.join(baseDir, 'client', 'constants'),
        rootPage: path.join(__dirname, 'landing.html')
    };
    const { Constants, Utils } = require('@ove-lib/utils')(appName, app, dirs);
    const log = Utils.Logger(appName);
    const configPath = path.join(baseDir, 'config.json');

    log.debug('Starting application:', appName);
    log.debug('Application directories:', JSON.stringify(dirs));
    log.debug('Using CORS middleware');
    app.use(cors());
    log.debug('Using Express JSON middleware');
    app.use(express.json());

    module.exports.express = express;
    module.exports.app = app;
    if (fs.existsSync(Constants.CONFIG_JSON_PATH(appName))) {
        module.exports.config = JSON.parse(
            fs.readFileSync(Constants.CONFIG_JSON_PATH(appName), Constants.UTF8));
    } else if (fs.existsSync(configPath)) {
        module.exports.config = JSON.parse(fs.readFileSync(configPath, Constants.UTF8));
    } else {
        module.exports.config = [];
    }
    module.exports.nodeModules = dirs.nodeModules;
    module.exports.log = log;
    module.exports.operations = {};

    // Exported functionality from Utils
    module.exports.Utils = {
        JSON: Utils.JSON,
        getOVEHost: Utils.getOVEHost,
        getSafeSocket: Utils.getSafeSocket,
        sendMessage: Utils.sendMessage,
        sendEmptySuccess: Utils.sendEmptySuccess,
        isNullOrEmpty: Utils.isNullOrEmpty
    };

    Utils.registerRoutesForPersistence();
    const appState = module.exports.appState = Utils.Persistence;

    /**************************************************************
               APIs Exposed by all Apps (required by OVE)
    **************************************************************/
    appState.set('state', []);

    const createStateByName = function (req, res) {
        log.info('Creating named state:', req.params.name);
        if (Constants.Logging.DEBUG) {
            log.debug('Got state configuration:', JSON.stringify(req.body));
        }
        module.exports.config.states[req.params.name] = req.body;
        Utils.sendEmptySuccess(res);
    };

    const deleteStateByName = function (req, res) {
        const namedState = module.exports.config.states[req.params.name];
        if (!namedState) {
            log.error('Invalid state name:', req.params.name);
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid state name' }));
        } else {
            log.debug('Deleting named state:', req.params.name);
            delete module.exports.config.states[req.params.name];
            Utils.sendEmptySuccess(res);
        }
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
        const state = appState.get('state');
        if (state.length > 0) {
            log.debug('Reading state configuration');
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(state));
        } else {
            log.debug('No state configurations found');
            res.sendStatus(HttpStatus.NO_CONTENT);
        }
    };

    const readStateNames = function (_req, res) {
        log.debug('Reading list of named states');
        Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(Object.keys(module.exports.config.states)));
    };

    const readStateOfSection = function (req, res) {
        const state = appState.get('state[' + req.params.id + ']');
        if (state) {
            log.debug('Reading state configuration for section:', req.params.id);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(state));
        } else {
            log.debug('No state configurations found for section:', req.params.id);
            res.sendStatus(HttpStatus.NO_CONTENT);
        }
    };

    const updateStateOfSection = function (req, res) {
        log.debug('Updating state of section:', req.params.id);
        appState.set('state[' + req.params.id + ']', req.body);
        Utils.sendEmptySuccess(res);
    };

    // Internal utility function to transform a state
    const _transformState = function (state, transformation, res) {
        if (!module.exports.operations.canTransform || !module.exports.operations.transform) {
            log.warn('Transform State operation not implemented by application');
            Utils.sendMessage(res, HttpStatus.NOT_IMPLEMENTED, JSON.stringify({ error: 'operation not implemented' }));
            return state;
        } else if (Utils.isNullOrEmpty(transformation)) {
            log.error('Transformation not provided');
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid transformation' }));
            return state;
        } else if (!module.exports.operations.canTransform(state, transformation)) {
            log.error('Unable to apply transformation:', transformation);
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid transformation' }));
            return state;
        }
        const result = module.exports.operations.transform(state, transformation);
        log.info('Successfully transformed state');
        log.debug('Transformed state from:', state, 'into:', result, 'using transformation:', transformation);
        Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(result));
        return result;
    };

    const transformStateByName = function (req, res) {
        const namedState = module.exports.config.states[req.params.name];
        if (Utils.isNullOrEmpty(namedState)) {
            log.error('No state configurations found for section:', req.params.name);
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid state name' }));
        } else {
            module.exports.config.states[req.params.name] = _transformState(namedState, req.body, res);
        }
    };

    const transformStateOfSection = function (req, res) {
        const state = appState.get('state[' + req.params.id + ']');
        if (Utils.isNullOrEmpty(state)) {
            log.error('No state configurations found for section:', req.params.id);
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid section id' }));
        } else {
            appState.set('state[' + req.params.id + ']', _transformState(state, req.body, res));
        }
    };

    // Internal utility function to calculate difference between two states
    const _diff = function (source, target, res) {
        if (!module.exports.operations.canDiff || !module.exports.operations.diff) {
            log.warn('Difference operation not implemented by application');
            Utils.sendMessage(res, HttpStatus.NOT_IMPLEMENTED, JSON.stringify({ error: 'operation not implemented' }));
        } else if (Utils.isNullOrEmpty(target)) {
            log.error('Target state not provided');
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid states' }));
        } else if (!module.exports.operations.canDiff(source, target)) {
            log.error('Unable to get difference from source:', source, 'to target:', target);
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid states' }));
        } else {
            const result = module.exports.operations.diff(source, target);
            log.debug('Successfully computed difference', result, 'from source:', source, 'to target:', target);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(result));
        }
    };

    const diffForStateByName = function (req, res) {
        const namedState = module.exports.config.states[req.params.name];
        if (Utils.isNullOrEmpty(namedState)) {
            log.debug('No state configurations found for section:', req.params.id);
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid state name' }));
        } else {
            _diff(namedState, req.body.target, res);
        }
    };

    const diffForStateOfSection = function (req, res) {
        const state = appState.get('state[' + req.params.id + ']');
        if (Utils.isNullOrEmpty(state)) {
            log.debug('No state configurations found for section:', req.params.id);
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid section id' }));
        } else {
            _diff(state, req.body.target, res);
        }
    };

    const diff = function (req, res) {
        if (Utils.isNullOrEmpty(req.body.source)) {
            log.error('Source state not provided');
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid states' }));
        } else {
            _diff(req.body.source, req.body.target, res);
        }
    };

    const flush = function (_req, res) {
        log.debug('Flushing application');
        appState.set('state', []);
        if (fs.existsSync(configPath)) {
            module.exports.config = JSON.parse(fs.readFileSync(configPath, Constants.UTF8));
        } else {
            module.exports.config = [];
        }
        Utils.sendEmptySuccess(res);
    };

    const name = function (_req, res) {
        return Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(appName));
    };

    app.get('/state/:name', readStateByName);
    app.post('/state/:name', createStateByName);
    app.delete('/state/:name', deleteStateByName);
    app.post('/state/:name/transform', transformStateByName);
    app.post('/state/:name/diff', diffForStateByName);
    app.get('/state', readState);
    app.get('/states', readStateNames);
    app.get('/:id/state', readStateOfSection);
    app.post('/:id/state', updateStateOfSection);
    app.post('/:id/state/transform', transformStateOfSection);
    app.post('/:id/state/diff', diffForStateOfSection);
    app.post('/diff', diff);
    app.post('/flush', flush);
    app.get('/name', name);

    // Swagger API documentation
    const swaggerPath = path.join(__dirname, 'swagger.yaml');
    const packagePath = path.join(baseDir, '..', 'package.json');
    const swaggerExtPath = path.join(baseDir, 'swagger-extensions.yaml');
    Utils.buildAPIDocs(swaggerPath, packagePath, swaggerExtPath);

    /**************************************************************
                    Embedded Data and Static Content
    **************************************************************/
    app.use('/data', express.static(path.join(baseDir, 'data')));

    Utils.registerRoutesForContent(fs.existsSync(packagePath) ? require(packagePath) : null);
    app.use('/', express.static(path.join(baseDir, 'client')));

    return module.exports;
};
