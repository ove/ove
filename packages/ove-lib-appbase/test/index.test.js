const path = require('path');
const fs = require('fs');
const request = require('supertest');
const HttpStatus = require('http-status-codes');

// We always test against the distribution not the source.
const srcDir = path.join(__dirname, '..', 'lib');
const index = require(path.join(srcDir, 'index'));
// There is a src folder inside test/resources, since this is typically what
// applications would have. The name of the folder could actually be anything,
// but we are not using dist, since Git ignores it.
const base = index(path.join(srcDir, '..', 'test', 'resources', 'src'), 'dummy');
const { app, Utils, log } = base;

describe('The OVE App Base library', () => {
    it('should export utilities for OVE applications', () => {
        // Precise validation of number of items exported and then check their
        // names one by one.
        expect(Object.keys(base).length).toEqual(6);
        expect(Object.keys(base)).toContain('express');
        expect(Object.keys(base)).toContain('app');
        expect(Object.keys(base)).toContain('config');
        expect(Object.keys(base)).toContain('nodeModules');
        expect(Object.keys(base)).toContain('log');
        expect(Object.keys(base)).toContain('Utils');
    });

    /* jshint ignore:start */
    // current version of JSHint does not support async/await
    it('should support CORS', async () => {
        await request(app).get('/')
            .expect('Access-Control-Allow-Origin', '*');
    });

    it('should return a 204 when no state has been cached', async () => {
        let res = await request(app).get('/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);
    });

    it('should be able to perform a flush operation', async () => {
        let res = await request(app).post('/flush');
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
        let res = await request(app).get('/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);

        const payload = '{"url": "http://dummy.com"}';
        await request(app).post('/0/state', payload);

        res = await request(app).get('/state');
        expect(res.statusCode).not.toEqual(HttpStatus.NO_CONTENT);

        await request(app).post('/flush');
        res = await request(app).get('/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);
    });

    it('should be able to store state of multiple sections', async () => {
        let res = await request(app).get('/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);

        const payload1 = { url: 'http://dummy.com' };
        await request(app).post('/0/state').send(payload1);

        res = await request(app).get('/state');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([payload1]));

        const payload2 = { url: 'http://another.dummy.com' };
        await request(app).post('/1/state').send(payload2);

        res = await request(app).get('/state');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([payload1, payload2]));

        await request(app).post('/flush');
        res = await request(app).get('/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);
    });

    it('should be able to return state of multiple sections', async () => {
        let res = await request(app).get('/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);

        // This test is different from the test above since there are
        // two ways to read state of multiple sections, either all at once
        // (as tested above) or one by one (as tested here).
        const payload1 = { url: 'http://dummy.com' };
        await request(app).post('/0/state').send(payload1);

        res = await request(app).get('/0/state');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload1));

        res = await request(app).get('/1/state');
        expect(res.statusCode).not.toEqual(HttpStatus.OK);

        const payload2 = { url: 'http://another.dummy.com' };
        await request(app).post('/1/state').send(payload2);

        res = await request(app).get('/0/state');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload1));

        res = await request(app).get('/1/state');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload2));

        await request(app).post('/flush');
        res = await request(app).get('/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);
    });

    it('should be able to update state of section', async () => {
        let res = await request(app).get('/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);

        // This validates reading of state information using both (all at
        // once and one by one) approaches.
        const payload1 = { url: 'http://dummy.com' };
        await request(app).post('/0/state').send(payload1);

        res = await request(app).get('/state');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([payload1]));

        res = await request(app).get('/0/state');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload1));

        const payload2 = { url: 'http://another.dummy.com' };
        await request(app).post('/0/state').send(payload2);

        res = await request(app).get('/state');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([payload2]));

        res = await request(app).get('/0/state');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload2));

        await request(app).post('/flush');
        res = await request(app).get('/state');
        expect(res.statusCode).toEqual(HttpStatus.NO_CONTENT);
    });

    it('should be able to store/return a named state', async () => {
        let res = await request(app).get('/state/foo');
        expect(res.statusCode).toEqual(HttpStatus.BAD_REQUEST);
        expect(res.text).toEqual(JSON.stringify({ error: 'invalid state name' }));

        const payload1 = { url: 'http://dummy.com' };
        await request(app).post('/state/foo').send(payload1);

        res = await request(app).get('/state/foo');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(payload1));

        await request(app).post('/flush');
        res = await request(app).get('/state/foo');
        expect(res.statusCode).toEqual(HttpStatus.BAD_REQUEST);
        expect(res.text).toEqual(JSON.stringify({ error: 'invalid state name' }));
    });

    it('should make a debug log when a named state is saved', async () => {
        // A debug log is written when a named state is saved. This is an expensive
        // operation since it serializes the JSON payload. Another test below validates
        // when it does not happen when debug logging is disabled at an application
        // level.
        const spy = jest.spyOn(log, 'debug');
        const payload1 = { url: 'http://dummy.com' };
        await request(app).post('/state/foo').send(payload1);
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
        await request(app).post('/flush');
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
});

// Separate section for process.env tests
describe('The OVE App Base library', () => {
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
    it('should not make a debug log when debug logging is disabled', async () => {
        // See also, 'should make a debug log when a named state is saved' above.
        const index = require(path.join(srcDir, 'index'));
        const base = index(path.join(srcDir, '..', 'test', 'resources', 'src'), 'dummy');
        const { app, log } = base;
        const spy = jest.spyOn(log, 'debug');
        const payload1 = { url: 'http://dummy.com' };
        await request(app).post('/state/foo').send(payload1);
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
        await request(app).post('/flush');
    });
    /* jshint ignore:end */

    afterEach(() => {
        process.env = OLD_ENV;
    });
});
