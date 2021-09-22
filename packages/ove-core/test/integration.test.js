const { DockerComposeEnvironment } = require('testcontainers');
const path = require('path');
const Constants = require('../src/client/utils/constants').Constants;
const request = require('request');
const HttpStatus = require('http-status-codes');

const _defaultError = (resolve, reject, url, error, res, b) => {
    if (error !== null && error !== undefined) {
        reject({ statusCode: res?.statusCode, text: error });
    } else if (res?.statusCode !== HttpStatus.OK) {
        reject({ statusCode: res?.statusCode, text: b });
    } else {
        resolve({ statusCode: res?.statusCode, text: b });
    }
};

const postBacker = async (url, headers, body) => new Promise((resolve, reject) =>
    request.post(url, {
        headers: headers || {},
        json: body
    }, _defaultError.bind(null, resolve, reject, url)));

const delBacker = async (url, headers, body) => new Promise((resolve, reject) =>
    request.delete(url, {
        headers: headers || {},
        json: body || {}
    }, _defaultError.bind(null, resolve, reject, url)));

const getBacker = async (url, headers, body) => new Promise((resolve, reject) =>
    request.get(url, {
        headers: headers || {},
        json: body || {}
    }, _defaultError.bind(null, resolve, reject, url)));

const TestUtils = {
    get: getBacker,
    post: postBacker,
    delete: delBacker
};

describe('Integration Testing for Multiple Server Implementations', () => {
    const JSONHeader = { [Constants.HTTP_CONTENT_TYPE_HEADER]: Constants.HTTP_CONTENT_TYPE_JSON };
    const build = false;
    const log = true;
    let environment;
    let containers;
    let remotes;
    let hosts;
    let ports;
    let urls;
    let body;
    let cloneBody;

    const stream = async () => {
        (await containers.main.logs())
            .on('data', line => console.log(line))
            .on('err', line => console.log(line))
            .on('end', () => console.log('Main Server Logs Closed'));
        (await containers.clone.logs())
            .on('data', line => console.log(line))
            .on('err', line => console.log(line))
            .on('end', () => console.log('Clone Server Logs Closed'));
    };

    beforeAll(async (done) => {
        jest.setTimeout(3000000);
        const dir = path.resolve(__dirname, '../../../');
        const composeFile = 'test-compose.yml';

        environment = build ? await new DockerComposeEnvironment(dir, composeFile).withBuild().up() : await new DockerComposeEnvironment(dir, composeFile).up();
        containers = { main: environment.getContainer('ovehub-ove-test_1'), clone: environment.getContainer('ovehub-ove-test-clone_1') };
        hosts = { main: containers.main.getHost(), clone: containers.clone.getHost() };
        ports = { main: containers.main.getMappedPort(8080), clone: containers.clone.getMappedPort(7080) };
        urls = { main: `${Constants.HTTP_PROTOCOL}${hosts.main}:${ports.main}`, clone: `${Constants.HTTP_PROTOCOL}${hosts.clone}:${ports.clone}` };
        remotes = { main: `ovehub-ove-test:${ports.main}`, clone: `ovehub-ove-test-clone:${ports.clone}` };
        body = { primary: remotes.main, secondary: remotes.clone, protocol: 'http' };
        cloneBody = { primary: remotes.clone, secondary: remotes.main, protocol: 'http' };

        console.log(`main server: ${urls.main}`);
        console.log(`clone server: ${urls.clone}`);

        if (log) { await stream(); }
        done();
    });

    it('should return empty lists of connections if none exist', async (done) => {
        const connections = await TestUtils.get(`${urls.main}/connections`, JSONHeader);
        const cloneConnections = await TestUtils.get(`${urls.clone}/connections`, JSONHeader);
        expect(connections).toEqual({ statusCode: HttpStatus.OK, text: [] });
        expect(cloneConnections).toEqual({ statusCode: HttpStatus.OK, text: [] });
        done();
    });

    it('should be able to successfully create and delete connections between two spaces', async () => {
        const primary = { space: 'DevFour', host: remotes.main, protocol: 'http' };
        const secondary = { space: 'DevFourClone', host: remotes.clone, protocol: 'http' };

        let res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, { primary: remotes.main, secondary: remotes.clone, protocol: 'http' });
        expect(res.statusCode).toBe(HttpStatus.OK);
        expect(JSON.stringify(res.text)).toBe(JSON.stringify({ ids: [] }));

        res = await TestUtils.get(`${urls.main}/connections?space=DevFour`);
        expect(res.statusCode).toBe(HttpStatus.OK);
        expect(JSON.stringify(res.text)).toBe(JSON.stringify([{ primary: primary, secondary: [secondary], sections: {} }]));

        res = await TestUtils.delete(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, { primary: remotes.main, secondary: remotes.clone, protocol: 'http' });
        expect(res.statusCode).toBe(HttpStatus.OK);

        res = await TestUtils.get(`${urls.main}/connections`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: [] });
        res = await TestUtils.get(`${urls.clone}/connections`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: [] });
    });

    it('should return special message if no connections present', async () => {
        let res = await TestUtils.get(`${urls.main}/connections?space=DevFour`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { msg: 'No connections for space: DevFour' } });
        res = await TestUtils.get(`${urls.clone}/connections?space=DevFourClone`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { msg: 'No connections for space: DevFourClone' } });
    });

    it('lists all connections if no space specified', async () => {
        await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        await TestUtils.post(`${urls.main}/connection/LocalFour/LocalNine`, JSONHeader, body);

        let res = await TestUtils.get(`${urls.main}/connections`, JSONHeader);
        expect(res.statusCode).toBe(HttpStatus.OK);
        expect(res.text.length).toBe(2);
    });

    it('returns empty list if no connections', async () => {
        let res = await TestUtils.get(`${urls.main}/connections`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: [] });
        res = await TestUtils.get(`${urls.clone}/connections`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: [] });
    });

    it('fetching section connection details errors if section is not connected', async () => {
        let res;
        await TestUtils.get(`${urls.main}/connections/section/2`).catch(e => { res = e; });
        expect(res).toEqual({ statusCode: HttpStatus.BAD_REQUEST, text: { error: 'Section 2 is not connected' } });
        await TestUtils.get(`${urls.clone}/connections/section/1`).catch(e => { res = e; });
        expect(res).toEqual({ statusCode: HttpStatus.BAD_REQUEST, text: { error: 'Section 1 is not connected' } });
    });

    it('should correctly clone sections when a connection is created', async () => {
        let res = await TestUtils.post(`${urls.main}/section`, JSONHeader, { 'h': 10, 'space': 'DevFour', 'w': 10, 'y': 0, 'x': 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await TestUtils.get(`${urls.main}/connections`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: [] });
        res = await TestUtils.get(`${urls.clone}/connections`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: [] });
        res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [0] } });
        res = await TestUtils.get(`${urls.main}/sections/0`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0, x: 10, y: 0, w: 10, h: 10, space: 'DevFour' } });
        res = await TestUtils.get(`${urls.clone}/sections/0`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0, x: 10, y: 0, w: 10, h: 10, space: 'DevFourClone' } });
    });

    it('should correctly clone sections when creating in a connected space', async () => {
        let res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res.statusCode).toBe(HttpStatus.OK);
        res = await TestUtils.post(`${urls.main}/section`, JSONHeader, { h: 10, space: 'DevFour', w: 10, y: 0, x: 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await TestUtils.get(`${urls.clone}/sections`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: [{ id: 0, x: 10, y: 0, w: 10, h: 10, space: 'DevFourClone' }] });
    });

    it('fetches correct mapping of section connection details for primary sections', async () => {
        let res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await TestUtils.post(`${urls.main}/section`, JSONHeader, { 'h': 10, 'space': 'DevFour', 'w': 10, 'y': 0, 'x': 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await TestUtils.get(`${urls.main}/connections/section/0`);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { section: { primary: 0, secondary: [0] } } });
        res = await TestUtils.get(`${urls.clone}/connections/section/0?space=DevFour`, JSONHeader, { host: remotes.main });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { section: { primary: 0, secondary: [0] } } });
    });

    it('fetches correct mapping of section connection details for secondary sections', async () => {
        let res = await TestUtils.post(`${urls.main}/section`, JSONHeader, { 'h': 10, 'space': 'DevFour', 'w': 10, 'y': 0, 'x': 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [0] } });
        res = await TestUtils.get(`${urls.main}/connections/section/0?space=DevFourClone`, JSONHeader, { host: remotes.clone });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { section: { primary: 0, secondary: [0] } } });
        res = await TestUtils.get(`${urls.clone}/connections/section/0`);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { section: { primary: 0, secondary: [0] } } });
    });

    it('allows multiple replica spaces to be connected', async () => {
        let res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });

        res = await TestUtils.post(`${urls.main}/connection/DevFour/TestingFour`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
    });

    it('can create multiple sections in a connected space', async () => {
        let res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await TestUtils.post(`${urls.main}/section`, JSONHeader, { 'h': 10, 'space': 'DevFour', 'w': 10, 'y': 0, 'x': 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await TestUtils.get(`${urls.main}/connections/section/0`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { section: { primary: 0, secondary: [0] } } });

        res = await TestUtils.post(`${urls.main}/section`, JSONHeader, { 'h': 10, 'space': 'DevFour', 'w': 10, 'y': 0, 'x': 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 1 } });
        res = await TestUtils.get(`${urls.main}/connections/section/1`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { section: { primary: 1, secondary: [1] } } });
    });

    it('deleting connection by secondary space only deletes that connection', async () => {
        let res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await TestUtils.post(`${urls.main}/connection/DevFour/LocalFour`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });

        res = await TestUtils.post(`${urls.main}/section`, JSONHeader, { 'h': 10, 'space': 'DevFour', 'w': 10, 'y': 0, 'x': 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });

        res = await TestUtils.delete(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res.statusCode).toBe(HttpStatus.OK);
        res = await TestUtils.get(`${urls.main}/connections/section/0`);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { section: { primary: 0, secondary: [1] } } });
    });

    it('deleting connection by primary deletes all connections', async () => {
        let res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await TestUtils.post(`${urls.main}/connection/DevFour/LocalFour`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await TestUtils.post(`${urls.main}/section`, JSONHeader, { 'h': 10, 'space': 'DevFour', 'w': 10, 'y': 0, 'x': 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });

        res = await TestUtils.delete(`${urls.main}/connection/DevFour`);
        expect(res.statusCode).toBe(HttpStatus.OK);
        res = await TestUtils.get(`${urls.main}/connections`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: [] });
        res = await TestUtils.get(`${urls.main}/connections`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: [] });
    });

    it('can create connection for a space with a section with an app', async () => {
        let res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await TestUtils.post(`${urls.main}/section`, JSONHeader, { 'h': 10, 'space': 'DevFour', 'w': 10, 'y': 0, 'x': 10, 'app': { 'url': 'http://localhost:8080/app/maps', states: { 'load': 'London' } } });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await TestUtils.get(`${urls.main}/connections/section/0`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { section: { primary: 0, secondary: [0] } } });
    });

    it('deletes all sections in replicas if deleting all in primary', async () => {
        let res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await TestUtils.post(`${urls.main}/connection/DevFour/LocalFour`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });

        res = await TestUtils.post(`${urls.main}/section`, JSONHeader, { 'h': 10, 'space': 'DevFour', 'w': 10, 'y': 0, 'x': 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await TestUtils.post(`${urls.main}/section`, JSONHeader, { 'h': 10, 'space': 'DevFour', 'w': 10, 'y': 0, 'x': 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 1 } });

        res = await TestUtils.delete(`${urls.main}/sections?space=DevFour`);
        expect(res.statusCode).toEqual(HttpStatus.OK);
        res = await TestUtils.get(`${urls.clone}/sections?space=DevFourClone`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: [] });
        res = await TestUtils.get(`${urls.clone}/sections?space=TestingFour`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: [] });
    });

    it('should not be able to delete sections in secondary space', async () => {
        let res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await TestUtils.post(`${urls.main}/section`, JSONHeader, { 'h': 10, 'space': 'DevFour', 'w': 10, 'y': 0, 'x': 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });

        await TestUtils.delete(`${urls.clone}/sections?space=DevFourClone`).catch(e => { res = e; });
        expect(res).toEqual({ statusCode: HttpStatus.BAD_REQUEST, text: { error: 'Operation unavailable as space is connected as a replica. Space: DevFourClone' } });

        res = await TestUtils.get(`${urls.main}/connections`, JSONHeader);
        expect(res.statusCode).toBe(HttpStatus.OK);
        expect(res.text.length).toBe(1);
    });

    it('should update all replicas if updating a primary section', async () => {
        let res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await TestUtils.post(`${urls.main}/section`, JSONHeader, { 'h': 10, 'space': 'DevFour', 'w': 10, 'y': 0, 'x': 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });

        res = await TestUtils.post(`${urls.main}/sections/0`, JSONHeader, { 'h': 10, 'space': 'DevFour', 'w': 20, 'y': 0, 'x': 10 });
        expect(res.statusCode).toBe(HttpStatus.OK);

        res = await TestUtils.get(`${urls.clone}/sections/0`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { h: 10, id: 0, space: 'DevFourClone', w: 20, y: 0, x: 10 } });
    });

    it('should not be able to update a secondary section', async () => {
        let res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await TestUtils.post(`${urls.main}/section`, JSONHeader, { 'h': 10, 'space': 'DevFour', 'w': 10, 'y': 0, 'x': 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        await TestUtils.post(`${urls.clone}/sections/0`, JSONHeader, { 'h': 10, 'space': 'DevFourClone', 'w': 20, 'y': 0, 'x': 20 }).catch(e => { res = e; });
        expect(res).toEqual({ statusCode: HttpStatus.BAD_REQUEST, text: { error: 'Operation unavailable as space is connected as a replica. Space: DevFourClone' } });
        res = await TestUtils.get(`${urls.main}/connections`, JSONHeader);
        expect(res.statusCode).toBe(HttpStatus.OK);
        expect(res.text.length).toBe(1);
    });

    it('should delete all replica sections if deleting a primary section', async () => {
        let res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await TestUtils.post(`${urls.main}/section`, JSONHeader, { 'h': 10, 'space': 'DevFour', 'w': 10, 'y': 0, 'x': 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });

        res = await TestUtils.delete(`${urls.main}/sections/0`);
        expect(res.statusCode).toBe(HttpStatus.OK);
        res = await TestUtils.get(`${urls.clone}/sections?space=DevFourClone`);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: [] });
    });

    it('should not be able to delete a secondary section', async () => {
        let res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await TestUtils.post(`${urls.main}/section`, JSONHeader, { 'h': 10, 'space': 'DevFour', 'w': 10, 'y': 0, 'x': 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        await TestUtils.delete(`${urls.clone}/sections/1`).catch(e => { res = e; });
        expect(res).toEqual({ statusCode: HttpStatus.BAD_REQUEST, text: { error: 'Invalid Section Id: 1' } });

        res = await TestUtils.get(`${urls.main}/connections`, JSONHeader);
        expect(res.statusCode).toBe(HttpStatus.OK);
        expect(res.text.length).toBe(1);
    });

    it('should be able to connect to remote space with same name', async () => {
        let res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFour`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
    });

    it('should error when connecting a primary space as a secondary', async () => {
        let res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        await TestUtils.post(`${urls.main}/connection/LocalFour/DevFour`, JSONHeader).catch(e => { res = e; });
        expect(res).toEqual({ statusCode: HttpStatus.BAD_REQUEST, text: JSON.stringify({ error: 'Could not connect LocalFour and DevFour as there is an existing connection' }) });
    });

    it('can delete all connections', async () => {
        let res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await TestUtils.post(`${urls.main}/connection/TestingFour/TestingFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await TestUtils.delete(`${urls.main}/connections`);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: {} });
    });

    it('can delete all sections when no space is or group is specified', async () => {
        let res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await TestUtils.post(`${urls.main}/section`, JSONHeader, { 'h': 10, 'space': 'DevFour', 'w': 10, 'y': 0, 'x': 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await TestUtils.delete(`${urls.main}/sections`);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: {} });
    });

    it('should error when connecting a secondary space', async () => {
        let res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        await TestUtils.post(`${urls.clone}/connection/DevFourClone/LocalFour`, JSONHeader, cloneBody).catch(e => { res = e; });
        expect(res).toEqual({ statusCode: HttpStatus.BAD_REQUEST, text: { error: 'Could not connect DevFourClone and LocalFour as there is an existing connection' } });
        await TestUtils.post(`${urls.main}/connection/LocalFour/DevFourClone`, JSONHeader, body).catch(e => { res = e; });
        expect(res).toEqual({ statusCode: HttpStatus.BAD_REQUEST, text: { error: 'Could not connect LocalFour and DevFourClone as there is an existing connection' } });
    });

    it('should send events from secondary to primary sections', async () => {
        let res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await TestUtils.post(`${urls.main}/section`, JSONHeader, { 'h': 10, 'space': 'DevFour', 'w': 10, 'y': 0, 'x': 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await TestUtils.post(`${urls.clone}/event/0`, JSONHeader, { appId: 'test', sectionId: '1', message: {} });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [0] } });
    });

    it('should send events from primary to secondary sections', async () => {
        let res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await TestUtils.post(`${urls.main}/connection/DevFour/LocalFour`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await TestUtils.post(`${urls.main}/section`, JSONHeader, { 'h': 10, 'space': 'DevFour', 'w': 10, 'y': 0, 'x': 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await TestUtils.post(`${urls.main}/event/0`, JSONHeader, { appId: 'test', sectionId: '0', message: {} });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [0, 1] } });
    });

    it('should fail to create section in secondary space', async () => {
        let res = await TestUtils.post(`${urls.clone}/connection/DevFour/DevFourClone`, JSONHeader, cloneBody);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        await TestUtils.post(`${urls.main}/section`, JSONHeader, { 'h': 10, 'space': 'DevFourClone', 'w': 10, 'y': 0, 'x': 10 }).catch(e => { res = e; });
        expect(res).toEqual({ statusCode: HttpStatus.BAD_REQUEST, text: { error: 'Operation unavailable as space is connected as a replica. Space: DevFourClone' } });
    });

    it('should refresh replicated sections', async () => {
        let res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await TestUtils.post(`${urls.main}/section`, JSONHeader, { 'h': 10, 'space': 'DevFour', 'w': 10, 'y': 0, 'x': 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await TestUtils.post(`${urls.main}/sections/0/refresh`);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: JSON.stringify({ ids: [0] }) });
    });

    it('should refresh replicated spaces', async () => {
        let res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await TestUtils.post(`${urls.main}/section`, JSONHeader, { 'h': 10, 'space': 'DevFour', 'w': 10, 'y': 0, 'x': 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await TestUtils.post(`${urls.main}/sections/refresh?space=DevFour`);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: JSON.stringify({ ids: [0] }) });
    });

    it('cannot move connected sections', async () => {
        let res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await TestUtils.post(`${urls.main}/section`, JSONHeader, { 'h': 10, 'space': 'DevFour', 'w': 10, 'y': 0, 'x': 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        await TestUtils.post(`${urls.main}/sections/moveTo?space=DevFour`, JSONHeader, { space: 'DevFourClone' }).catch(e => { res = e; });
        expect(res).toEqual({ statusCode: HttpStatus.BAD_REQUEST, text: { error: 'Operation unavailable as space is currently connected' } });
    });

    /* it('should cache across all replicas if caching state of primary section', async () => {
        nock(`http://${urls.clone}`).post(`/instances/0/state`).reply(HttpStatus.OK, JSON.stringify({}));
        let res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await TestUtils.post(`${urls.main}/section`, JSONHeader, { 'h': 10, 'space': 'DevFour', 'w': 10, 'y': 0, 'x': 10, 'app': { 'url': 'http://localhost:8082' } });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await TestUtils.post(`${urls.main}/cache/0`, JSONHeader, {});
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [0] } });
    });

    it('should cache replica state to other replicas and primary section', async () => {
        let res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await TestUtils.post(`${urls.main}/section`, JSONHeader, { 'h': 10, 'space': 'DevFour', 'w': 10, 'y': 0, 'x': 10, 'app': { 'url': 'http://localhost:8082' } });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await TestUtils.post(`${urls.clone}/cache/0`, JSONHeader, {});
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [0] } });
    });

    it('should replicate state when creating replicated sections', async () => {
        nock(`http://${remotes.clone}`).post(`/instances/0/state`).reply(HttpStatus.OK, JSON.stringify({}));
        let res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await TestUtils.post('/section', JSONHeader, { 'h': 10, 'space': 'DevFour', 'w': 10, 'y': 0, 'x': 10, 'app': { 'url': 'http://localhost:8081/test', 'states': { 'load': 'London' } } });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
    }); */

    it('should be able to list multiple connections', async () => {
        const connections = [{ primary: { space: 'DevFour', host: remotes.main, protocol: 'http' },
            secondary: [{ space: 'DevFourClone', host: remotes.clone, protocol: 'http' }, { space: 'LocalFour', host: remotes.clone, protocol: 'http' }],
            sections: { 0: ['0', '1'] } }];
        let res = await TestUtils.post(`${urls.main}/connection/DevFour/DevFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await TestUtils.post(`${urls.main}/connection/DevFour/LocalFour`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await TestUtils.post(`${urls.main}/section`, JSONHeader, { 'h': 10, 'space': 'DevFour', 'w': 10, 'y': 0, 'x': 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await TestUtils.get(`${urls.main}/connections`);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: connections });
        res = await TestUtils.get(`${urls.clone}/connections`);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: connections });
    });

    afterEach(async () => {
        await TestUtils.delete(`${urls.main}/sections`);
        await TestUtils.delete(`${urls.main}/connections`);
        await TestUtils.delete(`${urls.clone}/sections`);
        await TestUtils.delete(`${urls.clone}/connections`);
    });

    afterAll(async (done) => {
        await environment.down();
        done();
    });
});
