const request = global.request;
const HttpStatus = global.HttpStatus;
const app = global.app;
const Utils = global.Utils;
const nock = global.nock;
const TestUtils = global.TestUtils;

// Core functionality tests.
describe('The OVE Core server', () => {
    const OLD_CONSOLE = global.console;
    const OLD_ENV = process.env;
    beforeAll(() => {
        jest.resetModules();
        process.env = { ...OLD_ENV };
        process.env.OVE_HOST = 'localhost:8080';
        global.console = { log: jest.fn(x => x), warn: jest.fn(x => x), error: jest.fn(x => x) };
    });

    /* jshint ignore:start */
    // current version of JSHint does not support async/await
    it('should fail to update sections with invalid requests', async () => {
        await request(app).post('/section').send({ fake: 'request' })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid space' }));
        await request(app).post('/sections/transform').send({ fake: 'request' })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid operation' }));
        await request(app).post('/sections/moveTo').send({ fake: 'request' })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid operation' }));
        await request(app).post('/group').send({ fake: 'request' })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid group' }));

        let res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).post('/group').send([0]);
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        await request(app).post('/sections/0').send({ fake: 'request' })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid operation' }));
        await request(app).post('/groups/0').send({ fake: 'request' })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid group' }));
        await request(app).post('/groups/0').send([{ fake: 'request' }])
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid group' }));
        await request(app).post('/groups/0').send(['fake request'])
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid group' }));

        res = await request(app).delete('/groups/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    it('should not accept non-numeric section and group ids', async () => {
        await request(app).get('/sections/foo').expect(HttpStatus.NOT_FOUND);
        await request(app).post('/sections/foo').send({ some: 'request' }).expect(HttpStatus.NOT_FOUND);
        await request(app).delete('/sections/foo').expect(HttpStatus.NOT_FOUND);

        await request(app).get('/groups/foo').expect(HttpStatus.NOT_FOUND);
        await request(app).post('/groups/foo').send({ some: 'request' }).expect(HttpStatus.NOT_FOUND);
        await request(app).delete('/groups/foo').expect(HttpStatus.NOT_FOUND);
    });

    it('should be able to successfully create and delete sections without an app', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/sections/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).not.toEqual(Utils.JSON.EMPTY);

        res = await request(app).delete('/sections/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [0] }));

        res = await request(app).get('/sections/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    it('should be able to successfully create, read, update and delete groups for sections without an app', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 1 }));

        res = await request(app).post('/group').send([0]);
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/groups/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([0]));

        res = await request(app).post('/group').send([1]);
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 1 }));

        res = await request(app).get('/groups/1');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([1]));

        res = await request(app).get('/groups');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([[0], [1]]));

        res = await request(app).post('/groups/0').send([0, 1]);
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/groups/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([0, 1]));

        res = await request(app).get('/groups');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([[0, 1], [1]]));

        res = await request(app).delete('/groups/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        await request(app).get('/groups/0')
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid group id' }));

        res = await request(app).get('/groups');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([[1]]));

        res = await request(app).delete('/groups/1');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 1 }));

        await request(app).get('/groups/1')
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid group id' }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    it('should be able to successfully read, update and delete sections by group, without an app', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 1 }));

        res = await request(app).post('/group').send([0]);
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/groups/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([0]));

        res = await request(app).post('/group').send([1]);
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 1 }));

        res = await request(app).get('/groups/1');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([1]));

        res = await request(app).post('/group').send([0, 1]);
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 2 }));

        res = await request(app).get('/groups/2');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([0, 1]));

        res = await request(app).get('/sections?groupId=1');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([ { 'id': 1, 'x': 10, 'y': 0, 'w': 10, 'h': 10, 'space': 'TestingNine' } ]));

        res = await request(app).get('/sections?groupId=1&geometry=10,0,10,10');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([ { 'id': 1, 'x': 10, 'y': 0, 'w': 10, 'h': 10, 'space': 'TestingNine' } ]));

        res = await request(app).get('/sections?groupId=1&geometry=0,0,10,10');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY_ARRAY);

        res = await request(app).get('/sections?groupId=2');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([ { 'id': 0, 'x': 10, 'y': 0, 'w': 10, 'h': 10, 'space': 'TestingNine' }, { 'id': 1, 'x': 10, 'y': 0, 'w': 10, 'h': 10, 'space': 'TestingNine' } ]));

        res = await request(app).get('/sections?groupId=3');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY_ARRAY);

        res = await request(app).post('/sections/moveTo?groupId=3').send({ 'space': 'TestingNine' });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);

        res = await request(app).delete('/sections?groupId=3');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [] }));

        res = await request(app).get('/sections/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).not.toEqual(Utils.JSON.EMPTY);

        res = await request(app).post('/sections/moveTo?groupId=1').send({ 'space': 'TestingNine' });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [1] }));

        res = await request(app).post('/sections/moveTo?groupId=2').send({ 'space': 'TestingNine' });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [0, 1] }));

        res = await request(app).delete('/sections?groupId=0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [0] }));

        res = await request(app).get('/sections/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);

        await request(app).get('/groups/0')
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid group id' }));

        await request(app).get('/groups/2')
            .expect(HttpStatus.OK, JSON.stringify([1]));

        await request(app).get('/groups/1')
            .expect(HttpStatus.OK, JSON.stringify([1]));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);

        await request(app).get('/groups/1')
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid group id' }));
    });

    it('should be able to successfully read, update and delete sections by space, without an app', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).post('/sections/moveTo?space=FakeSpace').send({ 'space': 'TestingNine' });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);

        res = await request(app).delete('/sections?space=FakeSpace');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [] }));

        res = await request(app).get('/sections/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).not.toEqual(Utils.JSON.EMPTY);

        res = await request(app).get('/sections?space=TestingNine');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([ { 'id': 0, 'x': 10, 'y': 0, 'w': 10, 'h': 10, 'space': 'TestingNine' } ]));

        res = await request(app).get('/sections?space=TestingNine&geometry=10,0,10,10');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([ { 'id': 0, 'x': 10, 'y': 0, 'w': 10, 'h': 10, 'space': 'TestingNine' } ]));

        res = await request(app).get('/sections?space=TestingNine&geometry=0,0,10,10');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY_ARRAY);

        res = await request(app).get('/sections?space=Fake');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY_ARRAY);

        res = await request(app).post('/sections/moveTo?space=TestingNine').send({ 'space': 'TestingNine' });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [0] }));

        res = await request(app).delete('/sections?space=TestingNine');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [0] }));

        res = await request(app).get('/sections/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    it('should be able to successfully update all sections, without an app', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/sections/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'x': 10, 'y': 0, 'w': 10, 'h': 10, 'space': 'TestingNine' }));

        await request(app).post('/sections/transform').send({ 'translate': { x: -11, y: 0 } })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));

        res = await request(app).get('/sections/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'x': 10, 'y': 0, 'w': 10, 'h': 10, 'space': 'TestingNine' }));

        res = await request(app).post('/sections/transform').send({ 'scale': { x: 10, y: 1 } });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [0] }));

        res = await request(app).get('/sections/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'x': 10, 'y': 0, 'w': 100, 'h': 10, 'space': 'TestingNine' }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    it('should be able to successfully update sections when some sections have been deleted', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 1 }));

        res = await request(app).post('/group').send([0]);
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).post('/group').send([1]);
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 1 }));

        res = await request(app).post('/group').send([0, 1]);
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 2 }));

        res = await request(app).delete('/sections/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [0] }));

        res = await request(app).post('/sections/moveTo?groupId=2').send({ 'space': 'TestingFour' });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [1] }));

        res = await request(app).post('/sections/moveTo').send({ 'space': 'TestingNine' });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [1] }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    it('should be able to successfully create sections of various sizes', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/sections/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).not.toEqual(Utils.JSON.EMPTY);

        res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 1, 'x': 1 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 1 }));

        res = await request(app).get('/sections/1');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).not.toEqual(Utils.JSON.EMPTY);

        res = await request(app).post('/section')
            .send({ 'h': 1800, 'space': 'TestingNine', 'w': 1500, 'y': 1, 'x': 1 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 2 }));

        res = await request(app).get('/sections/2');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).not.toEqual(Utils.JSON.EMPTY);

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    it('should be able to update section dimensions, without an app', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/sections/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'x': 10, 'y': 0, 'w': 10, 'h': 10, 'space': 'TestingNine' }));

        res = await request(app).post('/sections/0')
            .send({ 'h': 100, 'space': 'TestingNine', 'w': 100, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/sections/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'x': 10, 'y': 0, 'w': 100, 'h': 100, 'space': 'TestingNine' }));

        res = await request(app).post('/sections/0')
            .send({ 'h': 200, 'y': 10, 'x': 0 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/sections/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'x': 10, 'y': 0, 'w': 100, 'h': 200, 'space': 'TestingNine' }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);

        res = await request(app).get('/sections/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);
    });

    it('should let you update the space, without an app, but only if the request was valid', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/sections/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'x': 10, 'y': 0, 'w': 10, 'h': 10, 'space': 'TestingNine' }));

        await request(app).post('/sections/0')
            .send({ 'h': 10, 'space': 'FakeSpace', 'w': 10, 'y': 0, 'x': 10 })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid space' }));

        await request(app).post('/sections/0')
            .send({ 'h': 10, 'space': 'TestingFour', 'w': 10 })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));

        await request(app).post('/sections/0')
            .send({ 'h': 10, 'space': 'TestingFour', 'w': 10, 'y': 0 })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));

        res = await request(app).post('/sections/0')
            .send({ 'space': 'TestingFour', 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);

        res = await request(app).get('/sections/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);
    });

    it('should fail when updating section dimensions, if either x or y is not provided', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/sections/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'x': 10, 'y': 0, 'w': 10, 'h': 10, 'space': 'TestingNine' }));

        await request(app).post('/sections/0')
            .send({ 'h': 100, 'space': 'TestingNine', 'w': 100 })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));

        await request(app).post('/sections/0')
            .send({ 'h': 100, 'space': 'TestingNine', 'w': 100, 'y': 0 })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));

        await request(app).post('/sections/0')
            .send({ 'x': 10 })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);

        res = await request(app).get('/sections/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);
    });

    it('should be able to successfully create and delete connections between two spaces', async () => {
        const primary = { space: 'TestingNine', host: 'localhost:8080' };
        const secondary = { space: 'TestingNineClone', host: 'localhost:8080' };
        TestUtils.createConnection('TestingNineClone');

        await request(app).post('/connection/TestingNine/TestingNineClone')
            .expect(HttpStatus.OK, JSON.stringify({ ids: [] }));

        await request(app).get('/connections?space=TestingNine')
            .expect(HttpStatus.OK, JSON.stringify({ primary: primary, secondary: [secondary], sections: {} }));

        TestUtils.nock(8080, 'GET', '/api/getConnection');
        TestUtils.nock(8080, 'DELETE', '/api/removeConnection');

        await request(app).delete('/connection/TestingNine/TestingNineClone')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    it('should return special message if no connections present', async () => {
        await request(app).get('/connections?space=TestingNine')
            .expect(HttpStatus.OK, JSON.stringify({ msg: 'No connections for space: TestingNine' }));
    });

    it('lists all connections if no space specified', async () => {
        TestUtils.createConnection('TestingNineClone');
        await request(app).post('/connection/TestingNine/TestingNineClone');
        TestUtils.createConnection('TestingFourClone');
        await request(app).post('/connection/TestingFour/TestingFourClone');

        let res = await request(app).get('/connections');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        const connections = JSON.parse(res.text);
        expect(connections.length).toBe(2);
    });

    it('returns empty list if no connections', async () => {
        let res = await request(app).get('/connections');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        const connections = JSON.parse(res.text);
        expect(connections.length).toBe(0);
    });

    it('fetching section connection details errors if section is not connected', async () => {
        await request(app).get('/connections/section/2')
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'Section 2 is not connected' }));
    });

    it('fetches correct mapping of section connection details for primary sections', async () => {
        TestUtils.createConnection('TestingNineClone');
        TestUtils.duplicateSection('TestingNine', ['TestingNineClone']);

        await request(app).post('/connection/TestingNine/TestingNineClone');
        await request(app).post('/section').send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        await request(app).get(`/connections/section/0`)
            .expect(HttpStatus.OK, JSON.stringify({ section: { primary: 0, secondary: [1] } }));
    });

    it('fetches correct mapping of section connection details for secondary sections', async () => {
        await request(app).post('/section').send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 })
            .expect(HttpStatus.OK, JSON.stringify({ id: 0 }));
        TestUtils.createConnection('TestingNineClone');
        TestUtils.duplicateSection('TestingNine', ['TestingNineClone']);
        await request(app).post('/connection/TestingNine/TestingNineClone')
            .expect(HttpStatus.OK, JSON.stringify({ ids: [1] }));
        await request(app).get('/connections/section/1')
            .expect(HttpStatus.OK, JSON.stringify({ section: { primary: 0, secondary: 1 } }));
    });

    it('allows multiple replica spaces to be connected', async () => {
        TestUtils.createConnection('TestingNineClone');
        await request(app).post('/connection/TestingNine/TestingNineClone')
            .expect(HttpStatus.OK);

        TestUtils.createConnection('TestingFour');
        await request(app).post('/connection/TestingNine/TestingFour')
            .expect(HttpStatus.OK);
    });

    it('can create multiple sections in a connected space', async () => {
        TestUtils.createConnection('TestingNineClone');
        await request(app).post('/connection/TestingNine/TestingNineClone');

        TestUtils.duplicateSection('TestingNine', ['TestingNineClone']);
        await request(app).post('/section').send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 })
            .expect(HttpStatus.OK, JSON.stringify({ id: 0 }));

        TestUtils.duplicateSection('TestingNine', ['TestingNineClone']);
        await request(app).post('/section').send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 })
            .expect(HttpStatus.OK, JSON.stringify({ id: 2 }));
    });

    it('deleting connection by secondary space only deletes that connection', async () => {
        TestUtils.createConnection('TestingNineClone');
        await request(app).post('/connection/TestingNine/TestingNineClone');
        TestUtils.createConnection('TestingFour');
        await request(app).post('/connection/TestingNine/TestingFour');

        TestUtils.duplicateSection('TestingNine', ['TestingNineClone', 'TestingFour']);
        await request(app).post('/section').send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });

        TestUtils.nock(8080, 'GET', '/api/getConnection');
        TestUtils.nock(8080, 'DELETE', '/api/deleteSpace');
        TestUtils.nock(8080, 'DELETE', '/api/deleteAllForSpace');
        await request(app).delete('/connection/TestingNine/TestingNineClone')
            .expect(HttpStatus.OK);
        await request(app).get('/connections/section/2')
            .expect(HttpStatus.OK, JSON.stringify({ section: { primary: 0, secondary: 2 } }));
    });

    it('deleting connection by primary deletes all connections', async () => {
        TestUtils.createConnection('TestingNineClone');
        await request(app).post('/connection/TestingNine/TestingNineClone');
        TestUtils.createConnection('TestingFour');
        await request(app).post('/connection/TestingNine/TestingFour');
        TestUtils.duplicateSection('TestingNine', ['TestingNineClone', 'TestingFour']);
        await request(app).post('/section').send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });

        TestUtils.nock(8080, 'GET', '/api/getConnection');
        TestUtils.nock(8080, 'DELETE', '/api/removeConnection');
        await request(app).delete('/connection/TestingNine')
            .expect(HttpStatus.OK);
        await request(app).get('/connections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY_ARRAY);
    });

    it('can create connection for a space with a section with an app', async () => {
        TestUtils.createConnection('TestingNineClone');
        await request(app).post('/connection/TestingNine/TestingNineClone');
        TestUtils.duplicateSection('TestingNine', ['TestingNineClone']);
        await request(app).post('/section').send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10, 'app': { 'url': 'http://localhost:8080/app/maps', states: { 'load': 'London' } } })
            .expect(HttpStatus.OK);
    });

    it('deletes all sections in replicas if deleting all in primary', async () => {
        TestUtils.createConnection('TestingNineClone');
        await request(app).post('/connection/TestingNine/TestingNineClone');
        TestUtils.createConnection('TestingFour');
        await request(app).post('/connection/TestingNine/TestingFour');

        TestUtils.duplicateSection('TestingNine', ['TestingNineClone', 'TestingFour']);
        await request(app).post('/section').send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        TestUtils.duplicateSection('TestingNine', ['TestingNineClone', 'TestingFour']);
        await request(app).post('/section').send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });

        TestUtils.nock(8080, 'DELETE', '/sections/1');
        TestUtils.nock(8080, 'DELETE', '/sections/4');
        TestUtils.nock(8080, 'DELETE', '/sections/2');
        TestUtils.nock(8080, 'DELETE', '/sections/5');
        TestUtils.nock(8080, 'DELETE', '/api/deleteSecondarySection/1');
        TestUtils.nock(8080, 'DELETE', '/api/deleteSecondarySection/4');
        TestUtils.nock(8080, 'DELETE', '/api/deleteSecondarySection/2');
        TestUtils.nock(8080, 'DELETE', '/api/deleteSecondarySection/5');
        TestUtils.nock(8080, 'GET', '/api/getConnection');
        TestUtils.nock(8080, 'GET', '/api/getConnection');
        TestUtils.nock(8080, 'GET', '/api/getConnection');
        TestUtils.nock(8080, 'GET', '/api/getConnection');
        await request(app).delete('/sections?space=TestingNine')
            .expect(HttpStatus.OK);
        await request(app).get('/sections?space=TestingNineClone')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY_ARRAY);
        await request(app).get('/sections?space=TestingFour')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY_ARRAY);
    });

    /* it('should not be able to delete sections in secondary space', async () => {
        TestUtils.createConnection('TestingNineClone');
        await request(app).post('/connection/TestingNine/TestingNineClone');
        TestUtils.duplicateSection('TestingNine', ['TestingNineClone']);
        await request(app).post('/section').send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });

        await request(app).delete('/sections?space=TestingNineClone')
            .expect(HttpStatus.BAD_REQUEST);

        const res = await request(app).get('/connections');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(JSON.parse(res.text).length).toBe(1);
    }); */

    it('should update all replicas if updating a primary section', async () => {
        TestUtils.createConnection('TestingNineClone');
        await request(app).post('/connection/TestingNine/TestingNineClone');
        TestUtils.duplicateSection('TestingNine', ['TestingNineClone']);
        await request(app).post('/section').send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });

        TestUtils.nock(8080, 'POST', '/sections/1');
        await request(app).post('/sections/0').send({ 'h': 10, 'space': 'TestingNine', 'w': 20, 'y': 0, 'x': 20 })
            .expect(HttpStatus.OK);

        const res = await request(app).get('/sections/1');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(JSON.parse(res.text).w).toEqual(20);
    });

    /* it('should not be able to update a secondary section', async () => {
        await request(app).post('/connection/TestingNine/TestingNineClone');
        await request(app).post('/section').send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        let res = await request(app).post('/sections/1').send({ 'h': 10, 'space': 'TestingNineClone', 'w': 20, 'y': 0, 'x': 20 });
        expect(res.statusCode).toEqual(HttpStatus.BAD_REQUEST);
        res = await request(app).get('/connections');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(JSON.parse(res.text).length).toBe(1);
    }); */

    it('should delete all replica sections if deleting a primary section', async () => {
        TestUtils.createConnection('TestingNineClone');
        await request(app).post('/connection/TestingNine/TestingNineClone');
        TestUtils.duplicateSection('TestingNine', ['TestingNineClone']);
        await request(app).post('/section').send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });

        TestUtils.nock(8080, 'DELETE', '/sections/1');
        await request(app).delete('/sections/0').expect(HttpStatus.OK);

        const res = await request(app).get('/sections?space=TestingNineClone');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([]));
    });

    /* it('should not be able to delete a secondary section', async () => {
        await request(app).post('/connection/TestingNine/TestingNineClone');
        await request(app).post('/section').send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        let res = await request(app).delete('/sections/1');
        expect(res.statusCode).toEqual(HttpStatus.BAD_REQUEST);
        res = await request(app).get('/connections');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(JSON.parse(res.text).length).toBe(1);
    }); */

    it('should error when connecting a space to itself', async () => {
        TestUtils.createConnection('TestingNine');
        await request(app).post('/connection/TestingNine/TestingNine')
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'Primary and secondary spaces are the same' }));
    });

    it('should error when connecting a primary space as a secondary', async () => {
        TestUtils.createConnection('TestingNineClone');
        await request(app).post('/connection/TestingNine/TestingNineClone');
        TestUtils.createConnection('TestingNine');
        await request(app).post('/connection/TestingFour/TestingNine')
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'Could not connect TestingFour and TestingNine as there is an existing connection' }));
    });

    it('can delete all connections', async () => {
        TestUtils.createConnection('TestingNineClone');
        TestUtils.createConnection('TestingFourClone');
        await request(app).post('/connection/TestingNine/TestingNineClone');
        await request(app).post('/connection/TestingFour/TestingFourClone');
        await request(app).delete('/connections').expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    it('can delete all sections when no space is or group is specified', async () => {
        TestUtils.createConnection('TestingNineClone');
        await request(app).post('/connection/TestingNine/TestingNineClone');
        TestUtils.duplicateSection('TestingNine', ['TestingNineClone']);
        await request(app).post('/section').send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        await request(app).delete('/sections').expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    /* it('should error when connecting a secondary space', async () => {
        await request(app).post('/connection/TestingNine/TestingNineClone');
        let res = await request(app).post('/connection/TestingNineClone/TestingFour');
        expect(res.statusCode).toEqual(HttpStatus.BAD_REQUEST);
        expect(res.text).toEqual(JSON.stringify({ error: 'Could not connect TestingNineClone and TestingFour as there is an existing connection' }));
        res = await request(app).post('/connection/TestingFour/TestingNineClone');
        expect(res.statusCode).toEqual(HttpStatus.BAD_REQUEST);
        expect(res.text).toEqual(JSON.stringify({ error: 'Could not connect TestingFour and TestingNineClone as there is an existing connection' }));
    }); */

    it('should return empty when sending event without connection', async () => {
        await request(app).post('/section').send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        await request(app).post('/event/0')
            .expect(HttpStatus.OK, JSON.stringify({}));
    });

    it('should fail if no section for id', async () => {
        await request(app).post('/event/0')
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'No section found for id: 0' }));
    });

    it('should send events from secondary to primary sections', async () => {
        TestUtils.createConnection('TestingNineClone');
        await request(app).post('/connection/TestingNine/TestingNineClone');
        TestUtils.duplicateSection('TestingNine', ['TestingNineClone']);
        await request(app).post('/section').send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        await request(app).post('/event/1').send({ appId: 'test', sectionId: '1', message: {} })
            .expect(HttpStatus.OK, JSON.stringify({ ids: [0] }));
    });

    it('should send events from primary to secondary sections', async () => {
        TestUtils.createConnection('TestingNineClone');
        await request(app).post('/connection/TestingNine/TestingNineClone');
        TestUtils.createConnection('TestingFour');
        await request(app).post('/connection/TestingNine/TestingFour');
        TestUtils.duplicateSection('TestingNine', ['TestingNineClone', 'TestingFour']);
        await request(app).post('/section').send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        await request(app).post('/event/0').send({ appId: 'test', sectionId: '0', message: {} })
            .expect(HttpStatus.OK, JSON.stringify({ ids: [1, 2] }));
    });

    /* it('should fail to create section in secondary space', async () => {
        await request(app).post('/connection/TestingNine/TestingNineClone');
        await request(app).post('/section').send({ 'h': 10, 'space': 'TestingNineClone', 'w': 10, 'y': 0, 'x': 10 })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'Operation unavailable as space is connected as a replica' }));
    }); */

    it('should refresh replicated sections', async () => {
        TestUtils.createConnection('TestingNineClone');
        await request(app).post('/connection/TestingNine/TestingNineClone');
        TestUtils.duplicateSection('TestingNine', ['TestingNineClone']);
        await request(app).post('/section').send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        TestUtils.nock(8080, 'POST', '/sections/1/refresh');
        await request(app).post('/sections/0/refresh')
            .expect(HttpStatus.OK, JSON.stringify({ ids: [0] }));
    });

    it('should refresh replicated spaces', async () => {
        TestUtils.createConnection('TestingNineClone');
        await request(app).post('/connection/TestingNine/TestingNineClone');
        TestUtils.duplicateSection('TestingNine', ['TestingNineClone']);
        await request(app).post('/section').send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        TestUtils.nock(8080, 'POST', '/sections/refresh?space=TestingNine');
        await request(app).post('/sections/refresh?space=TestingNine')
            .expect(HttpStatus.OK, JSON.stringify({ ids: [0] }));
    });

    it('cannot move connected sections', async () => {
        TestUtils.createConnection('TestingNineClone');
        await request(app).post('/connection/TestingNine/TestingNineClone');
        TestUtils.duplicateSection('TestingNine', ['TestingNineClone']);
        await request(app).post('/section').send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        TestUtils.nock(8080, 'POST', '/sections/moveTo?space=TestingNine');
        await request(app).post('/sections/moveTo?space=TestingNine').send({ space: 'TestingNineClone' })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'Operation unavailable as space is currently connected' }));
    });

    it('should error with most specific connection if trying to delete a non-existent connection', async () => {
        TestUtils.nock(8080, 'GET', '/api/getConnection');
        await request(app).delete('/connection/TestingNine/TestingNineClone')
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'No connection for space: TestingNineClone' }));
        TestUtils.nock(8080, 'GET', '/api/getConnection');
        await request(app).delete('/connection/TestingNine')
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'No connection for space: TestingNine' }));
    });

    it('should cache across all replicas if caching state of primary section', async () => {
        TestUtils.createConnection('TestingNineClone');
        await request(app).post('/connection/TestingNine/TestingNineClone');
        TestUtils.duplicateSection('TestingNine', ['TestingNineClone']);
        await request(app).post('/section').send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10, 'app': { 'url': 'http://localhost:8082' } });
        TestUtils.nock(8080, 'GET', '/api/getURLForId/1');
        nock('http://localhost:8080').post('/instances/1/state').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        await request(app).post('/cache/0').send({}).expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    it('should cache replica state to other replicas and primary section', async () => {
        TestUtils.createConnection('TestingNineClone');
        await request(app).post('/connection/TestingNine/TestingNineClone');
        TestUtils.duplicateSection('TestingNine', ['TestingNineClone']);
        await request(app).post('/section').send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10, 'app': { 'url': 'http://localhost:8082' } });
        TestUtils.nock(8080, 'GET', '/api/getURLForId/0');
        nock('http://localhost:8082').post('/instances/0/state').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        await request(app).post('/cache/1').send({}).expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    it('should not cache state for non-existent connection', async () => {
        await request(app).post('/section').send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10, 'app': { 'url': 'http://localhost:8082' } });
        await request(app).post('/cache/0').expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    it('should replicate state when creating replicated sections', async () => {
        nock('http://localhost:8081').get('/test/instances/0/state').reply(HttpStatus.OK, JSON.stringify({ state: 'test' }));
        nock('http://localhost:8081').post('/test/instances/1/state').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        nock('http://localhost:8081').post('/test/instances/0/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        nock('http://localhost:8081').post('/test/instances/1/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        TestUtils.createConnection('TestingNineClone');
        await request(app).post('/connection/TestingNine/TestingNineClone');
        TestUtils.duplicateSection('TestingNine', ['TestingNineClone']);
        await request(app).post('/section').send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10, 'app': { 'url': 'http://localhost:8081/test', 'states': { 'load': 'London' } } })
            .expect(HttpStatus.OK, JSON.stringify({ id: 0 }));
    });
    /* jshint ignore:end */

    afterEach(async () => {
        nock('http://localhost:8081')
            .delete('/connections')
            .reply(HttpStatus.OK, Utils.JSON.EMPTY);
        await request(app).delete('/connections');
        await request(app).delete('/sections');
        nock.cleanAll();
    });

    afterAll(() => {
        global.console = OLD_CONSOLE;
        process.env = OLD_ENV;
    });
});
