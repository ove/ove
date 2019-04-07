const path = require('path');
const fs = require('fs');
const request = require('supertest');
const HttpStatus = require('http-status-codes');

// Do not expose console during init.
const OLD_CONSOLE = global.console;
global.console = { log: jest.fn(x => x), warn: jest.fn(x => x), error: jest.fn(x => x) };

// We always test against the distribution not the source.
const srcDir = path.join(__dirname, '..', 'lib');
const index = require(path.join(srcDir, 'index'));

// There is a src folder inside test/resources, since this is typically what
// applications would have. The name of the folder could actually be anything,
// but we are not using dist, since Git ignores it.
const base = index(path.join(srcDir, '..', 'test', 'resources', 'src'), 'dummy');
const { app, Utils, log } = base;

// Restore console before run.
global.console = OLD_CONSOLE;

describe('The OVE App Base library', () => {
    const OLD_CONSOLE = global.console;
    beforeAll(() => {
        global.console = { log: jest.fn(x => x), warn: jest.fn(x => x), error: jest.fn(x => x) };
    });
    it('should export utilities for OVE applications', () => {
        // Precise validation of number of items exported and then check their
        // names one by one.
        expect(Object.keys(base).length).toEqual(8);
        expect(Object.keys(base)).toContain('express');
        expect(Object.keys(base)).toContain('app');
        expect(Object.keys(base)).toContain('config');
        expect(Object.keys(base)).toContain('nodeModules');
        expect(Object.keys(base)).toContain('log');
        expect(Object.keys(base)).toContain('operations');
        expect(Object.keys(base)).toContain('Utils');
        expect(Object.keys(base)).toContain('appState');
    });

    /* jshint ignore:start */
    // current version of JSHint does not support async/await
    it('should support CORS', async () => {
        await request(app).get('/')
            .expect('Access-Control-Allow-Origin', '*');
    });

    it('should be able to work without a config.json', async () => {
        // We are loading the module once again here, so the line below is important.
        jest.resetModules();
        const newIndex = require(path.join(srcDir, 'index'));
        const newBase = newIndex(path.join(srcDir, '..', 'test', 'fake'), 'dummy');
        const { app: newApp } = newBase;
        expect(Object.keys(newBase)).toContain('config');
        let res = await request(newApp).post('/instances/flush');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);
        expect(newBase.config).toEqual([]);
    });

    it('should return its name', async () => {
        let res = await request(app).get('/name');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify('dummy'));
    });

    it('should be able to perform a flush operation', async () => {
        let res = await request(app).post('/instances/flush');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);
        // Validation of post condition after flush. This is not the only
        // test of /flush, as the test methods below check what happens with
        // various pre-conditions. However, this is the only test of /flush
        // with no pre-conditions.
        expect(base.config).toEqual(JSON.parse(fs.readFileSync(
            path.join(srcDir, '..', 'test', 'resources', 'src', 'config.json'))));
    });

    it('should be able to store state of a section until it has been flushed', async () => {
        const payload = '{"url": "http://dummy.com"}';
        await request(app).post('/instances/0/state', payload);

        let res = await request(app).get('/instances/0/state');
        expect(res.statusCode).not.toEqual(HttpStatus.NO_CONTENT);

        await request(app).post('/instances/0/flush');
        res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);
    });

    it('should be able to flush state of sections individually', async () => {
        let res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);

        const payload1 = { url: 'http://dummy.com' };
        await request(app).post('/instances/0/state').send(payload1);

        res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload1));

        const payload2 = { url: 'http://another.dummy.com' };
        await request(app).post('/instances/1/state').send(payload2);

        res = await request(app).get('/instances/1/state');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload2));

        // Should not complain when flushing non-existing state
        res = await request(app).post('/instances/2/flush');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        res = await request(app).post('/instances/1/flush');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        res = await request(app).post('/instances/0/flush');
        expect(res.statusCode).toEqual(HttpStatus.OK);

        res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);
        res = await request(app).get('/instances/1/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);
    });

    it('should be able to store state of multiple sections', async () => {
        let res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);

        const payload1 = { url: 'http://dummy.com' };
        await request(app).post('/instances/0/state').send(payload1);

        res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload1));

        const payload2 = { url: 'http://another.dummy.com' };
        await request(app).post('/instances/1/state').send(payload2);

        res = await request(app).get('/instances/1/state');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload2));

        await request(app).post('/instances/flush');
        res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);
        res = await request(app).get('/instances/1/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);
    });

    it('should be able to return state of multiple sections', async () => {
        let res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);

        // This test is different from the test above since there are
        // two ways to read state of multiple sections, either all at once
        // (as tested above) or one by one (as tested here).
        const payload1 = { url: 'http://dummy.com' };
        await request(app).post('/instances/0/state').send(payload1);

        res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload1));

        res = await request(app).get('/instances/1/state');
        expect(res.statusCode).not.toEqual(HttpStatus.OK);

        const payload2 = { url: 'http://another.dummy.com' };
        await request(app).post('/instances/1/state').send(payload2);

        res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload1));

        res = await request(app).get('/instances/1/state');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload2));

        await request(app).post('/instances/flush');
        res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);
        res = await request(app).get('/instances/1/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);
    });

    it('should be able to update state of section', async () => {
        let res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);

        // This validates reading of state information using both (all at
        // once and one by one) approaches.
        const payload1 = { url: 'http://dummy.com' };
        await request(app).post('/instances/0/state').send(payload1);

        res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload1));

        res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload1));

        const payload2 = { url: 'http://another.dummy.com' };
        await request(app).post('/instances/0/state').send(payload2);

        res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload2));

        res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload2));

        await request(app).post('/instances/flush');
        res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);
    });

    it('should be able to store, return or delete a named state', async () => {
        let res = await request(app).get('/states/foo');
        expect(res.statusCode).toEqual(HttpStatus.BAD_REQUEST);
        expect(res.text).toEqual(JSON.stringify({ error: 'invalid state name' }));

        res = await request(app).delete('/states/foo');
        expect(res.statusCode).toEqual(HttpStatus.BAD_REQUEST);
        expect(res.text).toEqual(JSON.stringify({ error: 'invalid state name' }));

        const payload1 = { url: 'http://dummy.com' };
        await request(app).post('/states/foo').send(payload1);
        await request(app).post('/states/bar').send({ url: 'http://dummy.com' });

        res = await request(app).get('/states/foo');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload1));

        res = await request(app).delete('/states/foo');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);

        res = await request(app).get('/states/foo');
        expect(res.statusCode).toEqual(HttpStatus.BAD_REQUEST);
        expect(res.text).toEqual(JSON.stringify({ error: 'invalid state name' }));
        res = await request(app).get('/states/bar');
        expect(res.statusCode).not.toEqual(HttpStatus.BAD_REQUEST);
        expect(res.text).not.toEqual(JSON.stringify({ error: 'invalid state name' }));

        await request(app).post('/instances/flush');
        res = await request(app).get('/states/bar');
        expect(res.statusCode).toEqual(HttpStatus.BAD_REQUEST);
        expect(res.text).toEqual(JSON.stringify({ error: 'invalid state name' }));
    });

    it('should be able to list state names', async () => {
        const payload1 = { url: 'http://dummy.com' };
        await request(app).post('/states/foo').send(payload1);
        await request(app).post('/states/bar').send({ url: 'http://dummy.com' });

        let res = await request(app).get('/states');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(JSON.parse(res.text)).toContain('foo');
        expect(JSON.parse(res.text)).toContain('bar');

        await request(app).post('/instances/flush');
    });

    it('should make a debug log when a named state is saved', async () => {
        // A debug log is written when a named state is saved. This is an expensive
        // operation since it serializes the JSON payload. Another test below validates
        // when it does not happen when debug logging is disabled at an application
        // level.
        const spy = jest.spyOn(log, 'debug');
        const payload1 = { url: 'http://dummy.com' };
        await request(app).post('/states/foo').send(payload1);
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
        await request(app).post('/instances/flush');
    });

    it('should expose content under /data and /client directories', async () => {
        let res = await request(app).get('/data/bar.txt');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(fs.readFileSync(
            path.join(srcDir, '..', 'test', 'resources', 'src', 'data', 'bar.txt')).toString());
        res = await request(app).get('/foo.txt');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(fs.readFileSync(
            path.join(srcDir, '..', 'test', 'resources', 'src', 'client', 'foo.txt')).toString());
        res = await request(app).get('/data/foo.txt');
        expect(res.statusCode).toEqual(HttpStatus.NOT_FOUND);
        res = await request(app).get('/bar.txt');
        expect(res.statusCode).toEqual(HttpStatus.NOT_FOUND);
    });
    /* jshint ignore:end */

    afterAll(() => {
        global.console = OLD_CONSOLE;
    });
});

// Separate section for process.env tests
describe('The OVE App Base library', () => {
    const OLD_CONSOLE = global.console;
    beforeAll(() => {
        global.console = { log: jest.fn(x => x), warn: jest.fn(x => x), error: jest.fn(x => x) };

        const op1 = function (source, target, z) {
            return {
                zoom: z === 1 ? target.zoom * source.zoom : target.zoom / source.zoom,
                pan: {
                    x: target.pan.x + z * source.pan.x,
                    y: target.pan.y + z * source.pan.y
                }
            };
        };
        const op2 = function (source, target) {
            return !Utils.isNullOrEmpty(source) && !Utils.isNullOrEmpty(target) &&
                !Utils.isNullOrEmpty(source.zoom) && !Utils.isNullOrEmpty(target.zoom) &&
                !Utils.isNullOrEmpty(source.pan) && !Utils.isNullOrEmpty(target.pan) &&
                !Utils.isNullOrEmpty(source.pan.x) && !Utils.isNullOrEmpty(target.pan.x) &&
                !Utils.isNullOrEmpty(source.pan.y) && !Utils.isNullOrEmpty(target.pan.y);
        };
        base.operations = {
            transform: function (state, transformation) {
                return op1(state, transformation, 1);
            },
            canTransform: op2,
            diff: function (source, target) {
                return op1(source, target, -1);
            },
            canDiff: op2,
            validateState: function (_state) {
                return true;
            }
        };
    });

    /* jshint ignore:start */
    // current version of JSHint does not support async/await
    it('should not fail to set runtime or named state when state validation is not available at an app-level', async () => {
        let validateState = base.operations.validateState;

        const spy = jest.spyOn(log, 'error');
        base.operations.validateState = undefined;
        const payload1 = { zoom: 1, pan: { x: 10, y: 10 } };
        let res = await request(app).post('/states/foo').send(payload1);
        expect(res.statusCode).toEqual(HttpStatus.OK);
        res = await request(app).post('/instances/0/state').send(payload1);
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();

        base.operations.validateState = validateState;

        await request(app).post('/instances/flush');
        res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);
    });

    it('should fail to set runtime or named state when state validation fails', async () => {
        let validateState = base.operations.validateState;

        const spy = jest.spyOn(log, 'error');
        base.operations.validateState = function (_state) {
            return false;
        };
        const payload1 = { zoom: 1, pan: { x: 10, y: 10 } };
        let res = await request(app).post('/states/foo').send(payload1);
        expect(res.statusCode).toEqual(HttpStatus.OK);
        res = await request(app).post('/instances/0/state').send(payload1);
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();

        base.operations.validateState = validateState;

        await request(app).post('/instances/flush');
        res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);
    });

    it('should fail to transform when parameters were incorrect', async () => {
        const payload1 = { zoom: 1, pan: { x: 10, y: 10 } };
        let res = await request(app).post('/states/foo/transform').send(payload1);
        expect(res.statusCode).toEqual(HttpStatus.BAD_REQUEST);
        expect(res.text).toEqual(JSON.stringify({ error: 'invalid state name' }));

        res = await request(app).post('/instances/0/state/transform').send(payload1);
        expect(res.statusCode).toEqual(HttpStatus.BAD_REQUEST);
        expect(res.text).toEqual(JSON.stringify({ error: 'invalid section id' }));

        await request(app).post('/states/foo').send(payload1);
        await request(app).post('/instances/0/state').send(payload1);

        res = await request(app).post('/states/foo/transform').send(Utils.JSON.EMPTY);
        expect(res.statusCode).toEqual(HttpStatus.BAD_REQUEST);
        expect(res.text).toEqual(JSON.stringify({ error: 'invalid transformation' }));

        res = await request(app).post('/instances/0/state/transform').send(Utils.JSON.EMPTY);
        expect(res.statusCode).toEqual(HttpStatus.BAD_REQUEST);
        expect(res.text).toEqual(JSON.stringify({ error: 'invalid transformation' }));

        const payload2 = { pan: { x: 10, y: 10 } };
        res = await request(app).post('/states/foo/transform').send(payload2);
        expect(res.statusCode).toEqual(HttpStatus.BAD_REQUEST);
        expect(res.text).toEqual(JSON.stringify({ error: 'invalid transformation' }));

        res = await request(app).post('/instances/0/state/transform').send(payload2);
        expect(res.statusCode).toEqual(HttpStatus.BAD_REQUEST);
        expect(res.text).toEqual(JSON.stringify({ error: 'invalid transformation' }));

        await request(app).post('/instances/flush');
        res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);
    });

    it('should fail to diff when parameters were incorrect', async () => {
        const payload1 = { target: { zoom: 1, pan: { x: 10, y: 10 } } };
        let res = await request(app).post('/states/foo/diff').send(payload1);
        expect(res.statusCode).toEqual(HttpStatus.BAD_REQUEST);
        expect(res.text).toEqual(JSON.stringify({ error: 'invalid state name' }));

        res = await request(app).post('/instances/0/state/diff').send(payload1);
        expect(res.statusCode).toEqual(HttpStatus.BAD_REQUEST);
        expect(res.text).toEqual(JSON.stringify({ error: 'invalid section id' }));

        res = await request(app).post('/diff').send(payload1);
        expect(res.statusCode).toEqual(HttpStatus.BAD_REQUEST);
        expect(res.text).toEqual(JSON.stringify({ error: 'invalid states' }));

        const payload2 = { zoom: 1, pan: { x: 10, y: 10 } };
        await request(app).post('/states/foo').send(payload2);
        await request(app).post('/instances/0/state').send(payload2);

        const payload3 = { source: { zoom: 1, pan: { x: 10, y: 10 } } };
        res = await request(app).post('/diff').send(payload3);
        expect(res.statusCode).toEqual(HttpStatus.BAD_REQUEST);
        expect(res.text).toEqual(JSON.stringify({ error: 'invalid states' }));

        res = await request(app).post('/states/foo/diff').send(payload3);
        expect(res.statusCode).toEqual(HttpStatus.BAD_REQUEST);
        expect(res.text).toEqual(JSON.stringify({ error: 'invalid states' }));

        res = await request(app).post('/instances/0/state/diff').send(payload3);
        expect(res.statusCode).toEqual(HttpStatus.BAD_REQUEST);
        expect(res.text).toEqual(JSON.stringify({ error: 'invalid states' }));

        const payload4 = { target: { pan: { x: 10, y: 10 } } };

        res = await request(app).post('/states/foo/diff').send(payload4);
        expect(res.statusCode).toEqual(HttpStatus.BAD_REQUEST);
        expect(res.text).toEqual(JSON.stringify({ error: 'invalid states' }));

        res = await request(app).post('/instances/0/state/diff').send(payload4);
        expect(res.statusCode).toEqual(HttpStatus.BAD_REQUEST);
        expect(res.text).toEqual(JSON.stringify({ error: 'invalid states' }));

        res = await request(app).post('/diff').send({ source: { zoom: 1, pan: { x: 10, y: 10 } }, target: { pan: { x: 10, y: 10 } } });
        expect(res.statusCode).toEqual(HttpStatus.BAD_REQUEST);
        expect(res.text).toEqual(JSON.stringify({ error: 'invalid states' }));

        await request(app).post('/instances/flush');
        res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);
    });

    it('should fail to transform or diff if the application does not support it', async () => {
        const payload1 = { zoom: 1, pan: { x: 10, y: 10 } };
        await request(app).post('/states/foo').send(payload1);
        await request(app).post('/instances/0/state').send(payload1);

        let transform = base.operations.transform;
        let diff = base.operations.diff;
        let canTransform = base.operations.canTransform;
        let canDiff = base.operations.canDiff;

        base.operations.transform = undefined;
        let res = await request(app).post('/states/foo/transform').send(Utils.JSON.EMPTY);
        expect(res.statusCode).toEqual(HttpStatus.NOT_IMPLEMENTED);
        expect(res.text).toEqual(JSON.stringify({ error: 'operation not implemented' }));

        res = await request(app).post('/instances/0/state/transform').send(Utils.JSON.EMPTY);
        expect(res.statusCode).toEqual(HttpStatus.NOT_IMPLEMENTED);
        expect(res.text).toEqual(JSON.stringify({ error: 'operation not implemented' }));
        base.operations.transform = transform;

        base.operations.canTransform = undefined;
        res = await request(app).post('/states/foo/transform').send(Utils.JSON.EMPTY);
        expect(res.statusCode).toEqual(HttpStatus.NOT_IMPLEMENTED);
        expect(res.text).toEqual(JSON.stringify({ error: 'operation not implemented' }));

        res = await request(app).post('/instances/0/state/transform').send(Utils.JSON.EMPTY);
        expect(res.statusCode).toEqual(HttpStatus.NOT_IMPLEMENTED);
        expect(res.text).toEqual(JSON.stringify({ error: 'operation not implemented' }));
        base.operations.canTransform = canTransform;

        const payload3 = { source: { zoom: 1, pan: { x: 10, y: 10 } } };
        base.operations.diff = undefined;
        res = await request(app).post('/states/foo/diff').send(Utils.JSON.EMPTY);
        expect(res.statusCode).toEqual(HttpStatus.NOT_IMPLEMENTED);
        expect(res.text).toEqual(JSON.stringify({ error: 'operation not implemented' }));

        res = await request(app).post('/instances/0/state/diff').send(Utils.JSON.EMPTY);
        expect(res.statusCode).toEqual(HttpStatus.NOT_IMPLEMENTED);
        expect(res.text).toEqual(JSON.stringify({ error: 'operation not implemented' }));

        res = await request(app).post('/diff').send(payload3);
        expect(res.statusCode).toEqual(HttpStatus.NOT_IMPLEMENTED);
        expect(res.text).toEqual(JSON.stringify({ error: 'operation not implemented' }));
        base.operations.diff = diff;

        base.operations.canDiff = undefined;
        res = await request(app).post('/states/foo/diff').send(Utils.JSON.EMPTY);
        expect(res.statusCode).toEqual(HttpStatus.NOT_IMPLEMENTED);
        expect(res.text).toEqual(JSON.stringify({ error: 'operation not implemented' }));

        res = await request(app).post('/instances/0/state/diff').send(Utils.JSON.EMPTY);
        expect(res.statusCode).toEqual(HttpStatus.NOT_IMPLEMENTED);
        expect(res.text).toEqual(JSON.stringify({ error: 'operation not implemented' }));

        res = await request(app).post('/diff').send(payload3);
        expect(res.statusCode).toEqual(HttpStatus.NOT_IMPLEMENTED);
        expect(res.text).toEqual(JSON.stringify({ error: 'operation not implemented' }));
        base.operations.canDiff = canDiff;

        await request(app).post('/instances/flush');
        res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);
    });

    it('should successfully transform and diff payloads', async () => {
        const payload1 = { zoom: 1, pan: { x: 10, y: 10 } };
        await request(app).post('/states/foo').send(payload1);
        await request(app).post('/instances/0/state').send(payload1);

        let res = await request(app).get('/states/foo');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload1));

        res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload1));

        const payload2 = { zoom: 1, pan: { x: 20, y: 20 } };

        res = await request(app).post('/states/foo/transform').send(payload1);
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload2));

        res = await request(app).post('/instances/0/state/transform').send(payload1);
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload2));

        res = await request(app).get('/states/foo');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload2));

        res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload2));

        const payload3 = { zoom: 1, pan: { x: -10, y: -10 } };
        res = await request(app).post('/states/foo/diff').send({ target: payload1 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload3));

        res = await request(app).post('/instances/0/state/diff').send({ target: payload1 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload3));

        res = await request(app).post('/diff').send({ source: payload2, target: payload1 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload3));

        await request(app).post('/instances/flush');
        res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);
    });

    it('should fail to transform or diff if the application does not support any common operation', async () => {
        // We are loading the module once again here, so the line below is important.
        jest.resetModules();
        const newIndex = require(path.join(srcDir, 'index'));
        const newBase = newIndex(path.join(srcDir, '..', 'test', 'resources', 'src'), 'dummy');
        const { app: newApp } = newBase;

        const payload1 = { zoom: 1, pan: { x: 10, y: 10 } };
        await request(newApp).post('/states/foo').send(payload1);
        await request(newApp).post('/instances/0/state').send(payload1);

        let res = await request(newApp).post('/states/foo/transform').send(Utils.JSON.EMPTY);
        expect(res.statusCode).toEqual(HttpStatus.NOT_IMPLEMENTED);
        expect(res.text).toEqual(JSON.stringify({ error: 'operation not implemented' }));

        res = await request(newApp).post('/instances/0/state/transform').send(Utils.JSON.EMPTY);
        expect(res.statusCode).toEqual(HttpStatus.NOT_IMPLEMENTED);
        expect(res.text).toEqual(JSON.stringify({ error: 'operation not implemented' }));

        const payload3 = { source: { zoom: 1, pan: { x: 10, y: 10 } } };
        res = await request(newApp).post('/states/foo/diff').send(Utils.JSON.EMPTY);
        expect(res.statusCode).toEqual(HttpStatus.NOT_IMPLEMENTED);
        expect(res.text).toEqual(JSON.stringify({ error: 'operation not implemented' }));

        res = await request(newApp).post('/instances/0/state/diff').send(Utils.JSON.EMPTY);
        expect(res.statusCode).toEqual(HttpStatus.NOT_IMPLEMENTED);
        expect(res.text).toEqual(JSON.stringify({ error: 'operation not implemented' }));

        res = await request(newApp).post('/diff').send(payload3);
        expect(res.statusCode).toEqual(HttpStatus.NOT_IMPLEMENTED);
        expect(res.text).toEqual(JSON.stringify({ error: 'operation not implemented' }));

        await request(newApp).post('/instances/flush');
        res = await request(newApp).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);
    });
    /* jshint ignore:end */

    afterAll(() => {
        global.console = OLD_CONSOLE;
    });
});

// Separate section for process.env tests
describe('The OVE App Base library', () => {
    const OLD_CONSOLE = global.console;
    beforeAll(() => {
        global.console = { log: jest.fn(x => x), warn: jest.fn(x => x), error: jest.fn(x => x) };
    });

    const OLD_ENV = process.env;

    beforeEach(() => {
        jest.resetModules(); // This is important

        /* jshint ignore:start */
        // current version of JSHint does not support ...
        process.env = { ...OLD_ENV };
        /* jshint ignore:end */

        process.env.LOG_LEVEL = 3;
    });

    /* jshint ignore:start */
    // current version of JSHint does not support async/await
    it('should be able to load app configuration from a environment variable', async () => {
        process.env.OVE_DUMMY_CONFIG_JSON = path.join(srcDir, '..', 'test', 'resources', 'package.json');
        const index = require(path.join(srcDir, 'index'));
        const base = index(path.join(srcDir, '..', 'test', 'resources', 'src'), 'dummy');
        const { app } = base;
        expect(base.config).toEqual(JSON.parse(fs.readFileSync(
            path.join(srcDir, '..', 'test', 'resources', 'package.json'))));
        await request(app).post('/instances/flush');
        // Config must be reloaded after a flush operation
        expect(base.config).toEqual(JSON.parse(fs.readFileSync(
            path.join(srcDir, '..', 'test', 'resources', 'package.json'))));
        delete process.env.OVE_DUMMY_CONFIG_JSON;
    });

    it('should not make a debug log when debug logging is disabled', async () => {
        // See also, 'should make a debug log when a named state is saved' above.
        const index = require(path.join(srcDir, 'index'));
        const base = index(path.join(srcDir, '..', 'test', 'resources', 'src'), 'dummy');
        const { app, log } = base;
        const spy = jest.spyOn(log, 'debug');
        const payload1 = { url: 'http://dummy.com' };
        await request(app).post('/states/foo').send(payload1);
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
        await request(app).post('/instances/flush');
    });
    /* jshint ignore:end */

    afterEach(() => {
        process.env = OLD_ENV;
    });

    afterAll(() => {
        global.console = OLD_CONSOLE;
    });
});
