const path = require('path');
const fs = require('fs');
const express = require('express');
const request = require('supertest');
const mockHttp = require('node-mocks-http');
const nock = require('nock');
const HttpStatus = require('http-status-codes');

const app = express();
// We always test against the distribution not the source.
const srcDir = path.join(__dirname, '..', 'lib');
const index = require(path.join(srcDir, 'index'));
const dirs = {
    base: path.join(srcDir, '..', 'test', 'resources'),
    nodeModules: path.join(srcDir, '..', '..', '..', 'node_modules'),
    constants: path.join(__dirname, '..', 'test', 'resources')
};
const { Utils, Constants } = index('core', app, dirs);

// All variables are set in the global scope so that they can then be used appropriately in the test files.
global.path = path;
global.fs = fs;
global.request = request;
global.express = express;
global.mockHttp = mockHttp;
global.nock = nock;
global.HttpStatus = HttpStatus;
global.app = app;
global.srcDir = srcDir;
global.index = index;
global.dirs = dirs;
global.Constants = Constants;
global.Utils = Utils;

require(path.join(srcDir, '..', 'test', 'core-functionality.js'));
require(path.join(srcDir, '..', 'test', 'persistence.js'));
require(path.join(srcDir, '..', 'test', 'web-sockets.js'));
require(path.join(srcDir, '..', 'test', 'logging.js'));
require(path.join(srcDir, '..', 'test', 'constants.js'));

// Separate section for process.env tests
describe('The OVE Utils library', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        jest.resetModules(); // This is important

        /* jshint ignore:start */
        // current version of JSHint does not support ...
        process.env = { ...OLD_ENV };
        /* jshint ignore:end */

        process.env.LOG_LEVEL = 3;
    });

    it('should log based on the global log level specified as an environment variable', () => {
        const index = require(path.join(srcDir, 'index'));
        const { Utils, Constants } = index('core', app, dirs);
        expect(Constants.LOG_LEVEL).toEqual(3);
        const log = Utils.Logger('test');
        const spy = jest.spyOn(global.console, 'log');
        log.debug('Some test message');
        expect(spy).not.toHaveBeenCalled();
        log.info('Some test message');
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    afterEach(() => {
        process.env = OLD_ENV;
    });
});
