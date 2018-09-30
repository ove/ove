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
    const { Constants, Utils } = require('@ove/ove-lib-utils')(app, appName, dirs);

    app.use(express.json());
    app.use(cors());

    module.exports.express = express;
    module.exports.app = app;
    module.exports.config = JSON.parse(fs.readFileSync(path.join(baseDir, 'config.json'), Constants.UTF8));
    module.exports.nodeModules = dirs.nodeModules;

    /**************************************************************
               APIs Exposed by all Apps (required by OVE)
    **************************************************************/
    var state = [];

    const sendMessage = function (res, status, msg) {
        res.status(status).set(Constants.HTTP_HEADER_CONTENT_TYPE, Constants.HTTP_CONTENT_TYPE_JSON).send(msg);
    };

    // We don't want to see browser errors, so we send an empty success response in some cases.
    const sendEmptySuccess = function (res) {
        sendMessage(res, HttpStatus.OK, JSON.stringify({}));
    };

    const createStateByName = function (req, res) {
        module.exports.config.states[req.params.name] = req.body;
        sendEmptySuccess(res);
    };

    const readStateByName = function (req, res) {
        const namedState = module.exports.config.states[req.params.name];
        if (!namedState) {
            sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid state name' }));
        } else {
            sendMessage(res, HttpStatus.OK, JSON.stringify(namedState));
        }
    };

    const readState = function (_req, res) {
        if (state.length > 0) {
            sendMessage(res, HttpStatus.OK, JSON.stringify(state));
        } else {
            res.sendStatus(HttpStatus.NO_CONTENT);
        }
    };

    const readStateOfSection = function (req, res) {
        if (state[req.params.id]) {
            sendMessage(res, HttpStatus.OK, JSON.stringify(state[req.params.id]));
        } else {
            res.sendStatus(HttpStatus.NO_CONTENT);
        }
    };

    const updateStateOfSection = function (req, res) {
        state[req.params.id] = req.body;
        sendEmptySuccess(res);
    };

    const flush = function (_req, res) {
        state = [];
        module.exports.config = JSON.parse(fs.readFileSync(path.join(baseDir, 'config.json'), Constants.UTF8));
        sendEmptySuccess(res);
    };

    app.post('/state/:name', createStateByName);
    app.get('/state/:name', readStateByName);
    app.get('/state', readState);
    app.get('/:id/state', readStateOfSection);
    app.post('/:id/state', updateStateOfSection);
    app.post('/flush', flush);

    // Swagger API documentation
    const swaggerPath = path.join(baseDir, '..', 'node_modules', '@ove', 'ove-lib-appbase', 'lib', 'swagger.yaml');
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
