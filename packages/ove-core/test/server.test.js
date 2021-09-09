const path = require('path');
const fs = require('fs');
const request = require('supertest');
const express = require('express');
const cors = require('cors');
const HttpStatus = require('http-status-codes');
const nock = require('nock');

const app = express();
const wss = require('express-ws')(app).getWss('/');

// Do not expose console during init.
const OLD_CONSOLE = global.console;
global.console = { log: jest.fn(x => x), warn: jest.fn(x => x), error: jest.fn(x => x) };

// We always test against the distribution not the source.
const srcDir = path.join(__dirname, '..', 'src');
const dirs = {
    base: srcDir,
    nodeModules: path.join(srcDir, '..', '..', '..', 'node_modules'),
    constants: path.join(srcDir, 'client', 'utils'),
    rootPage: path.join(srcDir, 'landing.html')
};
const { Constants, Utils } = require('@ove-lib/utils')('core', app, dirs);
const log = Utils.Logger('OVE');
app.use(cors());

app.use(express.json());
const spaces = JSON.parse(fs.readFileSync(path.join(srcDir, '..', 'test', 'resources', Constants.SPACES_JSON_FILENAME)));

const server = require(path.join(srcDir, 'server', 'main'))(app, wss, spaces, log, Utils, Constants);

const _createConnection = (secondary) => {
    _nock(8080, 'GET', '/api/isSecondary');
    _nock(8080, 'GET', '/api/isConnected');
    _nock(8080, 'POST', '/api/updateConnection');
    _nock(8080, 'POST', '/api/updateConnectionState');
    _nock(8080, 'DELETE', `/sections?space=${secondary}`);
};

const _duplicateSection = (primary, secondary) => {
    secondary.forEach(s => {
        _nock(8080, 'GET', `/spaces/${primary}/geometry`);
        _nock(8080, 'GET', `/spaces/${s}/geometry`);
        _nock(8080, 'POST', '/section');
        _nock(8080, 'POST', '/api/updateConnectionState');
    });
};

const _forwardNock = async (type, url, body) => {
    let res;
    if (type === 'GET') {
        res = await request(app).get(url).send(body);
    } else if (type === 'POST') {
        res = await request(app).post(url).send(body);
    } else {
        res = await request(app).delete(url).send(body);
    }
    return [res.statusCode, res.text, res.headers];
};

const _nock = (port, type, url) => {
    let scope = nock(`http://localhost:${port}`);
    const holder = {};
    if (type === 'GET') {
        scope = scope.get(url, _bodySnatching.bind(null, holder));
    } else if (type === 'POST') {
        scope = scope.post(url, _bodySnatching.bind(null, holder));
    } else {
        scope = scope.delete(url, _bodySnatching.bind(null, holder));
    }
    scope.reply(async (uri, body, cb) => cb(null, await _forwardNock(type, url, holder.body)));
};

const _bodySnatching = (holder, body) => {
    holder.body = body;
    return true;
};

const TestUtils = {
    createConnection: _createConnection,
    duplicateSection: _duplicateSection,
    nock: _nock
};

// All variables are set in the global scope so that they can then be used appropriately in the test files.
global.path = path;
global.fs = fs;
global.request = request;
global.express = express;
global.cors = cors;
global.HttpStatus = HttpStatus;
global.nock = nock;
global.app = app;
global.wss = wss;
global.srcDir = srcDir;
global.dirs = dirs;
global.Constants = Constants;
global.Utils = Utils;
global.log = log;
global.spaces = spaces;
global.server = server;
global.TestUtils = TestUtils;

// Restore console before run.
global.console = OLD_CONSOLE;

// Basic tests to ensure initialisation is fine.
describe('The OVE Core server', () => {
    const OLD_CONSOLE = global.console;
    beforeAll(() => {
        global.console = { log: jest.fn(x => x), warn: jest.fn(x => x), error: jest.fn(x => x) };
    });

    it('should initialize successfully', () => {
        expect(server).not.toBeUndefined();
    });

    /* jshint ignore:start */
    // current version of JSHint does not support async/await
    it('should support CORS', async () => {
        await request(app).get('/')
            .expect('Access-Control-Allow-Origin', '*');
    });
    /* jshint ignore:end */

    afterAll(() => {
        global.console = OLD_CONSOLE;
    });
});

// It is hard to make these tests modular based on their interdependence and how
// Jest works. One of the biggest challenges is the Nock module which interferes
// with our mock WebSockets. However, it is possible to save tests in individual
// files and import all of them into a single test runner, as we have done here.
require(path.join(srcDir, '..', 'test', 'spaces-json.js'));
require(path.join(srcDir, '..', 'test', 'core-functionality.js'));
require(path.join(srcDir, '..', 'test', 'core-api.js'));
require(path.join(srcDir, '..', 'test', 'core-app.js'));
require(path.join(srcDir, '..', 'test', 'messaging.js'));

// The server should be able to start on a random port.
describe('The OVE Core server', () => {
    const PORT = 5555;
    const httpRequest = () => {
        return request('http://localhost:' + PORT);
    };

    let server;
    const OLD_CONSOLE = global.console;
    beforeAll(() => {
        global.console = { log: jest.fn(x => x), warn: jest.fn(x => x), error: jest.fn(x => x) };
        server = app.listen(PORT);
    });

    /* jshint ignore:start */
    // current version of JSHint does not support async/await
    it('should be starting up on port ' + PORT, async () => {
        let res = await httpRequest().get('/spaces?oveSectionId=0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);
    });
    /* jshint ignore:end */

    afterAll(() => {
        server.close();
        global.console = OLD_CONSOLE;
    });
});
