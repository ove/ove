const path = global.path;
const fs = global.fs;
const request = global.request;
const HttpStatus = global.HttpStatus;
const app = global.app;
const srcDir = global.srcDir;
const Utils = global.Utils;

// Core functionality tests.
describe('The OVE Core server', () => {
    const OLD_CONSOLE = global.console;
    beforeAll(() => {
        global.console = { log: jest.fn(x => x), warn: jest.fn(x => x), error: jest.fn(x => x) };
    });

    /* jshint ignore:start */
    // current version of JSHint does not support async/await
    it('should return an empty list of spaces by id before a section is created', async () => {
        let res = await request(app).get('/spaces?oveSectionId=0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);
    });

    it('should return an appropriate list of spaces by id after a section has been created', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).not.toEqual(Utils.JSON.EMPTY);

        res = await request(app).get('/spaces?oveSectionId=0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(
            { 'TestingNine': [ { }, { }, { }, { }, { }, { },
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
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'TestingNine', 'y': 0, 'x': 10 })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));
        await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'TestingNine', 'w': 10, 'x': 10 })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));
        await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'TestingNine', 'w': 10, 'y': 0 })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));
        await request(app).post('/section')
            .send({ 'app': { 'url': 'http://localhost:8081' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));
    });

    it('should reject requests for deleting a section when it does not exist', async () => {
        await request(app).delete('/section/0')
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid section id' }));
    });

    it('should reject requests for updating a section when it does not exist', async () => {
        await request(app).post('/section/0').send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid section id' }));
    });

    it('should reject invalid requests when updating sections', async () => {
        await request(app).post('/sections').send({ 'moveTo': { 'space': 'fake' } })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid space' }));
        await request(app).post('/sections').send({ 'transform': { 'scale': { x: 0 } } })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));
        await request(app).post('/sections').send({ 'transform': { 'translate': {} } })
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));
    });

    // This condition is important to avoid many errors getting printed on the browser
    // console as a result of a section not existing.
    it('should not reject requests for reading a section when it does not exist', async () => {
        let res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(Utils.JSON.EMPTY);
    });

    it('should reject invalid requests when creating groups', async () => {
        await request(app).post('/group')
            .send().expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid group' }));
        await request(app).post('/group')
            .send([])
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid group' }));
        await request(app).post('/group')
            .send([0])
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid group' }));
    });

    it('should reject requests for deleting a group when it does not exist', async () => {
        await request(app).delete('/group/0')
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid group id' }));
    });

    it('should reject requests for updating a group when it does not exist', async () => {
        await request(app).post('/group/0').send([0])
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid group' }));
    });

    it('should reject requests for reading a group when it does not exist', async () => {
        await request(app).get('/group/0').send([0])
            .expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid group id' }));
    });

    it('should be supporting offsets', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'TestingNineOffsets', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        res = await request(app).get('/section/0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).not.toEqual(Utils.JSON.EMPTY);

        res = await request(app).get('/spaces?oveSectionId=0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify(
            { 'TestingNineOffsets': [ { }, { }, { }, { }, { }, { },
                { 'x': 0, 'y': 0, 'w': 10, 'h': 10, 'offset': { 'x': 110, 'y': 100 } }, { }, { } ] }));

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
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

    afterAll(() => {
        global.console = OLD_CONSOLE;
    });
});
