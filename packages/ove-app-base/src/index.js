const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const app = express();

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

    var createStateByName = function (req, res, next) {
        module.exports.config.states[req.params.name] = req.body;
        res.sendStatus(200);
    };

    var readStateByName = function (req, res, next) {
        if (!module.exports.config.states[req.params.name]) {
            res.status(400).set('Content-Type', 'application/json').send(JSON.stringify({ error: 'invalid state name' }));
        }
        res.status(200).set('Content-Type', 'application/json').send(
            JSON.stringify(module.exports.config.states[req.params.name]));
    };

    var readState = function (req, res, next) {
        if (state.length > 0) {
            res.status(200).set('Content-Type', 'application/json').send(JSON.stringify(state));
        } else {
            res.sendStatus(204);
        }
    };

    var readStateOfSection = function (req, res, next) {
        if (state[req.params.id]) {
            res.status(200).set('Content-Type', 'application/json').send(JSON.stringify(state[req.params.id]));
        } else {
            res.sendStatus(204);
        }
    };

    var updateStateOfSection = function (req, res, next) {
        state[req.params.id] = req.body;
        res.sendStatus(200);
    };

    var flush = function (req, res, next) {
        state = [];
        module.exports.config = JSON.parse(fs.readFileSync(path.join(baseDir, 'config.json'), 'utf8'));
        res.sendStatus(200);
    };

    app.post('/state/:name', createStateByName);
    app.get('/state/:name', readStateByName);
    app.get('/state', readState);
    app.get('/:id/state', readStateOfSection);
    app.post('/:id/state', updateStateOfSection);
    app.use('/flush', flush);

    /**************************************************************
                    Static Content and Embedded Data
    **************************************************************/
    app.use('/data', express.static(path.join(baseDir, 'data')));
    app.use('/:fileName(' + appName + ').:type.:fileType(js|css)', function (req, res, next) {
        let text = '';
        let type = req.params.type == 'control' ? 'control' : 'view';
        for (let context of ['common', type]) {
            let fp = path.join(baseDir, 'client', context, req.params.fileName + '.' + req.params.fileType);
            if (fs.existsSync(fp)) {
                text += fs.readFileSync(fp, 'utf8');
            }
        }
        let cType;
        switch (req.params.fileType) {
            case 'js':
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
    app.use('/:fileName(index|control|view).html', function (req, res, next) {
        res.send(fs.readFileSync(path.join(baseDir, 'client', 'index.html'), 'utf8')
            .replace(/_OVETYPE_/g, req.params.fileName == 'control' ? 'control' : 'view')
            .replace(/_OVEHOST_/g, process.env.OVE_HOST));
    });
    app.use('/', express.static(path.join(baseDir, 'client')));
    app.use('/', express.static(path.join(module.exports.nodeModules, 'jquery', 'dist')));

    return module.exports;
};
