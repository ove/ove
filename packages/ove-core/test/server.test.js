const path = require('path');
const fs = require('fs');
const request = require('supertest');
const express = require('express');
const cors = require('cors');
const HttpStatus = require('http-status-codes');
const nock = require('nock');

const app = express();
// We always test against the distribution not the source.
const srcDir = path.join(__dirname, '..', 'src');
const dirs = {
    base: srcDir,
    nodeModules: path.join(srcDir, '..', '..', '..', 'node_modules'),
    constants: path.join(srcDir, 'client', 'utils'),
    rootPage: path.join(srcDir, 'blank.html')
};
const { Constants, Utils } = require('@ove-lib/utils')(app, 'core', dirs);
const log = Utils.Logger('OVE');

app.use(cors());
app.use(express.json());

const server = require(path.join(srcDir, 'server'))(app, log, Utils, Constants);

describe('The OVE Core server', () => {
    it('should initialize successfully', () => {
        expect(server).toBeUndefined();
    });

    /* jshint ignore:start */
    // current version of JSHint does not support async/await
    it('should support CORS', async () => {
        await request(app).get('/')
            .expect('Access-Control-Allow-Origin', '*');
    });

    it('should return a list of clients', async () => {
        let res = await request(app).get('/clients');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        // It is important to compare the JSON on both side since the ordering of
        // elements changes depending on how it was stringified.
        expect(JSON.parse(res.text)).toEqual(JSON.parse(fs.readFileSync(
            path.join(srcDir, 'client', 'Clients.json'))));
        // It is also useful to validate the approach taken to produce the text
        // as below.
        expect(res.text).toEqual(JSON.stringify(JSON.parse(fs.readFileSync(
            path.join(srcDir, 'client', 'Clients.json')))));
    });

    it('should return an empty list of clients by id before a section is created', async () => {
        let res = await request(app).get('/client/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);
    });

    it('should return an appropriate list of clients by id after a section has been created', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'LocalNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).not.toEqual(Utils.JSON.EMPTY);

        res = await request(app).get('/client/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(
            { 'LocalNine': [ { }, { }, { }, { }, { }, { },
                { 'x': 0, 'y': 0, 'w': 10, 'h': 10, 'offset': { 'x': 10, 'y': 0 } }, { }, { } ] }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    it('should reject invalid requests when creating sections', async () => {
        await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'w': 10, 'y': 0, 'x': 10 })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid space' }));
        await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'fake', 'w': 10, 'y': 0, 'x': 10 })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid space' }));
        await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'LocalNine', 'y': 0, 'x': 10 })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));
        await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'LocalNine', 'w': 10, 'x': 10 })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));
        await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'LocalNine', 'w': 10, 'y': 0 })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));
        await request(app).post('/section')
            .send({ 'app': { 'url': 'http://localhost:8081' }, 'space': 'LocalNine', 'w': 10, 'y': 0, 'x': 10 })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));
    });

    it('should reject requests for deleting a section when it does not exist', async () => {
        await request(app).delete('/section/0')
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid section id' }));
    });

    it('should reject requests for updating a section when it does not exist', async () => {
        await request(app).post('/section/0').send({ 'h': 10, 'space': 'LocalNine', 'w': 10, 'y': 0, 'x': 10 })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid section id' }));
    });

    // This condition is important to avoid many errors getting printed on the browser
    // console as a result of a section not existing.
    it('should not reject requests for reading a section when it does not exist', async () => {
        let res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);
    });

    it('should be able to successfully create and delete sections without an app', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'LocalNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).not.toEqual(Utils.JSON.EMPTY);

        res = await request(app).delete('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    it('should be able to successfully create sections of various sizes', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'LocalNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).not.toEqual(Utils.JSON.EMPTY);

        res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'LocalNine', 'w': 10, 'y': 1, 'x': 1 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 1 }));

        res = await request(app).get('/section/1');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).not.toEqual(Utils.JSON.EMPTY);

        res = await request(app).post('/section')
            .send({ 'h': 1800, 'space': 'LocalNine', 'w': 1500, 'y': 1, 'x': 1 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 2 }));

        res = await request(app).get('/section/2');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).not.toEqual(Utils.JSON.EMPTY);

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    it('should not be able to update anything related to a section when no app is present', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'LocalNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10 }));

        res = await request(app).post('/section/0')
            .send({ 'h': 100, 'space': 'LocalNine', 'w': 100, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10 }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);
    });

    it('should be supporting offsets', async () => {
        /* let res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'LocalNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).not.toEqual(Utils.JSON.EMPTY);

        res = await request(app).get('/client/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(
            { 'LocalNine': [ { }, { }, { }, { }, { }, { },
                { 'x': 0, 'y': 0, 'w': 10, 'h': 10, 'offset': { 'x': 110, 'y': 100 } }, { }, { } ] }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY); */
    });

    it('should be producing ove.js', async () => {
        const pjson = require(path.join('..', 'package.json'));
        let res = await request(app).get('/ove.js');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        // Sometimes uglify fails to minify ove.js. Then the response could be either undefined or empty.
        expect(res.text).not.toBeUndefined();
        expect(res.text).not.toEqual('');
        expect(res.text).toContain('ove.js v' + pjson.version);
        expect(res.text).toContain('Copyright (c) ' + pjson.author);
        expect(res.text).toContain('Released under ' + pjson.license + ' License');
    });

    it('should not be producing an ove.js with code comments', async () => {
        // This is so that the min doesn't have comments inside it.
        // All code comments must be added in the specified format.
        expect(fs.readFileSync(path.join(srcDir, 'client', 'ove.js')).toString())
            .not.toMatch(/\/\/ [^@CONSTANTS]/);
        expect(fs.readFileSync(path.join(srcDir, 'client', 'utils', 'utils.js')).toString())
            .not.toMatch(/\/\/ [^@CONSTANTS]/);
        expect(fs.readFileSync(path.join(srcDir, 'client', 'utils', 'constants.js')).toString())
            .not.toMatch(/\/\/ /);
    });
    /* jshint ignore:end */
});

// Some operations require a remote HTTP server to be running while the tests are in
// progress. These require nock along with a clean up after each test has run.
describe('The OVE Core server', () => {
    /* jshint ignore:start */
    // current version of JSHint does not support async/await
    it('should be able to successfully create and delete sections with an app', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'LocalNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        let scope = nock('http://localhost:8081').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        res = await request(app).delete('/section/0');
        expect(scope.isDone()).toBeTruthy(); // checks if the flush request was actually made.
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    it('should be able to successfully pre-load application state during creation of a section', async () => {
        let scope = nock('http://localhost:8081').post('/0/state', JSON.stringify({ 'foo': 'bar' })).reply(HttpStatus.OK, Utils.JSON.EMPTY);
        let scopeFlush = nock('http://localhost:8081').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081', 'states': { 'load': { 'foo': 'bar' } } }, 'space': 'LocalNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(scope.isDone()).toBeTruthy(); // checks if the state load request was actually made.
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10 }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
        expect(scopeFlush.isDone()).toBeTruthy(); // checks if the flush request was actually made.
    });

    it('should be able to successfully load named application state during creation of a section', async () => {
        let scope = nock('http://localhost:8081').post('/0/state', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        let scopeFlush = nock('http://localhost:8081').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081', 'states': { 'load': 'foo' } }, 'space': 'LocalNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(scope.isDone()).not.toBeTruthy(); // no state must be loaded
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10, 'state': 'foo' }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
        expect(scopeFlush.isDone()).toBeTruthy(); // checks if the flush request was actually made.
    });

    it('should be able to successfully cache application states during creation of a section', async () => {
        let scope1 = nock('http://localhost:8081').post('/state/dummy', JSON.stringify({ 'foo': 'bar' })).reply(HttpStatus.OK, Utils.JSON.EMPTY);
        let scope2 = nock('http://localhost:8081').post('/state/newDummy', JSON.stringify({ 'alpha': 'beta' })).reply(HttpStatus.OK, Utils.JSON.EMPTY);
        let scopeFlush = nock('http://localhost:8081').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081', 'states': { 'cache': { 'dummy': { 'foo': 'bar' }, 'newDummy': { 'alpha': 'beta' } } } }, 'space': 'LocalNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(scope1.isDone()).toBeTruthy(); // checks if the state load request was actually made.
        expect(scope2.isDone()).toBeTruthy(); // checks if the state load request was actually made.
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10 }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
        expect(scopeFlush.isDone()).toBeTruthy(); // checks if the flush request was actually made.
    });

    it('should be able to update the app of a section', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'LocalNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10 }));

        const mockCallback = jest.fn(x => x);
        const OLD_LOG_DEBUG = log.debug;
        log.debug = mockCallback;
        let scope = nock('http://localhost:8081').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        res = await request(app).post('/section/0')
            .send({ 'h': 100, 'app': { 'url': 'http://localhost:8082' }, 'space': 'LocalNine', 'w': 100, 'y': 0, 'x': 10 });
        expect(scope.isDone()).toBeTruthy(); // checks if the flush request was actually made.
        log.debug = OLD_LOG_DEBUG;
        expect(mockCallback.mock.calls[0][0]).toBe('Deleting existing application configuration');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        // dimensions should not change as the update only changes the app.
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10 }));

        scope = nock('http://localhost:8082').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
        expect(scope.isDone()).toBeTruthy(); // checks if the flush request was actually made.

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);
    });

    it('should not be flushing the app but still updating the section (when the update did not change the app)', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'LocalNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10 }));

        const mockCallback = jest.fn(x => x);
        const OLD_LOG_DEBUG = log.debug;
        log.debug = mockCallback;
        // scopes stay intact until the end of the test. Therefore, this scope will receive the flush
        // request made when calling 'delete /sections' below.
        let scope = nock('http://localhost:8081').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        res = await request(app).post('/section/0')
            .send({ 'h': 100, 'app': { 'url': 'http://localhost:8081' }, 'space': 'LocalNine', 'w': 100, 'y': 0, 'x': 10 });
        expect(scope.isDone()).not.toBeTruthy(); // checks if the flush request was actually made.
        log.debug = OLD_LOG_DEBUG;
        expect(mockCallback.mock.calls[0][0]).toBe('Deleting existing application configuration');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        // dimensions should not change as the update only changes the app.
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10 }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
        expect(scope.isDone()).toBeTruthy(); // checks if the flush request was actually made.

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);
    });

    it('should be able to discard the app of a section', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'LocalNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10 }));

        const mockCallback = jest.fn(x => x);
        const OLD_LOG_DEBUG = log.debug;
        log.debug = mockCallback;
        let scope = nock('http://localhost:8081').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        res = await request(app).post('/section/0')
            .send({ 'h': 100, 'space': 'LocalNine', 'w': 100, 'y': 0, 'x': 10 });
        expect(scope.isDone()).toBeTruthy(); // checks if the flush request was actually made.
        log.debug = OLD_LOG_DEBUG;
        expect(mockCallback.mock.calls[0][0]).toBe('Deleting existing application configuration');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        // dimensions should not change as the update only changes the app.
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10 }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);
    });

    it('should be able to successfully pre-load application state during an update of a section', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'LocalNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10 }));

        // We know by now that /flush works as expected.
        nock('http://localhost:8081').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        nock('http://localhost:8082').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        let scope = nock('http://localhost:8082').post('/0/state', JSON.stringify({ 'foo': 'bar' })).reply(HttpStatus.OK, Utils.JSON.EMPTY);
        res = await request(app).post('/section/0')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8082', 'states': { 'load': { 'foo': 'bar' } } }, 'space': 'LocalNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(scope.isDone()).toBeTruthy(); // checks if the state load request was actually made.
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10 }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    it('should be able to successfully load named application state during an update of a section', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'LocalNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10 }));

        // We know by now that /flush works as expected.
        nock('http://localhost:8081').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        nock('http://localhost:8082').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        let scope = nock('http://localhost:8082').post('/0/state', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        res = await request(app).post('/section/0')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8082', 'states': { 'load': 'foo' } }, 'space': 'LocalNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(scope.isDone()).not.toBeTruthy(); // no state must be loaded
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10, 'state': 'foo' }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    it('should be able to successfully cache application states during an update of a section', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'LocalNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10 }));

        // We know by now that /flush works as expected.
        nock('http://localhost:8081').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        nock('http://localhost:8082').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        let scope1 = nock('http://localhost:8082').post('/state/dummy', JSON.stringify({ 'foo': 'bar' })).reply(HttpStatus.OK, Utils.JSON.EMPTY);
        let scope2 = nock('http://localhost:8082').post('/state/newDummy', JSON.stringify({ 'alpha': 'beta' })).reply(HttpStatus.OK, Utils.JSON.EMPTY);
        res = await request(app).post('/section/0')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8082', 'states': { 'cache': { 'dummy': { 'foo': 'bar' }, 'newDummy': { 'alpha': 'beta' } } } }, 'space': 'LocalNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(scope1.isDone()).toBeTruthy(); // checks if the state load request was actually made.
        expect(scope2.isDone()).toBeTruthy(); // checks if the state load request was actually made.
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10 }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    afterEach(async () => {
        // Additional 'delete /sections' is a safety net - one test failure should not lead to many.
        await request(app).delete('/sections');
        nock.cleanAll();
    });
    /* jshint ignore:end */
});

jest.useFakeTimers();

// The server should be able to start on a random port.
describe('The OVE Core server', () => {
    const port = 5555;
    const httpRequest = () => {
        return request('http://localhost:' + port);
    };

    let server;
    beforeAll(() => {
        server = app.listen(port);
    });

    /* jshint ignore:start */
    // current version of JSHint does not support async/await
    it('should be starting up on port ' + port, async () => {
        let res = await httpRequest().get('/client/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);
    });
    /* jshint ignore:end */

    afterAll(() => {
        server.close();
    });
});
