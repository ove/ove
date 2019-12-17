const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const HttpStatus = require('http-status-codes');
const app = express();

module.exports = function (baseDir, appName) {
    // Usually the baseDir is a string, but in some situations it may be required to pass
    // the entire dir structure, for example, when node_modules are located elsewhere.
    const dirs = typeof baseDir === 'string' ? {
        base: baseDir,
        nodeModules: path.join(baseDir, '..', '..', '..', 'node_modules'),
        constants: path.join(baseDir, 'client', 'constants'),
        rootPage: path.join(__dirname, 'landing.html')
    } : baseDir;
    const { Constants, Utils } = require('@ove-lib/utils')(appName, app, dirs);
    const log = Utils.Logger(appName);
    const configPath = path.join(dirs.base, 'config.json');

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

    const getClock = function () {
        let clock = {
            uuid: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                let r = Math.random() * 16 | 0;
                let v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            })
        };
        let __self = {};

        __self.init = function () {
            if (!clock.syncResults) {
                clock.syncResults = [];
            }
            if (clock.syncResults.length < Constants.CLOCK_SYNC_ATTEMPTS) {
                /* istanbul ignore next */
                const clockSyncRequest = function () {
                    // Our tests do not wait for the timeout for this code to run
                    // The functionality of safeSend is tested elsewhere.
                    try {
                        clock.socket.safeSend(JSON.stringify({
                            appId: Constants.APP_NAME,
                            sync: { id: clock.uuid }
                        }));
                    } catch (e) {} // ignore all errors, since there is no value in recording them.
                };
                // We trigger a clock-sync 5 times within a 2 minute period.
                for (let i = 0; i < Constants.CLOCK_SYNC_ATTEMPTS; i++) {
                    // If we lost socket connection in between syncs, we may have already
                    // made some sync requests.
                    if (clock.syncResults.length + i < Constants.CLOCK_SYNC_ATTEMPTS) {
                        setTimeout(clockSyncRequest, Math.random() *
                            (Constants.CLOCK_SYNC_INTERVAL / Constants.CLOCK_SYNC_ATTEMPTS) | 0);
                    }
                }
            }
        };

        __self.sync = function (data) {
            if (data.sync) {
                if (!data.sync.t2) {
                    try {
                        clock.socket.safeSend(JSON.stringify({
                            appId: data.appId,
                            sync: {
                                id: data.sync.id,
                                serverDiff: data.sync.serverDiff,
                                t1: new Date().getTime()
                            }
                        }));
                    } catch (e) {} // ignore all errors, since there is no value in recording them.
                } else {
                    // We must construct the sync result similar to the server, to avoid differences.
                    let syncResult = {
                        appId: data.appId,
                        sync: {
                            id: data.sync.id,
                            serverDiff: data.sync.serverDiff,
                            t3: new Date().getTime(),
                            t2: data.sync.t2,
                            t1: data.sync.t1
                        }
                    };
                    // Always broadcast a difference as an integer
                    let diff = ((syncResult.sync.t1 + syncResult.sync.t3) / 2 -
                        syncResult.sync.t2 - syncResult.sync.serverDiff) | 0;
                    /* istanbul ignore if */
                    // This scenario would not occur during test
                    if (clock.diff) {
                        diff -= clock.diff;
                    }
                    clock.syncResults.push({ id: data.sync.id, diff: diff });
                    log.trace('Clock skew detection attempt:', clock.syncResults.length, 'difference:', diff);
                    if (clock.syncResults.length === Constants.CLOCK_SYNC_ATTEMPTS) {
                        try {
                            clock.socket.safeSend(JSON.stringify({
                                appId: Constants.APP_NAME,
                                syncResults: clock.syncResults
                            }));
                        } catch (e) {} // ignore all errors, since there is no value in recording them.
                    }
                }
                log.trace('Responded to sync request');
                return true;
            } else if (data.clockDiff) {
                let diff = data.clockDiff[clock.uuid];
                clock.diff = (clock.diff || 0) + diff;
                log.debug('Got a clock difference of:', diff);
                /* istanbul ignore if */
                // This scenario would not occur during test
                if (diff) {
                    clock.syncResults = [];
                    this.init();
                }
                return true;
            } else if (data.clockReSync) {
                clock.syncResults = [];
                this.init();
                return true;
            }
            return false;
        };

        __self.getTime = function () {
            return new Date().getTime() - (clock.diff || 0);
        };

        __self.setWS = function (socket) {
            clock.socket = socket;
        };

        return __self;
    };
    module.exports.clock = getClock();

    const validateState = function (state, combinations) {
        let valid = true;
        // Example rules:
        // 1. An optional property which is a literal.
        // {
        //     prefix: ['state', 'state.a']
        // }
        // 2. An optional property which is an object. x and y are mandatory properties of this object.
        // {
        //     prefix: ['state', 'state.a'],
        //     value: ['state.a.x', 'state.a.y']
        // }
        // 3. All mandatory properties - literals and objects
        // {
        //     value: ['state.a', 'state.b', 'state.b.x']
        // }
        combinations.forEach(function (e) {
            let prefixExists = !Utils.isNullOrEmpty(Utils.JSON.getDescendant('state', { state: state }));
            (e.prefix || []).forEach(function (x) {
                prefixExists = prefixExists && !Utils.isNullOrEmpty(Utils.JSON.getDescendant(x, { state: state }));
            });
            if (!prefixExists) {
                return;
            }
            let result = true;
            if (e.value) {
                e.value.forEach(function (x) {
                    result = result && !Utils.isNullOrEmpty(Utils.JSON.getDescendant(x, { state: state }));
                });
            }
            valid = valid && result;
        });
        return valid;
    };

    // Exported functionality from Utils
    module.exports.Utils = {
        JSON: Utils.JSON,
        getOVEHost: Utils.getOVEHost,
        getSafeSocket: Utils.getSafeSocket,
        sendMessage: Utils.sendMessage,
        sendEmptySuccess: Utils.sendEmptySuccess,
        isNullOrEmpty: Utils.isNullOrEmpty,
        validateState: validateState
    };

    Utils.registerRoutesForPersistence();
    const appState = module.exports.appState = Utils.Persistence;

    /**************************************************************
               APIs Exposed by all Apps (required by OVE)
    **************************************************************/
    appState.set('state', []);

    // Utility method to update named state
    const _updateNamedState = function (name, state) {
        if (!module.exports.operations.validateState || module.exports.operations.validateState(state)) {
            module.exports.config.states[name] = state;
        } else {
            log.error('Unable to update invalid state:', state, 'with name:', name);
        }
    };

    // Utility method to update state of section
    const _updateStateOfSection = function (sectionId, state) {
        if (!module.exports.operations.validateState || module.exports.operations.validateState(state)) {
            appState.set('state[' + sectionId + ']', state);
        } else {
            log.error('Unable to update invalid state:', state, 'in section:', sectionId);
        }
    };

    const createStateByName = function (req, res) {
        log.info('Creating named state:', req.params.name);
        if (Constants.Logging.DEBUG) {
            log.debug('Got state configuration:', JSON.stringify(req.body));
        }
        _updateNamedState(req.params.name, req.body);
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
        if (Utils.isNullOrEmpty(req.body) && !req.is('json')) {
            log.warn('Invalid content type. Ignoring request');
            Utils.sendMessage(res, HttpStatus.UNSUPPORTED_MEDIA_TYPE, JSON.stringify({ error: 'invalid content type' }));
        } else {
            log.debug('Updating state of section:', req.params.id);
            _updateStateOfSection(req.params.id, req.body);
            Utils.sendEmptySuccess(res);
        }
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
            _updateNamedState(req.params.name, _transformState(namedState, req.body, res));
        }
    };

    const transformStateOfSection = function (req, res) {
        const state = appState.get('state[' + req.params.id + ']');
        if (Utils.isNullOrEmpty(state)) {
            log.error('No state configurations found for section:', req.params.id);
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid section id' }));
        } else {
            _updateStateOfSection(req.params.id, _transformState(state, req.body, res));
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

    const flush = function (req, res) {
        const sectionId = req.params.id;
        if (sectionId || sectionId === 0) {
            const states = appState.get('state');
            if (states[sectionId]) {
                delete states[sectionId];
            }
            let hasMoreStates = false;
            states.forEach(function (e) {
                hasMoreStates = hasMoreStates || e;
            });
            if (hasMoreStates) {
                appState.set('state', states);
                log.debug('Flushing state of section', sectionId);
                Utils.sendEmptySuccess(res);
                return;
            }
        }
        log.debug('Flushing application');
        appState.set('state', []);
        if (fs.existsSync(Constants.CONFIG_JSON_PATH(appName))) {
            module.exports.config = JSON.parse(
                fs.readFileSync(Constants.CONFIG_JSON_PATH(appName), Constants.UTF8));
        } else if (fs.existsSync(configPath)) {
            module.exports.config = JSON.parse(fs.readFileSync(configPath, Constants.UTF8));
        } else {
            module.exports.config = [];
        }
        Utils.sendEmptySuccess(res);
    };

    const name = function (_req, res) {
        return Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(appName));
    };

    app.get('/states/:name', readStateByName);
    app.post('/states/:name', createStateByName);
    app.delete('/states/:name', deleteStateByName);
    app.post('/states/:name/transform', transformStateByName);
    app.post('/states/:name/diff', diffForStateByName);
    app.get('/states', readStateNames);
    app.get('/instances/:id/state', readStateOfSection);
    app.post('/instances/:id/state', updateStateOfSection);
    app.post('/instances/:id/state/transform', transformStateOfSection);
    app.post('/instances/:id/state/diff', diffForStateOfSection);
    app.post('/diff', diff);
    app.post('/instances/flush', flush);
    app.post('/instances/:id/flush', flush);
    app.get('/name', name);

    // Swagger API documentation
    const swaggerPath = path.join(__dirname, 'swagger.yaml');
    const packagePath = path.join(dirs.base, '..', 'package.json');
    const swaggerExtPath = path.join(dirs.base, 'swagger-extensions.yaml');
    Utils.buildAPIDocs(swaggerPath, packagePath, swaggerExtPath);

    /**************************************************************
                    Embedded Data and Static Content
    **************************************************************/
    app.use('/data', express.static(path.join(dirs.base, 'data')));

    Utils.registerRoutesForContent(fs.existsSync(packagePath) ? require(packagePath) : null);
    app.use('/', express.static(path.join(dirs.base, 'client')));

    return module.exports;
};
