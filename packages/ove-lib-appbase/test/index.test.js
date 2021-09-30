const path = require('path');
const fs = require('fs');
const request = require('supertest');
const HttpStatus = require('http-status-codes');

const HTTP = 'http://';

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
        expect(Object.keys(base).length).toEqual(9);
        expect(Object.keys(base)).toContain('express');
        expect(Object.keys(base)).toContain('app');
        expect(Object.keys(base)).toContain('config');
        expect(Object.keys(base)).toContain('nodeModules');
        expect(Object.keys(base)).toContain('log');
        expect(Object.keys(base)).toContain('operations');
        expect(Object.keys(base)).toContain('clock');
        expect(Object.keys(base)).toContain('Utils');
        expect(Object.keys(base.Utils)).toContain('validateState');
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
        const res = await request(newApp).post('/instances/flush');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);
        expect(newBase.config).toEqual([]);
    });

    it('should return its name', async () => {
        const res = await request(app).get('/name');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify('dummy'));
    });

    it('should return a clock', async () => {
        const messages = [];
        base.clock.setWS({
            safeSend: function (m) {
                messages.push(m);
            }
        });
        base.clock.init();
        expect((base.clock.getTime() - new Date().getTime()) / 10 | 0).toEqual(0);
        expect(base.clock.sync({})).toEqual(false);
        let syncResult = base.clock.sync({
            appId: 'foo',
            sync: {
                id: 'uuid',
                serverDiff: 0
            }
        });
        expect(syncResult).toEqual(true);
        expect(messages.length).toEqual(1);
        expect(JSON.parse(messages.pop()).sync.id).toEqual('uuid');

        const mockCallback = jest.fn(x => x);
        const OLD_LOG_TRACE = log.trace;
        const OLD_LOG_DEBUG = log.debug;
        log.trace = mockCallback;
        log.debug = mockCallback;
        syncResult = base.clock.sync({
            appId: 'foo',
            sync: {
                id: 'uuid',
                t1: new Date().getTime(),
                t2: new Date().getTime(),
                serverDiff: 0
            }
        });
        expect(mockCallback.mock.calls[0][0]).toBe('Clock skew detection attempt:');
        expect(mockCallback.mock.calls[0][1]).toBe(1);
        expect(mockCallback.mock.calls[1][0]).toBe('Responded to sync request');
        expect(syncResult).toEqual(true);
        expect(messages.length).toEqual(0);
        syncResult = base.clock.sync({
            appId: 'foo',
            sync: {
                id: 'uuid',
                t1: new Date().getTime(),
                t2: new Date().getTime(),
                serverDiff: 0
            }
        });
        expect(mockCallback.mock.calls[2][1]).toBe(2);
        expect(syncResult).toEqual(true);
        base.clock.init(); // re-init should not delete results
        expect(messages.length).toEqual(0);
        syncResult = base.clock.sync({
            appId: 'foo',
            sync: {
                id: 'uuid',
                t1: new Date().getTime(),
                t2: new Date().getTime(),
                serverDiff: 0
            }
        });
        expect(mockCallback.mock.calls[4][1]).toBe(3);
        expect(syncResult).toEqual(true);
        expect(messages.length).toEqual(0);
        syncResult = base.clock.sync({
            appId: 'foo',
            sync: {
                id: 'uuid',
                t1: new Date().getTime(),
                t2: new Date().getTime(),
                serverDiff: 0
            }
        });
        expect(mockCallback.mock.calls[6][1]).toBe(4);
        expect(syncResult).toEqual(true);
        expect(messages.length).toEqual(0);
        syncResult = base.clock.sync({
            appId: 'foo',
            sync: {
                id: 'uuid',
                t1: new Date().getTime(),
                t2: new Date().getTime(),
                serverDiff: 0
            }
        });
        expect(mockCallback.mock.calls[8][1]).toBe(5);
        expect(syncResult).toEqual(true);
        expect(messages.length).not.toEqual(0);
        expect(JSON.parse(messages.pop()).syncResults.length).toEqual(5);
        expect(syncResult).toEqual(true);
        base.clock.init(); // re-init should not delete results
        syncResult = base.clock.sync({
            appId: 'foo',
            sync: {
                id: 'uuid',
                t1: new Date().getTime(),
                t2: new Date().getTime(),
                serverDiff: 0
            }
        });
        expect(mockCallback.mock.calls[10][1]).toBe(6);
        expect(syncResult).toEqual(true);
        expect(messages.length).toEqual(0);
        syncResult = base.clock.sync({
            appId: 'foo',
            clockReSync: true
        });
        expect(syncResult).toEqual(true);
        syncResult = base.clock.sync({
            appId: 'foo',
            sync: {
                id: 'uuid',
                t1: new Date().getTime(),
                t2: new Date().getTime(),
                serverDiff: 0
            }
        });
        expect(mockCallback.mock.calls[12][1]).toBe(1);
        expect(syncResult).toEqual(true);
        expect(messages.length).toEqual(0);
        syncResult = base.clock.sync({
            appId: 'foo',
            clockDiff: {}
        });
        expect(syncResult).toEqual(true);
        expect(mockCallback.mock.calls[14][0]).toBe('Got a clock difference of:');
        expect(mockCallback.mock.calls[14][1]).toBe(undefined);
        syncResult = base.clock.sync({
            appId: 'foo',
            sync: {
                id: 'uuid',
                t1: new Date().getTime(),
                t2: new Date().getTime(),
                serverDiff: 0
            }
        });
        expect(mockCallback.mock.calls[15][1]).toBe(2);
        expect(syncResult).toEqual(true);
        expect(messages.length).toEqual(0);
        log.trace = OLD_LOG_TRACE;
        log.debug = OLD_LOG_DEBUG;
    });

    it('should validate state', () => {
        expect(Object.keys(base.Utils)).toContain('validateState');

        expect(base.Utils.validateState({
            sessionId: 'random',
            maxSessions: 8
        }, [{ value: ['state.sessionId'] }, { prefix: ['state.maxSessions'] }])).toEqual(true);

        expect(base.Utils.validateState({
            url: 'https://raw.githubusercontent.com/mozilla/pdf.js/master/test/pdfs/TAMReview.pdf',
            settings: {
                scale: 2,
                scrolling: 'vertical'
            }
        }, [
            { value: ['state.url'] },
            {
                prefix: ['state.offset'],
                value: ['state.offset.x', 'state.offset.y']
            },
            { prefix: ['state.scale'] }
        ])).toEqual(true);

        expect(base.Utils.validateState({
            settings: {
                scale: 2,
                scrolling: 'vertical'
            }
        }, [
            { value: ['state.url'] },
            {
                prefix: ['state.offset'],
                value: ['state.offset.x', 'state.offset.y']
            },
            { prefix: ['state.scale'] }
        ])).not.toEqual(true);

        expect(base.Utils.validateState({
            neo4j: {
                x: { min: 0, max: 100 },
                y: { min: 0, max: 100 },
                db: { url: 'http://localhost:7474', user: 'neo4j', password: 'admin' },
                query: 'MATCH (n) WHERE n.y >= Y_MIN AND n.y < Y_MAX AND n.x >= X_MIN AND n.x < X_MAX RETURN n LIMIT 100'
            },
            settings: {
                autoRescale: true,
                clone: false,
                rescaleIgnoreSize: true,
                skipErrors: true
            },
            renderer: 'canvas'
        }, [
            { value: ['state.neo4j', 'state.neo4j.db', 'state.neo4j.db.url', 'state.neo4j.query'] },
            { prefix: ['state.settings'] },
            { prefix: ['state.renderer'] },
            { prefix: ['state.neo4j.db.user', 'state.neo4j.db.password'] },
            { prefix: ['state.neo4j.x'], value: ['state.neo4j.x.min', 'state.neo4j.x.max'] },
            { prefix: ['state.neo4j.y'], value: ['state.neo4j.y.min', 'state.neo4j.y.max'] }
        ])).toEqual(true);
    });

    it('should be able to perform a flush operation', async () => {
        const res = await request(app).post('/instances/flush');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);
        // Validation of post condition after flush. This is not the only
        // test of /flush, as the test methods below check what happens with
        // various pre-conditions. However, this is the only test of /flush
        // with no pre-conditions.
        expect(base.config).toEqual(JSON.parse(fs.readFileSync(
            path.join(srcDir, '..', 'test', 'resources', 'src', 'config.json')).toString()));
    });

    it('it should fail if the content type was not JSON', async () => {
        const payload = `{"url": "${HTTP}dummy.com"}`;
        let res = await request(app).post('/instances/0/state', payload);
        expect(res.statusCode).toEqual(HttpStatus.UNSUPPORTED_MEDIA_TYPE);

        res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);
    });

    it('should be able to store state of a section until it has been flushed', async () => {
        const payload = { url: `${HTTP}dummy.com` };
        await request(app).post('/instances/0/state').send(payload);

        let res = await request(app).get('/instances/0/state');
        expect(res.statusCode).not.toEqual(HttpStatus.NO_CONTENT);

        await request(app).post('/instances/0/flush');
        res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);
    });

    it('should be able to flush state of sections individually', async () => {
        let res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);

        const payload1 = { url: `${HTTP}dummy.com` };
        await request(app).post('/instances/0/state').send(payload1);

        res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload1));

        const payload2 = { url: `${HTTP}another.dummy.com` };
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

        const payload1 = { url: `${HTTP}dummy.com` };
        await request(app).post('/instances/0/state').send(payload1);

        res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload1));

        const payload2 = { url: `${HTTP}another.dummy.com` };
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
        const payload1 = { url: `${HTTP}dummy.com` };
        await request(app).post('/instances/0/state').send(payload1);

        res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload1));

        res = await request(app).get('/instances/1/state');
        expect(res.statusCode).not.toEqual(HttpStatus.OK);

        const payload2 = { url: `${HTTP}another.dummy.com` };
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
        const payload1 = { url: `${HTTP}dummy.com` };
        await request(app).post('/instances/0/state').send(payload1);

        res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload1));

        res = await request(app).get('/instances/0/state');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload1));

        const payload2 = { url: `${HTTP}another.dummy.com` };
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

        const payload1 = { url: `${HTTP}dummy.com` };
        await request(app).post('/states/foo').send(payload1);
        await request(app).post('/states/bar').send({ url: `${HTTP}dummy.com` });

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
        const payload1 = { url: `${HTTP}dummy.com` };
        await request(app).post('/states/foo').send(payload1);
        await request(app).post('/states/bar').send({ url: `${HTTP}dummy.com` });

        const res = await request(app).get('/states');
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
        const payload1 = { url: `${HTTP}dummy.com` };
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
        const validateState = base.operations.validateState;

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
        const validateState = base.operations.validateState;

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

        const transform = base.operations.transform;
        const diff = base.operations.diff;
        const canTransform = base.operations.canTransform;
        const canDiff = base.operations.canDiff;

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
            path.join(srcDir, '..', 'test', 'resources', 'package.json')).toString()));
        await request(app).post('/instances/flush');
        // Config must be reloaded after a flush operation
        expect(base.config).toEqual(JSON.parse(fs.readFileSync(
            path.join(srcDir, '..', 'test', 'resources', 'package.json')).toString()));
        delete process.env.OVE_DUMMY_CONFIG_JSON;
    });

    it('should accept an entire structure instead of the baseDir', async () => {
        process.env.OVE_DUMMY_CONFIG_JSON = path.join(srcDir, '..', 'test', 'resources', 'package.json');
        const index = require(path.join(srcDir, 'index'));
        const baseDir = path.join(srcDir, '..', 'test', 'resources', 'src');
        const dirs = {
            base: baseDir,
            nodeModules: path.join(baseDir, '..', '..', '..', 'node_modules'),
            constants: path.join(baseDir, 'client', 'constants'),
            rootPage: path.join(__dirname, 'landing.html')
        };
        const base = index(dirs, 'dummy');
        expect(base.config).toEqual(JSON.parse(fs.readFileSync(
            path.join(srcDir, '..', 'test', 'resources', 'package.json')).toString()));
        delete process.env.OVE_DUMMY_CONFIG_JSON;
    });

    it('should not make a debug log when debug logging is disabled', async () => {
        // See also, 'should make a debug log when a named state is saved' above.
        const index = require(path.join(srcDir, 'index'));
        const base = index(path.join(srcDir, '..', 'test', 'resources', 'src'), 'dummy');
        const { app, log } = base;
        const spy = jest.spyOn(log, 'debug');
        const payload1 = { url: `${HTTP}dummy.com` };
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
