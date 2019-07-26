const path = global.path;
const request = global.request;
const HttpStatus = global.HttpStatus;
const nock = global.nock;
const app = global.app;
const wss = global.wss;
const srcDir = global.srcDir;
const Constants = global.Constants;
const Utils = global.Utils;
const log = global.log;
const server = global.server;

// Do not expose console during init.
const OLD_CONSOLE = global.console;
global.console = { log: jest.fn(x => x), warn: jest.fn(x => x), error: jest.fn(x => x) };

const { WebSocket, Server } = require('mock-socket');
const middleware = require(path.join(srcDir, 'server', 'messaging'))(server, log, Utils, Constants);
const PORT = 5555;
const PEER_PORT = 5545;
const TIMEOUT = 500;

// Restore console before run.
global.console = OLD_CONSOLE;

// WebSocket testing is done using a Mock Socket. The tests run a WSS and inject the mocked
// WS into the express app.
describe('The OVE Core server', () => {
    let sockets = {};
    WebSocket.prototype.send = (m) => {
        sockets.messages.push(m);
    };

    const OLD_CONSOLE = global.console;
    beforeAll(() => {
        global.console = { log: jest.fn(x => x), warn: jest.fn(x => x), error: jest.fn(x => x) };
        const url = 'ws://localhost:' + PORT;
        const peerUrl = 'ws://localhost:' + PEER_PORT;
        sockets.server = new Server(url);
        sockets.peerServer = new Server(peerUrl);
        let socket = new WebSocket(url);
        socket.readyState = 1;
        wss.clients.add(socket);

        // There should also be a socket which is not ready to receive messages, and sockets
        // that fail to send messages which will ensure all code branches are tested.
        sockets.closed = new WebSocket(url);
        wss.clients.add(sockets.closed);

        sockets.failing = new WebSocket(url);
        sockets.failing.readyState = 1;
        sockets.failing.send = () => {
            throw new Error('some error');
        };
        wss.clients.add(sockets.failing);

        // We need at least one peer socket;
        sockets.peerSocket = new WebSocket(peerUrl);
        sockets.peerSocket.readyState = 1;
        sockets.peerSocketNotReady = new WebSocket(peerUrl);
        sockets.peerSocketNotReady.readyState = 0;

        // Add a server-side socket to test the messaging functionality.
        // It is important to create at least one client-side socket before creating a
        // server-side sockets, since the 'wss.clients.add' method extends the WebSocket
        // prototype by introducing a safeSend method to it.
        sockets.serverSocket = new WebSocket(url);
        sockets.serverSocket.readyState = 1;
        sockets.serverSocket.on = (event, listener) => {
            if (event === 'message') {
                sockets.serverSocket.onmessage = (event) => {
                    listener(event.data);
                };
            }
        };
        middleware(sockets.serverSocket);
    });

    beforeEach(() => {
        sockets.messages = [];
        sockets.serverSocket.readyState = 1;
        sockets.closed.readyState = 0;
    });

    jest.useFakeTimers();

    it('should be able to receive events', () => {
        sockets.server.emit('message', JSON.stringify({ appId: 'foo', message: { action: Constants.Action.READ } }));
        expect(sockets.messages.length).toEqual(1);
        expect(sockets.messages.pop()).toEqual(JSON.stringify({ appId: 'foo', message: { action: Constants.Action.READ } }));
    });

    it('should forward events to peers if they exist', () => {
        server.peers['ws://localhost:' + PEER_PORT] = sockets.peerSocket;
        sockets.server.emit('message', JSON.stringify({ appId: 'foo', message: { action: Constants.Action.READ } }));
        expect(sockets.messages.length).toEqual(2);
        expect(sockets.messages.pop()).toEqual(JSON.stringify({ appId: 'foo', message: { action: Constants.Action.READ }, forwardedBy: [server.uuid] }));
        expect(sockets.messages.pop()).toEqual(JSON.stringify({ appId: 'foo', message: { action: Constants.Action.READ } }));
        server.peers = {};
    });

    it('should forward events to peers if they arrived from another peer', () => {
        server.peers['ws://localhost:' + PEER_PORT] = sockets.peerSocket;
        sockets.server.emit('message', JSON.stringify({ appId: 'foo', message: { action: Constants.Action.READ }, forwardedBy: ['some_uuid'] }));
        expect(sockets.messages.length).toEqual(2);
        expect(sockets.messages.pop()).toEqual(JSON.stringify({ appId: 'foo', message: { action: Constants.Action.READ }, forwardedBy: ['some_uuid', server.uuid] }));
        expect(sockets.messages.pop()).toEqual(JSON.stringify({ appId: 'foo', message: { action: Constants.Action.READ }, forwardedBy: ['some_uuid'] }));
        server.peers = {};
    });

    it('should drop events if they originated from self', () => {
        server.peers['ws://localhost:' + PEER_PORT] = sockets.peerSocket;
        sockets.server.emit('message', JSON.stringify({ appId: 'foo', message: { action: Constants.Action.READ }, forwardedBy: [server.uuid] }));
        expect(sockets.messages.length).toEqual(0);
        server.peers = {};
    });

    it('should not forward events to peers if they are not ready', () => {
        server.peers['ws://localhost:' + PEER_PORT] = sockets.peerSocketNotReady;
        sockets.server.emit('message', JSON.stringify({ appId: 'foo', message: { action: Constants.Action.READ } }));
        expect(sockets.messages.length).toEqual(1); // We are expecting one event instead of two.
        expect(sockets.messages.pop()).toEqual(JSON.stringify({ appId: 'foo', message: { action: Constants.Action.READ } }));
        server.peers = {};
    });

    // This scenario would happen only if section information would be requested by an app within a section.
    // OVE prevents this scenario as it is both a security breach and a consistency violation.
    it('should be complaining when a read event from the core application is sent with a section id', () => {
        const spy = jest.spyOn(log, 'error');
        sockets.server.emit('message', JSON.stringify({ appId: 'core', message: { action: Constants.Action.READ }, sectionId: 0 }));
        expect(sockets.messages.length).toEqual(0);
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('should not be logging all received events', () => {
        const spy = jest.spyOn(log, 'trace');
        sockets.server.emit('message', JSON.stringify({ appId: 'foo', message: { action: Constants.Action.READ } }));
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    /* jshint ignore:start */
    // current version of JSHint does not support async/await
    it('should be able to update peers', async () => {
        expect(Object.keys(server.peers).length).toEqual(0);
        await request(app).post('/peers').send({})
            .expect(HttpStatus.BAD_REQUEST, Utils.JSON.EMPTY);
        expect(Object.keys(server.peers).length).toEqual(0);
        await request(app).post('/peers').send([{ url: 'http://localhost:' + PEER_PORT }])
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
        expect(Object.keys(server.peers).length).toEqual(1);
        expect(Object.keys(server.peers)[0]).toEqual('localhost:' + PEER_PORT);
        await request(app).post('/peers').send([{ url: 'http://localhost:' + PEER_PORT }, { url: 'somehost:' + PEER_PORT }, {}])
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
        expect(Object.keys(server.peers).length).toEqual(2);
        expect(Object.keys(server.peers)[0]).toEqual('localhost:' + PEER_PORT);
        expect(Object.keys(server.peers)[1]).toEqual('somehost:' + PEER_PORT);
        await request(app).post('/peers').send([{ url: 'somehost:' + PEER_PORT + '/' }])
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
        expect(Object.keys(server.peers).length).toEqual(1);
        expect(Object.keys(server.peers)[0]).toEqual('somehost:' + PEER_PORT);
        await request(app).post('/peers').send([])
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
        expect(Object.keys(server.peers).length).toEqual(0);
        server.peers = {};
    });

    it('should trigger an event to its sockets when a section is deleted', async () => {
        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
        expect(sockets.messages.length).toEqual(1);
        expect(sockets.messages.pop()).toEqual(JSON.stringify({ appId: 'core', message: { action: Constants.Action.DELETE } }));
    });

    it('should trigger an event to its sockets when all sections are refreshed', async () => {
        await request(app).post('/sections/refresh').expect(HttpStatus.OK, Utils.JSON.EMPTY);
        expect(sockets.messages.length).toEqual(1);
        expect(sockets.messages.pop()).toEqual(JSON.stringify({ operation: Constants.Operation.REFRESH }));
    });

    it('should trigger an event to its sockets when sections are refreshed by group', async () => {
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

        res = await request(app).post('/group').send([0, 1]);
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 1 }));

        sockets.messages = [];

        await request(app).post('/sections/refresh?groupId=0').expect(HttpStatus.OK, { ids: [0] });
        expect(sockets.messages.length).toEqual(1);
        expect(sockets.messages.pop()).toEqual(JSON.stringify({ operation: Constants.Operation.REFRESH, sectionId: 0 }));

        await request(app).post('/sections/refresh?groupId=1').expect(HttpStatus.OK, { ids: [0, 1] });
        expect(sockets.messages.length).toEqual(2);
        expect(sockets.messages.pop()).toEqual(JSON.stringify({ operation: Constants.Operation.REFRESH, sectionId: 1 }));
        expect(sockets.messages.pop()).toEqual(JSON.stringify({ operation: Constants.Operation.REFRESH, sectionId: 0 }));

        await request(app).post('/sections/refresh?groupId=2').expect(HttpStatus.OK, { ids: [] });
        expect(sockets.messages.length).toEqual(0);

        res = await request(app).delete('/sections?groupId=0');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [0] }));

        sockets.messages = [];

        await request(app).post('/sections/refresh?groupId=0').expect(HttpStatus.OK, { ids: [] });
        expect(sockets.messages.length).toEqual(0);

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    it('should trigger an event to its sockets when sections are refreshed by space', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        sockets.messages = [];

        await request(app).post('/sections/refresh?space=TestingNine').expect(HttpStatus.OK, { ids: [0] });
        expect(sockets.messages.length).toEqual(1);
        expect(sockets.messages.pop()).toEqual(JSON.stringify({ operation: Constants.Operation.REFRESH, sectionId: 0 }));

        await request(app).post('/sections/refresh?space=Fake').expect(HttpStatus.OK, { ids: [] });
        expect(sockets.messages.length).toEqual(0);

        res = await request(app).delete('/sections?space=TestingNine');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [0] }));

        sockets.messages = [];

        await request(app).post('/sections/refresh?space=TestingNine').expect(HttpStatus.OK, { ids: [] });
        expect(sockets.messages.length).toEqual(0);

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    it('should trigger an event to its sockets when a section is refreshed', async () => {
        let res = await request(app).post('/section')
            .send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 });
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ id: 0 }));

        sockets.messages = [];

        await request(app).post('/sections/0/refresh').expect(HttpStatus.OK, { ids: [0] });
        expect(sockets.messages.length).toEqual(1);
        expect(sockets.messages.pop()).toEqual(JSON.stringify({ operation: Constants.Operation.REFRESH, sectionId: 0 }));

        await request(app).post('/sections/1/refresh').expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid section id' }));
        expect(sockets.messages.length).toEqual(0);

        res = await request(app).delete('/sections?space=TestingNine');
        expect(res.statusCode).toEqual(HttpStatus.OK);
        expect(res.text).toEqual(JSON.stringify({ ids: [0] }));

        sockets.messages = [];

        await request(app).post('/sections/0/refresh').expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid section id' }));
        expect(sockets.messages.length).toEqual(0);

        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
    });

    /* jshint ignore:start */
    // current version of JSHint does not support async/await
    it('should be logging errors when sockets are failing, but only if the failure was not related to their readyState', async () => {
        let spy = jest.spyOn(global.console, 'error');
        await request(app).delete('/sections')
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);
        expect(sockets.messages.length).toEqual(1);
        expect(sockets.messages.pop()).toEqual(JSON.stringify({ appId: 'core', message: { action: Constants.Action.DELETE } }));
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
        spy = jest.spyOn(global.console, 'error');
        sockets.failing.send = () => {
            sockets.failing.readyState = 0;
            throw new Error('some error');
        };
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('should trigger an event to its sockets when a section is created and deleted', async () => {
        await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 })
            .expect(HttpStatus.OK, JSON.stringify({ id: 0 }));
        let spaces = { 'TestingNine': [ { }, { }, { }, { }, { }, { },
            { 'x': 0, 'y': 0, 'w': 10, 'h': 10, 'offset': { 'x': 10, 'y': 0 } }, { }, { } ] };
        expect(sockets.messages.pop()).toEqual(JSON.stringify(
            { appId: 'core', message: { action: Constants.Action.CREATE, id: 0, spaces: spaces } }
        ));
        nock('http://localhost:8081').post('/instances/0/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        await request(app).delete('/sections/0').expect(HttpStatus.OK, JSON.stringify({ ids: [0] }));
        expect(sockets.messages.pop()).toEqual(JSON.stringify(
            { appId: 'core', message: { action: Constants.Action.DELETE, id: 0 } }
        ));
        await request(app).delete('/sections').expect(HttpStatus.OK, Utils.JSON.EMPTY);
        expect(sockets.messages.pop()).toEqual(JSON.stringify({ appId: 'core', message: { action: Constants.Action.DELETE } }));
        setTimeout(() => {
            // Update request is generated after a timeout, so it is required to wait for it.
            expect(sockets.messages.length).toEqual(1);
            expect(sockets.messages.pop()).toEqual(JSON.stringify(
                { appId: 'core', message: { action: Constants.Action.UPDATE, id: 0, app: { 'url': 'http://localhost:8081' } } }
            ));
            nock.cleanAll();
        }, TIMEOUT);
        jest.runOnlyPendingTimers();
    });

    it('should trigger an event to its sockets when a section is created and deleted without an app', async () => {
        await request(app).post('/section')
            .send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 })
            .expect(HttpStatus.OK, JSON.stringify({ id: 0 }));
        let spaces = { 'TestingNine': [ { }, { }, { }, { }, { }, { },
            { 'x': 0, 'y': 0, 'w': 10, 'h': 10, 'offset': { 'x': 10, 'y': 0 } }, { }, { } ] };
        expect(sockets.messages.pop()).toEqual(JSON.stringify(
            { appId: 'core', message: { action: Constants.Action.CREATE, id: 0, spaces: spaces } }
        ));
        await request(app).delete('/sections/0').expect(HttpStatus.OK, JSON.stringify({ ids: [0] }));
        expect(sockets.messages.pop()).toEqual(JSON.stringify(
            { appId: 'core', message: { action: Constants.Action.DELETE, id: 0 } }
        ));
        await request(app).delete('/sections').expect(HttpStatus.OK, Utils.JSON.EMPTY);
        expect(sockets.messages.pop()).toEqual(JSON.stringify({ appId: 'core', message: { action: Constants.Action.DELETE } }));
        setTimeout(() => {
            // Update request should not be generated after a timeout, unlike in the previous test.
            expect(sockets.messages.length).toEqual(0);
            nock.cleanAll();
        }, TIMEOUT);
        jest.runOnlyPendingTimers();
    });

    it('should trigger an event to its sockets when trying to read information about a section that has been created', async () => {
        await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 })
            .expect(HttpStatus.OK, JSON.stringify({ id: 0 }));
        let spaces = { 'TestingNine': [ { }, { }, { }, { }, { }, { },
            { 'x': 0, 'y': 0, 'w': 10, 'h': 10, 'offset': { 'x': 10, 'y': 0 } }, { }, { } ] };
        expect(sockets.messages.pop()).toEqual(JSON.stringify(
            { appId: 'core', message: { action: Constants.Action.CREATE, id: 0, spaces: spaces } }
        ));
        sockets.server.emit('message', JSON.stringify({ appId: 'core', message: { action: Constants.Action.READ } }));
        expect(sockets.messages.pop()).toEqual(JSON.stringify(
            { appId: 'core', message: { action: Constants.Action.CREATE, id: 0, spaces: spaces } }
        ));
        nock('http://localhost:8081').post('/instances/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        await request(app).delete('/sections').expect(HttpStatus.OK, Utils.JSON.EMPTY);
        expect(sockets.messages.pop()).toEqual(JSON.stringify({ appId: 'core', message: { action: Constants.Action.DELETE } }));
        setTimeout(() => {
            // Update request is generated after a timeout, so it is required to wait for it.
            expect(sockets.messages.length).toEqual(2);
            expect(sockets.messages.pop()).toEqual(JSON.stringify(
                { appId: 'core', message: { action: Constants.Action.UPDATE, id: 0, app: { 'url': 'http://localhost:8081' } } }
            ));
            expect(sockets.messages.pop()).toEqual(JSON.stringify(
                { appId: 'core', message: { action: Constants.Action.UPDATE, id: 0, app: { 'url': 'http://localhost:8081' } } }
            ));
            nock.cleanAll();
        }, TIMEOUT);
        jest.runOnlyPendingTimers();
    });

    it('should not trigger an event to its sockets when trying to read information about a section when the server-side socket is not ready', async () => {
        sockets.serverSocket.readyState = 0;
        await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 })
            .expect(HttpStatus.OK, JSON.stringify({ id: 0 }));
        let spaces = { 'TestingNine': [ { }, { }, { }, { }, { }, { },
            { 'x': 0, 'y': 0, 'w': 10, 'h': 10, 'offset': { 'x': 10, 'y': 0 } }, { }, { } ] };
        expect(sockets.messages.pop()).toEqual(JSON.stringify(
            { appId: 'core', message: { action: Constants.Action.CREATE, id: 0, spaces: spaces } }
        ));
        sockets.server.emit('message', JSON.stringify({ appId: 'core', message: { action: Constants.Action.READ } }));
        expect(sockets.messages.length).toEqual(0);
        nock('http://localhost:8081').post('/instances/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        await request(app).delete('/sections').expect(HttpStatus.OK, Utils.JSON.EMPTY);
        expect(sockets.messages.pop()).toEqual(JSON.stringify({ appId: 'core', message: { action: Constants.Action.DELETE } }));
        setTimeout(() => {
            // Update request is generated after a timeout, so it is required to wait for it.
            expect(sockets.messages.length).toEqual(1);
            expect(sockets.messages.pop()).toEqual(JSON.stringify(
                { appId: 'core', message: { action: Constants.Action.UPDATE, id: 0, app: { 'url': 'http://localhost:8081' } } }
            ));
            nock.cleanAll();
        }, TIMEOUT);
        jest.runOnlyPendingTimers();
    });

    it('should trigger an event to its sockets when trying to read information about a section that has been created without an app', async () => {
        await request(app).post('/section')
            .send({ 'h': 10, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 })
            .expect(HttpStatus.OK, JSON.stringify({ id: 0 }));
        let spaces = { 'TestingNine': [ { }, { }, { }, { }, { }, { },
            { 'x': 0, 'y': 0, 'w': 10, 'h': 10, 'offset': { 'x': 10, 'y': 0 } }, { }, { } ] };
        expect(sockets.messages.pop()).toEqual(JSON.stringify(
            { appId: 'core', message: { action: Constants.Action.CREATE, id: 0, spaces: spaces } }
        ));
        sockets.server.emit('message', JSON.stringify({ appId: 'core', message: { action: Constants.Action.READ } }));
        expect(sockets.messages.pop()).toEqual(JSON.stringify(
            { appId: 'core', message: { action: Constants.Action.CREATE, id: 0, spaces: spaces } }
        ));
        nock('http://localhost:8081').post('/instances/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        await request(app).delete('/sections').expect(HttpStatus.OK, Utils.JSON.EMPTY);
        expect(sockets.messages.pop()).toEqual(JSON.stringify({ appId: 'core', message: { action: Constants.Action.DELETE } }));
        setTimeout(() => {
            // Update request should not be generated after a timeout, unlike in the previous tests.
            expect(sockets.messages.length).toEqual(0);
            nock.cleanAll();
        }, TIMEOUT);
        jest.runOnlyPendingTimers();
    });

    it('should trigger limited events to its sockets when a section had a dimension change', async () => {
        await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 })
            .expect(HttpStatus.OK, JSON.stringify({ id: 0 }));
        let spaces = { 'TestingNine': [ { }, { }, { }, { }, { }, { },
            { 'x': 0, 'y': 0, 'w': 10, 'h': 10, 'offset': { 'x': 10, 'y': 0 } }, { }, { } ] };
        expect(sockets.messages.pop()).toEqual(JSON.stringify(
            { appId: 'core', message: { action: Constants.Action.CREATE, id: 0, spaces: spaces } }
        ));
        let scope = nock('http://localhost:8081').post('/instances/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        await request(app).post('/sections/0')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 20 })
            .expect(HttpStatus.OK, JSON.stringify({ id: 0 }));
        expect(scope.isDone()).not.toBeTruthy(); // request should not be made at this point.
        await request(app).delete('/sections').expect(HttpStatus.OK, Utils.JSON.EMPTY);
        expect(scope.isDone()).toBeTruthy(); // checks if the flush request was actually made.
        expect(sockets.messages.pop()).toEqual(JSON.stringify({ appId: 'core', message: { action: Constants.Action.DELETE } }));
        setTimeout(() => {
            expect(sockets.messages.length).toEqual(4);

            // The order of these messages are not important.
            expect(sockets.messages.includes(JSON.stringify(
                { appId: 'core', message: { action: Constants.Action.UPDATE, id: 0 } }
            ))).toBeTruthy();
            spaces = { 'TestingNine': [ { }, { }, { }, { }, { }, { },
                { 'x': 0, 'y': 0, 'w': 10, 'h': 10, 'offset': { 'x': 20, 'y': 0 } }, { }, { } ] };
            expect(sockets.messages.includes(JSON.stringify(
                { appId: 'core', message: { action: Constants.Action.UPDATE, id: 0, spaces: spaces } }
            ))).toBeTruthy();
            expect(sockets.messages.includes(JSON.stringify(
                { appId: 'core', message: { action: Constants.Action.UPDATE, id: 0, app: { 'url': 'http://localhost:8081' } } }
            ))).toBeTruthy();
            sockets.messages = [];
            nock.cleanAll();
        }, TIMEOUT);
        jest.runOnlyPendingTimers();
    });

    it('should trigger an event to its sockets when a section is updated in quick succession', async () => {
        await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 })
            .expect(HttpStatus.OK, JSON.stringify({ id: 0 }));
        let spaces = { 'TestingNine': [ { }, { }, { }, { }, { }, { },
            { 'x': 0, 'y': 0, 'w': 10, 'h': 10, 'offset': { 'x': 10, 'y': 0 } }, { }, { } ] };
        expect(sockets.messages.pop()).toEqual(JSON.stringify(
            { appId: 'core', message: { action: Constants.Action.CREATE, id: 0, spaces: spaces } }
        ));
        let scope = nock('http://localhost:8081').post('/instances/0/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        await request(app).post('/sections/0')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8082' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 })
            .expect(HttpStatus.OK, JSON.stringify({ id: 0 }));
        expect(scope.isDone()).toBeTruthy(); // checks if the flush request was actually made.
        nock('http://localhost:8082').post('/instances/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        await request(app).delete('/sections').expect(HttpStatus.OK, Utils.JSON.EMPTY);
        expect(sockets.messages.pop()).toEqual(JSON.stringify({ appId: 'core', message: { action: Constants.Action.DELETE } }));
        setTimeout(() => {
            expect(sockets.messages.length).toEqual(3);

            // The order of these messages are not important.
            expect(sockets.messages.includes(JSON.stringify(
                { appId: 'core', message: { action: Constants.Action.UPDATE, id: 0 } }
            ))).toBeTruthy();
            expect(sockets.messages.includes(JSON.stringify(
                { appId: 'core', message: { action: Constants.Action.UPDATE, id: 0, app: { 'url': 'http://localhost:8082' } } }
            ))).toBeTruthy();
            expect(sockets.messages.includes(JSON.stringify(
                { appId: 'core', message: { action: Constants.Action.UPDATE, id: 0, app: { 'url': 'http://localhost:8081' } } }
            ))).toBeTruthy();
            sockets.messages = [];
            nock.cleanAll();
        }, TIMEOUT);
        jest.runOnlyPendingTimers();
    });

    it('should trigger additional events to its sockets when a section is updated along with a dimension change', async () => {
        await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 })
            .expect(HttpStatus.OK, JSON.stringify({ id: 0 }));
        let spaces = { 'TestingNine': [ { }, { }, { }, { }, { }, { },
            { 'x': 0, 'y': 0, 'w': 10, 'h': 10, 'offset': { 'x': 10, 'y': 0 } }, { }, { } ] };
        expect(sockets.messages.pop()).toEqual(JSON.stringify(
            { appId: 'core', message: { action: Constants.Action.CREATE, id: 0, spaces: spaces } }
        ));
        nock('http://localhost:8081').post('/instances/0/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        await request(app).post('/sections/0')
            .send({ 'h': 100, 'app': { 'url': 'http://localhost:8082' }, 'space': 'TestingNine', 'w': 100, 'y': 0, 'x': 10 })
            .expect(HttpStatus.OK, JSON.stringify({ id: 0 }));
        nock('http://localhost:8082').post('/instances/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        await request(app).delete('/sections').expect(HttpStatus.OK, Utils.JSON.EMPTY);
        expect(sockets.messages.pop()).toEqual(JSON.stringify({ appId: 'core', message: { action: Constants.Action.DELETE } }));
        setTimeout(() => {
            expect(sockets.messages.length).toEqual(4);

            // The order of these messages are not important.
            expect(sockets.messages.includes(JSON.stringify(
                { appId: 'core', message: { action: Constants.Action.UPDATE, id: 0 } }
            ))).toBeTruthy();
            expect(sockets.messages.includes(JSON.stringify(
                { appId: 'core', message: { action: Constants.Action.UPDATE, id: 0, app: { 'url': 'http://localhost:8082' } } }
            ))).toBeTruthy();
            spaces = { 'TestingNine': [ { }, { }, { }, { }, { }, { },
                { 'x': 0, 'y': 0, 'w': 100, 'h': 100, 'offset': { 'x': 10, 'y': 0 } }, { }, { } ] };
            expect(sockets.messages.includes(JSON.stringify(
                { appId: 'core', message: { action: Constants.Action.UPDATE, id: 0, spaces: spaces } }
            ))).toBeTruthy();
            expect(sockets.messages.includes(JSON.stringify(
                { appId: 'core', message: { action: Constants.Action.UPDATE, id: 0, app: { 'url': 'http://localhost:8081' } } }
            ))).toBeTruthy();
            sockets.messages = [];
            nock.cleanAll();
        }, TIMEOUT);
        jest.runOnlyPendingTimers();
    });

    // This test is very similar to the test above, but without back to back calls. This test deletes sections
    // inside a setTimeout, which could mean that call does not happen before further tests are executed.
    // Therefore, make this the last test case to avoid unexpected failures.
    it('should trigger an event to its sockets when a section is updated', async () => {
        await request(app).post('/section')
            .send({ 'h': 10, 'app': { 'url': 'http://localhost:8081' }, 'space': 'TestingNine', 'w': 10, 'y': 0, 'x': 10 })
            .expect(HttpStatus.OK, JSON.stringify({ id: 0 }));
        let spaces = { 'TestingNine': [ { }, { }, { }, { }, { }, { },
            { 'x': 0, 'y': 0, 'w': 10, 'h': 10, 'offset': { 'x': 10, 'y': 0 } }, { }, { } ] };
        expect(sockets.messages.pop()).toEqual(JSON.stringify(
            { appId: 'core', message: { action: Constants.Action.CREATE, id: 0, spaces: spaces } }
        ));
        setTimeout(async () => {
            // Back to back calls could mean the update finds the new sectionId. This is not a problem in real,
            // but in order to test it, we have this delay.
            expect(sockets.messages.pop()).toEqual(JSON.stringify(
                { appId: 'core', message: { action: Constants.Action.UPDATE, id: 0, app: { 'url': 'http://localhost:8081' } } }
            ));
            nock('http://localhost:8081').post('/instances/0/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
            await request(app).post('/sections/0')
                .send({ 'h': 100, 'app': { 'url': 'http://localhost:8082' }, 'space': 'TestingNine', 'w': 100, 'y': 0, 'x': 10 })
                .expect(HttpStatus.OK, JSON.stringify({ id: 0 }));
            nock('http://localhost:8082').post('/instances/flush').reply(HttpStatus.OK, Utils.JSON.EMPTY);
            await request(app).delete('/sections').expect(HttpStatus.OK, Utils.JSON.EMPTY);
            expect(sockets.messages.pop()).toEqual(JSON.stringify({ appId: 'core', message: { action: Constants.Action.DELETE } }));
            expect(sockets.messages.length).toEqual(2);

            // The order of these messages are not important.
            expect(sockets.messages.includes(JSON.stringify(
                { appId: 'core', message: { action: Constants.Action.UPDATE, id: 0 } }
            ))).toBeTruthy();
            expect(sockets.messages.includes(JSON.stringify(
                { appId: 'core', message: { action: Constants.Action.UPDATE, id: 0, app: { 'url': 'http://localhost:8082' } } }
            ))).toBeTruthy();
            nock.cleanAll();
            global.console = OLD_CONSOLE;
        }, TIMEOUT);
        jest.runOnlyPendingTimers();
    });

    afterEach(async () => {
        while (sockets.messages.length > 0) {
            sockets.messages.pop();
        }
    });
    /* jshint ignore:end */

    afterAll(() => {
        sockets.server.stop();
        sockets.peerServer.stop();
    });
});
