const path = global.path;
const fs = global.fs;
const request = global.request;
const HttpStatus = global.HttpStatus;
const app = global.app;
const srcDir = global.srcDir;
const Constants = global.Constants;
const spaces = global.spaces;
const server = global.server;

describe('The OVE Core server', () => {
    beforeAll(() => {
        // We should test with the actual Spaces.json in this scenario.
        server.spaces = JSON.parse(fs.readFileSync(path.join(srcDir, 'client', Constants.SPACES_JSON_FILENAME)));
        server.spaceGeometries = {};
    });

    /* jshint ignore:start */
    // current version of JSHint does not support async/await
    it('should return a list of spaces', async () => {
        let res = await request(app).get('/spaces');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        // It is important to compare the JSON on both side since the ordering of
        // elements changes depending on how it was stringified.
        expect(JSON.parse(res.text)).toEqual(JSON.parse(fs.readFileSync(
            path.join(srcDir, 'client', Constants.SPACES_JSON_FILENAME))));
        // It is also useful to validate the approach taken to produce the text
        // as below.
        expect(res.text).toEqual(JSON.stringify(JSON.parse(fs.readFileSync(
            path.join(srcDir, 'client', Constants.SPACES_JSON_FILENAME)))));
    });

    it('should return space geometries', async () => {
        let res = await request(app).get('/spaces/LocalNine/geometry');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        // The width and height are hard-coded for the LocalNine space and will have
        // to be updated accordingly if the dimensions of the space has changed.
        expect(res.text).toEqual(JSON.stringify({ w: 4320, h: 2424 }));
    });

    it('should return an error if the space name was invalid', async () => {
        let res = await request(app).get('/spaces/Fake/geometry');
        expect(res.statusCode).toEqual(HttpStatus.BAD_REQUEST);
        expect(res.text).toEqual(JSON.stringify({ error: 'invalid space' }));
    });
    /* jshint ignore:end */

    afterAll(() => {
        // Restore spaces after the tests have completed.
        server.spaces = spaces;
        server.spaceGeometries = {};
    });
});
