const request = global.request;
const HttpStatus = global.HttpStatus;
const nock = global.nock;
const app = global.app;
const Utils = global.Utils;
const log = global.log;

// Some operations require a remote HTTP server to be running while the tests are in
// progress. These require nock along with a clean up after each test has run.
describe('The OVE Core server', () => {
    /* jshint ignore:start */
    // current version of JSHint does not support async/await
    it('should be able to successfully create and delete sections with an app', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        let scope = nock('http://localhost:8081').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        res = await request(app).delete('/section/0');
        expect(scope.isDone()).toBeTruthy(); // checks if the flush request was actually made.
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [0] }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    it('should fail to successfully create or update sections with an app without a URL', async () => {
        await request(app).post('/section')
            .send({ 'h': 10, 'app': { }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid app configuration' }));

        let res = await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8081' } }));

        let scope = nock('http://localhost:8081').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        await request(app).post('/section/0')
            .send({ 'h': 10, 'app': { }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid app configuration' }));
        expect(scope.isDone()).not.toBeTruthy(); // request should not be made at this point.

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    it('should be able to successfully create, read, update and delete groups for sections with an app', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8082' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 1 }));

        res = await request(app).post('/group').send([0]);
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/group/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([0]));

        res = await request(app).post('/group').send([1]);
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 1 }));

        res = await request(app).get('/group/1');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([1]));

        res = await request(app).post('/group/0').send([0, 1]);
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/group/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([0, 1]));

        res = await request(app).delete('/group/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        await request(app).get('/group/0')
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid group id' }));

        res = await request(app).delete('/group/1');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 1 }));

        await request(app).get('/group/1')
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid group id' }));

        nock('http://localhost:8081').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        nock('http://localhost:8082').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    it('should be able to successfully read, update and delete sections by group, with an app', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8082' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 1 }));

        res = await request(app).post('/group').send([0]);
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/group/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([0]));

        res = await request(app).post('/group').send([1]);
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 1 }));

        res = await request(app).get('/group/1');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([1]));

        res = await request(app).post('/group').send([0, 1]);
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 2 }));

        res = await request(app).get('/group/2');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([0, 1]));

        res = await request(app).get('/sections?groupId=1');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([ { 'id': 1, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8082' } } ]));

        res = await request(app).get('/sections?groupId=1&geometry=10,0,10,10');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([ { 'id': 1, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8082' } } ]));

        res = await request(app).get('/sections?groupId=1&geometry=0,0,10,10');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY_ARRAY);

        res = await request(app).get('/sections?groupId=2');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([ { 'id': 0, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8081' } }, { 'id': 1, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8082' } } ]));

        const mockCallback = jest.fn(x => x);
        const OLD_LOG_WARN = log.warn;
        log.warn = mockCallback;
        res = await request(app).get('/sections?groupId=1&geometry=100');
        log.warn = OLD_LOG_WARN;
        expect(mockCallback.mock.calls[0][0]).toBe('Ignoring invalid geometry:');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([ { 'id': 1, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8082' } } ]));

        res = await request(app).get('/sections?groupId=3');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY_ARRAY);

        res = await request(app).post('/sections?groupId=3').send({ 'space': 'TestingNine' });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);

        res = await request(app).delete('/sections?groupId=3');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [] }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).not.toEqual(Utils.JSON.EMPTY);

        res = await request(app).post('/sections?groupId=1').send({ 'space': 'TestingNine' });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [1] }));

        res = await request(app).post('/sections?groupId=2').send({ 'space': 'TestingNine' });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [0, 1] }));

        let scope1 = nock('http://localhost:8081').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        let scope2 = nock('http://localhost:8082').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        res = await request(app).delete('/sections?groupId=0');
        expect(scope1.isDone()).toBeTruthy(); // request should be made at this point.
        expect(scope2.isDone()).not.toBeTruthy(); // request should not be made at this point.
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [0] }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);

        await request(app).get('/group/0')
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid group id' }));

        await request(app).get('/group/2')
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid group id' }));

        await request(app).get('/group/1')
            .expect(HttpStatus.OK, JSON.stringify([1]));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);

        expect(scope2.isDone()).toBeTruthy(); // request should be made at this point.

        await request(app).get('/group/1')
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid group id' }));
    });

    it('should be able to successfully read, update and delete sections by space, with an app', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).post('/sections?space=FakeSpace').send({ 'space': 'TestingNine' });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);

        let scope = nock('http://localhost:8081').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);

        res = await request(app).delete('/sections?space=FakeSpace');
        expect(scope.isDone()).not.toBeTruthy(); // request should not be made at this point.
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [] }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).not.toEqual(Utils.JSON.EMPTY);

        res = await request(app).get('/sections?space=TestingNine');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([ { 'id': 0, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8081' } } ]));

        res = await request(app).get('/sections?space=TestingNine&geometry=10,0,10,10');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([ { 'id': 0, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8081' } } ]));

        res = await request(app).get('/sections?space=TestingNine&geometry=0,0,10,10');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY_ARRAY);

        const mockCallback = jest.fn(x => x);
        const OLD_LOG_WARN = log.warn;
        log.warn = mockCallback;
        res = await request(app).get('/sections?space=TestingNine&geometry=100');
        log.warn = OLD_LOG_WARN;
        expect(mockCallback.mock.calls[0][0]).toBe('Ignoring invalid geometry:');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([ { 'id': 0, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8081' } } ]));

        res = await request(app).get('/sections?space=Fake');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY_ARRAY);

        res = await request(app).post('/sections?space=TestingNine').send({ 'space': 'TestingNine' });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [0] }));

        res = await request(app).delete('/sections?space=TestingNine');
        expect(scope.isDone()).toBeTruthy(); // checks if the flush request was actually made.
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [0] }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    it('should be able to successfully read and update all sections, with an app', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        nock('http://localhost:8081').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);

        res = await request(app).get('/sections');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([ { 'id': 0, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8081' } } ]));

        await request(app).post('/sections').send({ 'translate': { x: -11, y: 0 } })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8081' } }));

        res = await request(app).post('/sections').send({ 'scale': { x: 10, y: 1 } });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [0] }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 100, 'h': 10, 'app': { 'url': 'http://localhost:8081' } }));

        res = await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8082' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 1 }));

        res = await request(app).delete('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [0] }));

        res = await request(app).get('/sections');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([ { 'id': 1, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8082' } } ]));

        nock('http://localhost:8082').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);

        res = await request(app).get('/sections');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY_ARRAY);
    });

    it('should be able to successfully pre-load application state during creation of a section', async () => {
        let scope = nock('http://localhost:8081').post('/0/state', JSON.stringify({ 'foo': 'bar' })).reply(HttpStatus.OK, Utils.JSON.EMPTY);
        let scopeFlush = nock('http://localhost:8081').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081', 'states': { 'load': { 'foo': 'bar' } } }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(scope.isDone()).toBeTruthy(); // checks if the state load request was actually made.
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8081' } }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
        expect(scopeFlush.isDone()).toBeTruthy(); // checks if the flush request was actually made.
    });

    it('should be able to successfully load named application state during creation of a section', async () => {
        let scope = nock('http://localhost:8081').post('/0/state', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        let scopeFlush = nock('http://localhost:8081').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081', 'states': { 'load': 'foo' } }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(scope.isDone()).not.toBeTruthy(); // no state must be loaded
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8081', state: 'foo' } }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
        expect(scopeFlush.isDone()).toBeTruthy(); // checks if the flush request was actually made.
    });

    it('should be able to successfully cache application states during creation of a section', async () => {
        let scope1 = nock('http://localhost:8081').post('/state/dummy', JSON.stringify({ 'foo': 'bar' })).reply(HttpStatus.OK, Utils.JSON.EMPTY);
        let scope2 = nock('http://localhost:8081').post('/state/newDummy', JSON.stringify({ 'alpha': 'beta' })).reply(HttpStatus.OK, Utils.JSON.EMPTY);
        let scopeFlush = nock('http://localhost:8081').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081', 'states': { 'cache': { 'dummy': { 'foo': 'bar' }, 'newDummy': { 'alpha': 'beta' } } } }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(scope1.isDone()).toBeTruthy(); // checks if the state load request was actually made.
        expect(scope2.isDone()).toBeTruthy(); // checks if the state load request was actually made.
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8081' } }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
        expect(scopeFlush.isDone()).toBeTruthy(); // checks if the flush request was actually made.
    });

    it('should be able to update the app of a section', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8081' } }));

        const mockCallback = jest.fn(x => x);
        const OLD_LOG_DEBUG = log.debug;
        log.debug = mockCallback;
        let scope = nock('http://localhost:8081').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        res = await request(app).post('/section/0')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8082' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(scope.isDone()).toBeTruthy(); // checks if the flush request was actually made.
        log.debug = OLD_LOG_DEBUG;
        expect(mockCallback.mock.calls[0][0]).toBe('Deleting existing application configuration');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        // dimensions should not change as the update only changes the app.
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8082' } }));

        scope = nock('http://localhost:8082').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
        expect(scope.isDone()).toBeTruthy(); // checks if the flush request was actually made.

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);
    });

    it('should be able to update the app of a section that never had an app', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10 }));

        let scope = nock('http://localhost:8081').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        res = await request(app).post('/section/0')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8082' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(scope.isDone()).not.toBeTruthy(); // request should not be made at this point.
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        // dimensions should not change as the update only changes the app.
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8082' } }));

        scope = nock('http://localhost:8082').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
        expect(scope.isDone()).toBeTruthy(); // checks if the flush request was actually made.

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);
    });

    it('should be able to update the app of a section, without providing space name and dimensions', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8081' } }));

        const mockCallback = jest.fn(x => x);
        const OLD_LOG_DEBUG = log.debug;
        log.debug = mockCallback;
        let scope = nock('http://localhost:8081').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        res = await request(app).post('/section/0')
            .send({ 'app': { 'url': 'http://localhost:8082' } });
        expect(scope.isDone()).toBeTruthy(); // checks if the flush request was actually made.
        log.debug = OLD_LOG_DEBUG;
        expect(mockCallback.mock.calls[0][0]).toBe('Deleting existing application configuration');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        // dimensions should not change as the update only changes the app.
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8082' } }));

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
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8081' } }));

        const mockCallback = jest.fn(x => x);
        const OLD_LOG_DEBUG = log.debug;
        log.debug = mockCallback;
        // scopes stay intact until the end of the test. Therefore, this scope will receive the flush
        // request made when calling 'delete /sections' below.
        let scope = nock('http://localhost:8081').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        res = await request(app).post('/section/0')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(scope.isDone()).not.toBeTruthy(); // checks if the flush request was actually made.
        log.debug = OLD_LOG_DEBUG;
        expect(mockCallback.mock.calls[0][0]).toBe('Deleting existing application configuration');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        // dimensions should not change as the update only changes the app.
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8081' } }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
        expect(scope.isDone()).toBeTruthy(); // checks if the flush request was actually made.

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);
    });

    it('should be able to discard the app of a section', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8081' } }));

        const mockCallback = jest.fn(x => x);
        const OLD_LOG_DEBUG = log.debug;
        log.debug = mockCallback;
        let scope = nock('http://localhost:8081').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        res = await request(app).post('/section/0')
            .send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
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
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8081' } }));

        // We know by now that /flush works as expected.
        nock('http://localhost:8081').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        nock('http://localhost:8082').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        let scope = nock('http://localhost:8082').post('/0/state', JSON.stringify({ 'foo': 'bar' })).reply(HttpStatus.OK, Utils.JSON.EMPTY);
        res = await request(app).post('/section/0')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8082', 'states': { 'load': { 'foo': 'bar' } } }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(scope.isDone()).toBeTruthy(); // checks if the state load request was actually made.
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8082' } }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    it('should be able to successfully load named application state during an update of a section', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8081' } }));

        // We know by now that /flush works as expected.
        nock('http://localhost:8081').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        nock('http://localhost:8082').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        let scope = nock('http://localhost:8082').post('/0/state', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        res = await request(app).post('/section/0')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8082', 'states': { 'load': 'foo' } }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(scope.isDone()).not.toBeTruthy(); // no state must be loaded
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8082', state: 'foo' } }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    it('should be able to successfully cache application states during an update of a section', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8081' } }));

        // We know by now that /flush works as expected.
        nock('http://localhost:8081').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        nock('http://localhost:8082').post('/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        let scope1 = nock('http://localhost:8082').post('/state/dummy', JSON.stringify({ 'foo': 'bar' })).reply(HttpStatus.OK, Utils.JSON.EMPTY);
        let scope2 = nock('http://localhost:8082').post('/state/newDummy', JSON.stringify({ 'alpha': 'beta' })).reply(HttpStatus.OK, Utils.JSON.EMPTY);
        res = await request(app).post('/section/0')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8082', 'states': { 'cache': { 'dummy': { 'foo': 'bar' }, 'newDummy': { 'alpha': 'beta' } } } }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(scope1.isDone()).toBeTruthy(); // checks if the state load request was actually made.
        expect(scope2.isDone()).toBeTruthy(); // checks if the state load request was actually made.
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10, 'app': { 'url': 'http://localhost:8082' } }));

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
