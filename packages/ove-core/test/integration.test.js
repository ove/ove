const { DockerComposeEnvironment } = require('testcontainers');
const path = require('path');
const Constants = require('../src/client/utils/constants').Constants;
const RequestUtils = require('../src/server/request-utils');

describe('Integration Testing for Multiple Server Implementations', () => {
    const JSONHeader = { [Constants.HTTP_CONTENT_TYPE_HEADER]: Constants.HTTP_CONTENT_TYPE_JSON };
    const log = false;
    const serviceVersion = 'latest';
    let environment;
    let containers;
    let hosts;
    let ports;
    let urls;

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
        jest.setTimeout(300000);
        const dir = path.resolve(__dirname, '../../../../');
        const composeFile = 'test-compose.yml';

        environment = await new DockerComposeEnvironment(dir, composeFile).withEnv('SERVICE_VERSION', serviceVersion).up();
        containers = { main: environment.getContainer('ovehub-ove-test_1'), clone: environment.getContainer('ovehub-ove-test-clone_1') };
        hosts = { main: containers.main.getHost(), clone: containers.clone.getHost() };
        ports = { main: containers.main.getMappedPort(8080), clone: containers.clone.getMappedPort(8080) };
        urls = { main: `${hosts.main}:${ports.main}`, clone: `${hosts.clone}:${ports.clone}` };

        console.log(`main server: ${urls.main}`);
        console.log(`clone server: ${urls.clone}`);

        if (log) { await stream(); }
        done();
    });

    it('should return empty lists of connections if none exist', async (done) => {
        const connections = await RequestUtils.get(`${Constants.HTTP_PROTOCOL}${urls.main}/connections`, JSONHeader);
        const cloneConnections = await RequestUtils.get(`${Constants.HTTP_PROTOCOL}${urls.clone}/connections`, JSONHeader);
        expect(connections).toEqual([]);
        expect(cloneConnections).toEqual([]);
        done();
    });

    afterAll(async (done) => {
        await environment.down();
        done();
    });
});
