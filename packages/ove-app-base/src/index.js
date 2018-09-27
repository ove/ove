const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
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

    var createStateByName = function (req, res) {
        module.exports.config.states[req.params.name] = req.body;
        res.status(200).set('Content-Type', 'application/json').send(JSON.stringify({}));
    };

    var readStateByName = function (req, res) {
        if (!module.exports.config.states[req.params.name]) {
            res.status(400).set('Content-Type', 'application/json').send(
                JSON.stringify({ error: 'invalid state name' }));
        } else {
            res.status(200).set('Content-Type', 'application/json').send(
                JSON.stringify(module.exports.config.states[req.params.name]));
        }
    };

    var readState = function (_req, res) {
        if (state.length > 0) {
            res.status(200).set('Content-Type', 'application/json').send(JSON.stringify(state));
        } else {
            res.sendStatus(204);
        }
    };

    var readStateOfSection = function (req, res) {
        if (state[req.params.id]) {
            res.status(200).set('Content-Type', 'application/json').send(JSON.stringify(state[req.params.id]));
        } else {
            res.sendStatus(204);
        }
    };

    var updateStateOfSection = function (req, res) {
        state[req.params.id] = req.body;
        res.status(200).set('Content-Type', 'application/json').send(JSON.stringify({}));
    };

    var flush = function (_req, res) {
        state = [];
        module.exports.config = JSON.parse(fs.readFileSync(path.join(baseDir, 'config.json'), 'utf8'));
        res.status(200).set('Content-Type', 'application/json').send(JSON.stringify({}));
    };

    app.post('/state/:name', createStateByName);
    app.get('/state/:name', readStateByName);
    app.get('/state', readState);
    app.get('/:id/state', readStateOfSection);
    app.post('/:id/state', updateStateOfSection);
    app.post('/flush', flush);

    // Swagger API documentation
    let swaggerDoc = (function (swagger, pjson) {
        swagger.info.title = swagger.info.title.replace('@NAME', pjson.name);
        swagger.info.version = swagger.info.version.replace('@VERSION', pjson.version);
        swagger.info.license.name = swagger.info.license.name.replace('@LICENSE', pjson.license);
        swagger.info.contact.email = swagger.info.contact.email.replace('@AUTHOR',
            pjson.author.substring(pjson.author.indexOf('<') + 1, pjson.author.indexOf('>')));
        return swagger;
    })(yamljs.load(path.join(baseDir, '..', 'node_modules', '@ove', 'ove-app-base', 'lib', 'swagger.yaml')),
        require(path.join(baseDir, '..', 'package.json')));
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
    })(swaggerDoc, path.join(baseDir, 'swagger-extensions.yaml'));
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc, {
        swaggerOptions: {
            defaultModelsExpandDepth: -1
        }
    }));

    /**************************************************************
                    Static Content and Embedded Data
    **************************************************************/
    app.use('/data', express.static(path.join(baseDir, 'data')));
    app.use('/:fileName(' + appName + ').:type.:fileType(js|css)', function (req, res) {
        let text = '';
        let type = req.params.type === 'control' ? 'control' : 'view';
        for (let context of ['common', type]) {
            let fp = path.join(baseDir, 'client', context, req.params.fileName + '.' + req.params.fileType);
            if (fs.existsSync(fp)) {
                text += fs.readFileSync(fp, 'utf8');
            }
        }
        let cType;
        switch (req.params.fileType) {
            case 'js':
                let fp = path.join(baseDir, 'client', 'constants', req.params.fileName + '.' + req.params.fileType);
                if (fs.existsSync(fp)) {
                    text = fs.readFileSync(fp, 'utf8').replace('exports.Constants = Constants;', '') + text;
                }
                cType = 'application/javascript';
                break;
            case 'css':
                cType = 'text/css';
                break;
            default:
                cType = 'text/html';
        }
        res.set('Content-Type', cType).send(text);
    });
    app.use('/(:fileName(index|control|view).html)?', function (req, res) {
        res.send(fs.readFileSync(path.join(baseDir, 'client', 'index.html'), 'utf8')
            .replace(/_OVETYPE_/g, req.params.fileName === 'control' ? 'control' : 'view')
            .replace(/_OVEHOST_/g, process.env.OVE_HOST));
    });
    app.use('/', express.static(path.join(baseDir, 'client')));
    app.use('/', express.static(path.join(module.exports.nodeModules, 'jquery', 'dist')));

    return module.exports;
};
