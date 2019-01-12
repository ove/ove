const request = global.request;
const HttpStatus = global.HttpStatus;
const app = global.app;
const Utils = global.Utils;

// Core functionality tests.
describe('The OVE Core server', () => {
    /* jshint ignore:start */
    // current version of JSHint does not support async/await
    it('should be able to successfully create and delete sections without an app', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).not.toEqual(Utils.JSON.EMPTY);

        res = await request(app).delete('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [0] }));

        res = await request(app).get('/section/0');
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
        expect(res.text).toEqual(JSON.stringify([ { 'id': 1, 'w': 10, 'h': 10 } ]));

        res = await request(app).get('/sections?groupId=1&geometry=10,0,10,10');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([ { 'id': 1, 'w': 10, 'h': 10 } ]));

        res = await request(app).get('/sections?groupId=1&geometry=0,0,10,10');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY_ARRAY);

        res = await request(app).get('/sections?groupId=2');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([ { 'id': 0, 'w': 10, 'h': 10 }, { 'id': 1, 'w': 10, 'h': 10 } ]));

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

        res = await request(app).delete('/sections?groupId=0');
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

        await request(app).get('/group/1')
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid group id' }));
    });

    it('should be able to successfully read, update and delete sections by space, without an app', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).post('/sections?space=FakeSpace').send({ 'space': 'TestingNine' });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);

        res = await request(app).delete('/sections?space=FakeSpace');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [] }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).not.toEqual(Utils.JSON.EMPTY);

        res = await request(app).get('/sections?space=TestingNine');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([ { 'id': 0, 'w': 10, 'h': 10 } ]));

        res = await request(app).get('/sections?space=TestingNine&geometry=10,0,10,10');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify([ { 'id': 0, 'w': 10, 'h': 10 } ]));

        res = await request(app).get('/sections?space=TestingNine&geometry=0,0,10,10');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY_ARRAY);

        res = await request(app).get('/sections?space=Fake');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY_ARRAY);

        res = await request(app).post('/sections?space=TestingNine').send({ 'space': 'TestingNine' });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [0] }));

        res = await request(app).delete('/sections?space=TestingNine');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [0] }));

        res = await request(app).get('/section/0');
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

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10 }));

        await request(app).post('/sections').send({ 'translate': { x: -11, y: 0 } })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10 }));

        res = await request(app).post('/sections').send({ 'scale': { x: 10, y: 1 } });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [0] }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 100, 'h': 10 }));

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

        res = await request(app).delete('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [0] }));

        res = await request(app).post('/sections?groupId=2').send({ 'space': 'TestingNine' });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);

        res = await request(app).post('/sections').send({ 'space': 'TestingNine' });
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

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).not.toEqual(Utils.JSON.EMPTY);

        res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 1, 'x': 1 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 1 }));

        res = await request(app).get('/section/1');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).not.toEqual(Utils.JSON.EMPTY);

        res = await request(app).post('/section')
            .send({ 'h': 1800, 'space': 'TestingNine', 'w': 1500, 'y': 1, 'x': 1 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 2 }));

        res = await request(app).get('/section/2');
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

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10 }));

        res = await request(app).post('/section/0')
            .send({ 'h': 100, 'space': 'TestingNine', 'w': 100, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 100, 'h': 100 }));

        res = await request(app).post('/section/0')
            .send({ 'h': 200, 'y': 10, 'x': 0 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 100, 'h': 200 }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);
    });

    it('should let you update the space, without an app, but only if the request was valid', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10 }));

        await request(app).post('/section/0')
            .send({ 'h': 10, 'space': 'FakeSpace', 'w': 10, 'y': 0, 'x': 10 })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid space' }));

        await request(app).post('/section/0')
            .send({ 'h': 10, 'space': 'TestingFour', 'w': 10 })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));

        await request(app).post('/section/0')
            .send({ 'h': 10, 'space': 'TestingFour', 'w': 10, 'y': 0 })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));

        res = await request(app).post('/section/0')
            .send({ 'space': 'TestingFour', 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);
    });

    it('should fail when updating section dimensions, if either x or y is not provided', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ 'id': 0, 'w': 10, 'h': 10 }));

        await request(app).post('/section/0')
            .send({ 'h': 100, 'space': 'TestingNine', 'w': 100 })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));

        await request(app).post('/section/0')
            .send({ 'h': 100, 'space': 'TestingNine', 'w': 100, 'y': 0 })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));

        await request(app).post('/section/0')
            .send({ 'x': 10 })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);
    });
    /* jshint ignore:end */
});
