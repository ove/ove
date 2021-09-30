const path = require('path');
const HttpStatus = require('http-status-codes');
const { DockerComposeEnvironment } = require('testcontainers');
const RequestUtils = require(path.resolve(__dirname, '..', 'src', 'server', 'request-utils'));
const Constants = require(path.resolve(__dirname, '..', 'src', 'client', 'utils', 'constants')).Constants;

describe('Integration Testing for Multiple Server Implementations', () => {
    const JSONHeader = { [Constants.HTTP_CONTENT_TYPE_HEADER]: Constants.HTTP_CONTENT_TYPE_JSON };
    const build = false;
    const log = false;
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

    beforeAll(async () => {
        jest.setTimeout(3000000);
        const dir = path.resolve(__dirname, '..', '..', '..');
        const composeFile = 'test-compose.yml';

        environment = build ? await new DockerComposeEnvironment(dir, composeFile).withBuild().up() : await new DockerComposeEnvironment(dir, composeFile).up();
        containers = { main: environment.getContainer('ovehub-ove-test_1'), clone: environment.getContainer('ovehub-ove-test-clone_1') };
        hosts = { main: containers.main.getHost(), clone: containers.clone.getHost() };
        ports = { main: containers.main.getMappedPort(8080), clone: containers.clone.getMappedPort(7080) };
        urls = { main: `${Constants.HTTP_PROTOCOL}${hosts.main}:${ports.main}`, clone: `${Constants.HTTP_PROTOCOL}${hosts.clone}:${ports.clone}` };
        remotes = { main: `ovehub-ove-test:${ports.main}`, clone: `ovehub-ove-test-clone:${ports.clone}` };
        body = { primary: remotes.main, secondary: remotes.clone, protocol: 'http' };
        cloneBody = { primary: remotes.clone, secondary: remotes.main, protocol: 'http' };

        if (log) { await stream(); }
    });

    it('should return empty lists of connections if none exist', async () => {
        const connections = await RequestUtils.get(`${urls.main}/connections`, JSONHeader);
        const cloneConnections = await RequestUtils.get(`${urls.clone}/connections`, JSONHeader);
        expect(connections).toEqual({ statusCode: HttpStatus.OK, text: [] });
        expect(cloneConnections).toEqual({ statusCode: HttpStatus.OK, text: [] });
    });

    it('should be able to successfully create and delete connections between two spaces', async () => {
        const primary = { space: 'LocalFour', host: remotes.main, protocol: 'http' };
        const secondary = { space: 'LocalFourClone', host: remotes.clone, protocol: 'http' };

        let res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, { primary: remotes.main, secondary: remotes.clone, protocol: 'http' });
        expect(res.statusCode).toBe(HttpStatus.OK);
        expect(JSON.stringify(res.text)).toBe(JSON.stringify({ ids: [] }));

        res = await RequestUtils.get(`${urls.main}/connections`, JSONHeader, primary);
        expect(res.statusCode).toBe(HttpStatus.OK);
        expect(JSON.stringify(res.text)).toBe(JSON.stringify([{ primary: primary, secondary: [secondary], sections: {} }]));

        res = await RequestUtils.delete(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, { primary: remotes.main, secondary: remotes.clone, protocol: 'http' });
        expect(res.statusCode).toBe(HttpStatus.OK);

        res = await RequestUtils.get(`${urls.main}/connections`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: [] });
        res = await RequestUtils.get(`${urls.clone}/connections`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: [] });
    });

    it('should return special message if no connections present', async () => {
        let res = await RequestUtils.get(`${urls.main}/connections`);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: [] });
        res = await RequestUtils.get(`${urls.clone}/connections`);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: [] });
    });

    it('lists all connections if no space specified', async () => {
        let res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await RequestUtils.post(`${urls.main}/connection/LocalNine/LocalNineClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });

        res = await RequestUtils.get(`${urls.main}/connections`, JSONHeader);
        expect(res.statusCode).toBe(HttpStatus.OK);
        expect(res.text.length).toBe(2);
    });

    it('returns empty list if no connections', async () => {
        let res = await RequestUtils.get(`${urls.main}/connections`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: [] });
        res = await RequestUtils.get(`${urls.clone}/connections`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: [] });
    });

    it('fetching section connection details errors if section is not connected', async () => {
        let res;
        await RequestUtils.get(`${urls.main}/connections/sections/2`).catch(e => { res = e; });
        expect(res).toEqual({ statusCode: HttpStatus.BAD_REQUEST, text: { error: 'Section 2 is not connected' } });
        await RequestUtils.get(`${urls.clone}/connections/sections/1`).catch(e => { res = e; });
        expect(res).toEqual({ statusCode: HttpStatus.BAD_REQUEST, text: { error: 'Section 1 is not connected' } });
    });

    it('should correctly clone sections when a connection is created', async () => {
        let res = await RequestUtils.post(`${urls.main}/section`, JSONHeader, { h: 10, space: 'LocalFour', w: 10, y: 0, x: 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await RequestUtils.get(`${urls.main}/connections`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: [] });
        res = await RequestUtils.get(`${urls.clone}/connections`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: [] });
        res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [0] } });
        res = await RequestUtils.get(`${urls.main}/sections/0`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0, x: 10, y: 0, w: 10, h: 10, space: 'LocalFour' } });
        res = await RequestUtils.get(`${urls.clone}/sections/0`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0, x: 10, y: 0, w: 10, h: 10, space: 'LocalFourClone' } });
    });

    it('should correctly clone sections when creating in a connected space', async () => {
        let res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res.statusCode).toBe(HttpStatus.OK);
        res = await RequestUtils.post(`${urls.main}/section`, JSONHeader, { h: 10, space: 'LocalFour', w: 10, y: 0, x: 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await RequestUtils.get(`${urls.clone}/sections`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: [{ id: 0, x: 10, y: 0, w: 10, h: 10, space: 'LocalFourClone' }] });
    });

    it('fetches correct mapping of section connection details for primary sections', async () => {
        let res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await RequestUtils.post(`${urls.main}/section`, JSONHeader, { h: 10, space: 'LocalFour', w: 10, y: 0, x: 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await RequestUtils.get(`${urls.main}/connections/sections/0`);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { section: { primary: 0, secondary: [0] } } });
        res = await RequestUtils.get(`${urls.clone}/connections/sections/0?space=LocalFour`, JSONHeader, { host: remotes.main });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { section: { primary: 0, secondary: [0] } } });
    });

    it('fetches correct mapping of section connection details for secondary sections', async () => {
        let res = await RequestUtils.post(`${urls.main}/section`, JSONHeader, { h: 10, space: 'LocalFour', w: 10, y: 0, x: 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [0] } });
        res = await RequestUtils.get(`${urls.main}/connections/sections/0?space=LocalFourClone`, JSONHeader, { host: remotes.clone });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { section: { primary: 0, secondary: [0] } } });
        res = await RequestUtils.get(`${urls.clone}/connections/sections/0`);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { section: { primary: 0, secondary: [0] } } });
    });

    it('allows multiple replica spaces to be connected', async () => {
        let res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });

        res = await RequestUtils.post(`${urls.main}/connection/LocalFour/TestingFour`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
    });

    it('can create multiple sections in a connected space', async () => {
        let res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await RequestUtils.post(`${urls.main}/section`, JSONHeader, { h: 10, space: 'LocalFour', w: 10, y: 0, x: 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await RequestUtils.get(`${urls.main}/connections/sections/0`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { section: { primary: 0, secondary: [0] } } });

        res = await RequestUtils.post(`${urls.main}/section`, JSONHeader, { h: 10, space: 'LocalFour', w: 10, y: 0, x: 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 1 } });
        res = await RequestUtils.get(`${urls.main}/connections/sections/1`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { section: { primary: 1, secondary: [1] } } });
    });

    it('deleting connection by secondary space only deletes that connection', async () => {
        let res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFour`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });

        res = await RequestUtils.post(`${urls.main}/section`, JSONHeader, { h: 10, space: 'LocalFour', w: 10, y: 0, x: 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });

        res = await RequestUtils.delete(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res.statusCode).toBe(HttpStatus.OK);
        res = await RequestUtils.get(`${urls.main}/connections/sections/0`);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { section: { primary: 0, secondary: [1] } } });
    });

    it('deleting connection by primary deletes all connections', async () => {
        let res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFour`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await RequestUtils.post(`${urls.main}/section`, JSONHeader, { h: 10, space: 'LocalFour', w: 10, y: 0, x: 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });

        res = await RequestUtils.delete(`${urls.main}/connection/LocalFour`);
        expect(res.statusCode).toBe(HttpStatus.OK);
        res = await RequestUtils.get(`${urls.main}/connections`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: [] });
        res = await RequestUtils.get(`${urls.main}/connections`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: [] });
    });

    it('can create connection for a space with a section with an app', async () => {
        let res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await RequestUtils.post(`${urls.main}/section`, JSONHeader, { h: 10, space: 'LocalFour', w: 10, y: 0, x: 10, app: { url: 'http://localhost:8080/app/maps', states: { load: 'London' } } });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await RequestUtils.get(`${urls.main}/connections/sections/0`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { section: { primary: 0, secondary: [0] } } });
    });

    it('deletes all sections in replicas if deleting all in primary', async () => {
        let res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFour`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });

        res = await RequestUtils.post(`${urls.main}/section`, JSONHeader, { h: 10, space: 'LocalFour', w: 10, y: 0, x: 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await RequestUtils.post(`${urls.main}/section`, JSONHeader, { h: 10, space: 'LocalFour', w: 10, y: 0, x: 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 1 } });

        res = await RequestUtils.delete(`${urls.main}/sections?space=LocalFour`);
        expect(res.statusCode).toEqual(HttpStatus.OK);
        res = await RequestUtils.get(`${urls.clone}/sections?space=LocalFourClone`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: [] });
        res = await RequestUtils.get(`${urls.clone}/sections?space=TestingFour`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: [] });
    });

    it('should not be able to delete sections in secondary space', async () => {
        let res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await RequestUtils.post(`${urls.main}/section`, JSONHeader, { h: 10, space: 'LocalFour', w: 10, y: 0, x: 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });

        await RequestUtils.delete(`${urls.clone}/sections?space=LocalFourClone`).catch(e => { res = e; });
        expect(res).toEqual({ statusCode: HttpStatus.BAD_REQUEST, text: { error: 'Operation unavailable as space is connected as a replica. Space: LocalFourClone' } });

        res = await RequestUtils.get(`${urls.main}/connections`, JSONHeader);
        expect(res.statusCode).toBe(HttpStatus.OK);
        expect(res.text.length).toBe(1);
    });

    it('should update all replicas if updating a primary section', async () => {
        let res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await RequestUtils.post(`${urls.main}/section`, JSONHeader, { h: 10, space: 'LocalFour', w: 10, y: 0, x: 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });

        res = await RequestUtils.post(`${urls.main}/sections/0`, JSONHeader, { h: 10, space: 'LocalFour', w: 20, y: 0, x: 10 });
        expect(res.statusCode).toBe(HttpStatus.OK);

        res = await RequestUtils.get(`${urls.clone}/sections/0`, JSONHeader);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { h: 10, id: 0, space: 'LocalFourClone', w: 20, y: 0, x: 10 } });
    });

    it('should not be able to update a secondary section', async () => {
        let res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await RequestUtils.post(`${urls.main}/section`, JSONHeader, { h: 10, space: 'LocalFour', w: 10, y: 0, x: 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        await RequestUtils.post(`${urls.clone}/sections/0`, JSONHeader, { h: 10, space: 'LocalFourClone', w: 20, y: 0, x: 20 }).catch(e => { res = e; });
        expect(res).toEqual({ statusCode: HttpStatus.BAD_REQUEST, text: { error: 'Operation unavailable as space is connected as a replica' } });
        res = await RequestUtils.get(`${urls.main}/connections`, JSONHeader);
        expect(res.statusCode).toBe(HttpStatus.OK);
        expect(res.text.length).toBe(1);
    });

    it('should delete all replica sections if deleting a primary section', async () => {
        let res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await RequestUtils.post(`${urls.main}/section`, JSONHeader, { h: 10, space: 'LocalFour', w: 10, y: 0, x: 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });

        res = await RequestUtils.delete(`${urls.main}/sections/0`);
        expect(res.statusCode).toBe(HttpStatus.OK);
        res = await RequestUtils.get(`${urls.clone}/sections?space=LocalFourClone`);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: [] });
    });

    it('should not be able to delete a secondary section', async () => {
        let res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await RequestUtils.post(`${urls.main}/section`, JSONHeader, { h: 10, space: 'LocalFour', w: 10, y: 0, x: 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        await RequestUtils.delete(`${urls.clone}/sections/1`).catch(e => { res = e; });
        expect(res).toEqual({ statusCode: HttpStatus.BAD_REQUEST, text: { error: 'Invalid Section Id' } });

        res = await RequestUtils.get(`${urls.main}/connections`, JSONHeader);
        expect(res.statusCode).toBe(HttpStatus.OK);
        expect(res.text.length).toBe(1);
    });

    it('should be able to connect to remote space with same name', async () => {
        const res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFour`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
    });

    it('should error when connecting a primary space as a secondary', async () => {
        let res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        await RequestUtils.post(`${urls.main}/connection/LocalNine/LocalFour`, JSONHeader).catch(e => { res = e; });
        expect(res).toEqual({ statusCode: HttpStatus.BAD_REQUEST, text: JSON.stringify({ error: 'Could not connect LocalNine and LocalFour as there is an existing connection' }) });
    });

    it('can delete all connections', async () => {
        let res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await RequestUtils.post(`${urls.main}/connection/TestingFour/TestingFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await RequestUtils.delete(`${urls.main}/connections`);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: {} });
    });

    it('can delete all sections when no space is or group is specified', async () => {
        let res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await RequestUtils.post(`${urls.main}/section`, JSONHeader, { h: 10, space: 'LocalFour', w: 10, y: 0, x: 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await RequestUtils.delete(`${urls.main}/sections`);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: {} });
    });

    it('should error when connecting a secondary space', async () => {
        let res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        await RequestUtils.post(`${urls.clone}/connection/LocalFourClone/LocalFour`, JSONHeader, cloneBody).catch(e => { res = e; });
        expect(res).toEqual({ statusCode: HttpStatus.BAD_REQUEST, text: { error: 'Could not connect LocalFourClone and LocalFour as there is an existing connection' } });
        await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body).catch(e => { res = e; });
        expect(res).toEqual({ statusCode: HttpStatus.BAD_REQUEST, text: { error: 'Could not connect LocalFour and LocalFourClone as there is an existing connection' } });
    });

    it('should send events from secondary to primary sections', async () => {
        let res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await RequestUtils.post(`${urls.main}/section`, JSONHeader, { h: 10, space: 'LocalFour', w: 10, y: 0, x: 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await RequestUtils.post(`${urls.clone}/connections/sections/event/0`, JSONHeader, { appId: 'test', sectionId: '1', message: {} });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [0] } });
    });

    it('should send events from primary to secondary sections', async () => {
        let res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFour`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await RequestUtils.post(`${urls.main}/section`, JSONHeader, { h: 10, space: 'LocalFour', w: 10, y: 0, x: 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await RequestUtils.post(`${urls.main}/connections/sections/event/0`, JSONHeader, { appId: 'test', sectionId: '0', message: {} });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [0, 1] } });
    });

    it('should fail to create section in secondary space', async () => {
        let res = await RequestUtils.post(`${urls.clone}/connection/LocalFour/LocalFourClone`, JSONHeader, cloneBody);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        await RequestUtils.post(`${urls.main}/section`, JSONHeader, { h: 10, space: 'LocalFourClone', w: 10, y: 0, x: 10 }).catch(e => { res = e; });
        expect(res).toEqual({ statusCode: HttpStatus.BAD_REQUEST, text: { error: 'Operation unavailable as space is connected as a replica. Space: LocalFourClone' } });
    });

    it('should refresh replicated sections', async () => {
        let res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await RequestUtils.post(`${urls.main}/section`, JSONHeader, { h: 10, space: 'LocalFour', w: 10, y: 0, x: 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await RequestUtils.post(`${urls.main}/sections/0/refresh`);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: JSON.stringify({ ids: [0] }) });
    });

    it('should refresh replicated spaces', async () => {
        let res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await RequestUtils.post(`${urls.main}/section`, JSONHeader, { h: 10, space: 'LocalFour', w: 10, y: 0, x: 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await RequestUtils.post(`${urls.main}/sections/refresh?space=LocalFour`);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: JSON.stringify({ ids: [0] }) });
    });

    it('cannot move connected sections', async () => {
        let res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await RequestUtils.post(`${urls.main}/section`, JSONHeader, { h: 10, space: 'LocalFour', w: 10, y: 0, x: 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        await RequestUtils.post(`${urls.main}/sections/moveTo?space=LocalFour`, JSONHeader, { space: 'LocalFourClone' }).catch(e => { res = e; });
        expect(res).toEqual({ statusCode: HttpStatus.BAD_REQUEST, text: { error: 'Operation unavailable as space is currently connected' } });
    });

    it('should cache across all replicas if caching state of primary section', async () => {
        let res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await RequestUtils.post(`${urls.main}/section`, JSONHeader, { h: 10, space: 'LocalFour', w: 10, y: 0, x: 10, app: { url: 'http://localhost:8082' } });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await RequestUtils.post(`${urls.main}/connections/sections/cache/0`, JSONHeader, {});
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [0] } });
    });

    it('should cache replica state to other replicas and primary section', async () => {
        let res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await RequestUtils.post(`${urls.main}/section`, JSONHeader, { h: 10, space: 'LocalFour', w: 10, y: 0, x: 10, app: { url: 'http://localhost:8082' } });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await RequestUtils.post(`${urls.clone}/connections/sections/cache/0`, JSONHeader, {});
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [0] } });
    });

    it('should replicate state when creating replicated sections', async () => {
        let res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await RequestUtils.post(`${urls.main}/section`, JSONHeader, { h: 10, space: 'LocalFour', w: 10, y: 0, x: 10, app: { url: 'http://localhost:8081/test', states: { load: 'London' } } });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
    });

    it('should be able to list multiple connections', async () => {
        const connections = [{
            primary: { space: 'LocalFour', host: remotes.main, protocol: 'http' },
            secondary: [{ space: 'LocalFourClone', host: remotes.clone, protocol: 'http' }, { space: 'LocalFour', host: remotes.clone, protocol: 'http' }],
            sections: { 0: ['0', '1'] }
        }];
        let res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFourClone`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await RequestUtils.post(`${urls.main}/connection/LocalFour/LocalFour`, JSONHeader, body);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { ids: [] } });
        res = await RequestUtils.post(`${urls.main}/section`, JSONHeader, { h: 10, space: 'LocalFour', w: 10, y: 0, x: 10 });
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: { id: 0 } });
        res = await RequestUtils.get(`${urls.main}/connections`);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: connections });
        res = await RequestUtils.get(`${urls.clone}/connections`);
        expect(res).toEqual({ statusCode: HttpStatus.OK, text: connections });
    });

    afterEach(async () => {
        await RequestUtils.delete(`${urls.main}/sections`);
        await RequestUtils.delete(`${urls.main}/connections`);
        await RequestUtils.delete(`${urls.clone}/sections`);
        await RequestUtils.delete(`${urls.clone}/connections`);
    });

    afterAll(async () => {
        await environment.down();
    });
});
