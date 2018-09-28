const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const HttpStatus = require('http-status-codes');
const app = express();
const swaggerUi = require('swagger-ui-express');
const yamljs = require('yamljs');

module.exports = function (baseDir, appName) {
    app.use(express.json());
    app.use(cors());

    module.exports.express = express;
    module.exports.app = app;
    module.exports.nodeModules = path.join(baseDir, '..', '..', '..', 'node_modules');
    module.exports.config = JSON.parse(fs.readFileSync(path.join(baseDir, 'config.json'), 'utf8'));

    /**************************************************************
               APIs Exposed by all Apps (required by OVE)
    **************************************************************/
    var state = [];

    const sendMessage = function (res, status, msg) {
        res.status(status).set('Content-Type', 'application/json').send(msg);
    };

    // We don't want to see browser errors, so we send an empty success response in some cases.
    const sendEmptySuccess = function (res) {
        sendMessage(res, HttpStatus.OK, JSON.stringify({}));
    };

    const createStateByName = function (req, res) {
        module.exports.config.states[req.params.name] = req.body;
        sendEmptySuccess();
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
        sendEmptySuccess();
    };

    const flush = function (_req, res) {
        state = [];
        module.exports.config = JSON.parse(fs.readFileSync(path.join(baseDir, 'config.json'), 'utf8'));
        sendEmptySuccess();
    };

    app.post('/state/:name', createStateByName);
    app.get('/state/:name', readStateByName);
    app.get('/state', readState);
    app.get('/:id/state', readStateOfSection);
    app.post('/:id/state', updateStateOfSection);
    app.post('/flush', flush);

    const swaggerPath = path.join(baseDir, '..', 'node_modules', '@ove', 'ove-app-base', 'lib', 'swagger.yaml');
    const swaggerExtPath = path.join(baseDir, 'swagger-extensions.yaml');
    const packagePath = path.join(baseDir, '..', 'package.json');
    // Swagger API documentation
    let swaggerDoc = (function (swagger, pjson) {
        swagger.info.title = swagger.info.title.replace('@NAME', pjson.name);
        swagger.info.version = swagger.info.version.replace('@VERSION', pjson.version);
        swagger.info.license.name = swagger.info.license.name.replace('@LICENSE', pjson.license);
        swagger.info.contact.email = swagger.info.contact.email.replace('@AUTHOR',
            pjson.author.substring(pjson.author.indexOf('<') + 1, pjson.author.indexOf('>')));
        return swagger;
    })(yamljs.load(swaggerPath), require(packagePath));
    // App-specific swagger extensions
    (function (swaggerDoc, swaggerExt) {
        if (fs.existsSync(swaggerExt)) {
            let swagger = yamljs.load(swaggerExt);
            swagger.tags.forEach(function (e) {
                swaggerDoc.tags.push(e);
            });
            Object.keys(swagger.paths).forEach(function (e) {
                swaggerDoc.paths[e] = swagger.paths[e];
            });
        }
    })(swaggerDoc, swaggerExtPath);
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc, {
        swaggerOptions: {
            defaultModelsExpandDepth: -1
        }
    }));

    /**************************************************************
                    Static Content and Embedded Data
    **************************************************************/
    app.use('/data', express.static(path.join(baseDir, 'data')));
    // Each CSS file is combination of {type}/{name}.css and common/{name}.css.
    // Each JS file is combination of {type}/{name}.js, common/{name}.js and
    // constants/{name}.js files from the filesystem.
    app.use('/' + appName + '.:type.:fileType(js|css)', function (req, res) {
        let text = '';
        const type = req.params.type === 'control' ? 'control' : 'view';
        const fileName = appName + '.' + req.params.fileType;
        for (const context of ['common', type]) {
            const fp = path.join(baseDir, 'client', context, fileName);
            if (fs.existsSync(fp)) {
                text += fs.readFileSync(fp, 'utf8');
            }
        }
        let cType;
        switch (req.params.fileType) {
            case 'js':
                const fp = path.join(baseDir, 'client', 'constants', fileName);
                if (fs.existsSync(fp)) {
                    text = fs.readFileSync(fp, 'utf8').replace('exports.Constants = Constants;', '') + text;
                }
                cType = 'application/javascript';
                break;
            case 'css':
                cType = 'text/css';
                break;
            default:
                // This should not happen since the fileType is either CSS or JS.
        }
        res.set('Content-Type', cType).send(text);
    });
    // Each app can serve view, control or index HTML pages. The index.html page or '/' is
    // redirected to the view.html page. It must also be noted that neither view.html or
    // control.html exists on the filesystem and the same index.html file is served for
    // both of these scenarios. The index.html file is therefore a common template for both
    // viewer and controller.
    app.use('/(:fileName(index|control|view).html)?', function (req, res) {
        res.send(fs.readFileSync(path.join(baseDir, 'client', 'index.html'), 'utf8')
            .replace(/_OVETYPE_/g, req.params.fileName === 'control' ? 'control' : 'view')
            .replace(/_OVEHOST_/g, process.env.OVE_HOST));
    });
    app.use('/', express.static(path.join(baseDir, 'client')));
    app.use('/', express.static(path.join(module.exports.nodeModules, 'jquery', 'dist')));

    return module.exports;
};
