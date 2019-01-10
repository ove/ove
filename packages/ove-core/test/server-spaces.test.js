const path = require('path');
const fs = require('fs');
const request = require('supertest');
const express = require('express');
const cors = require('cors');
const HttpStatus = require('http-status-codes');

const app = express();
const wss = require('express-ws')(app).getWss('/');

// We always test against the distribution not the source.
const srcDir = path.join(__dirname, '..', 'src');
const dirs = {
    base: srcDir,
    nodeModules: path.join(srcDir, '..', '..', '..', 'node_modules'),
    constants: path.join(srcDir, 'client', 'utils'),
    rootPage: path.join(srcDir, 'blank.html')
};
const { Constants, Utils } = require('@ove-lib/utils')('core', app, dirs);
const log = Utils.Logger('OVE');

app.use(cors());
app.use(express.json());

const spaces = JSON.parse(fs.readFileSync(path.join(srcDir, '..', 'test', 'resources', Constants.SPACES_JSON_FILENAME)));
const server = require(path.join(srcDir, 'server', 'main'))(app, wss, spaces, log, Utils, Constants);

// Tests for Spaces.json
describe('The OVE Core server with the default Spaces.json file', () => {
    beforeAll(() => {
        // We should test with the actual Spaces.json in this scenario.
        server.spaces = JSON.parse(fs.readFileSync(path.join(srcDir, 'client', Constants.SPACES_JSON_FILENAME)));
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
        // We should test with the actual Spaces.json in this scenario.
        server.spaces = spaces;
    });
});
