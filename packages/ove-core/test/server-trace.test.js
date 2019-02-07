const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

jest.resetModules(); // This is important
process.env.LOG_LEVEL = 6;

// Do not expose console during init.
const OLD_CONSOLE = global.console;
global.console = { log: jest.fn(x => x), warn: jest.fn(x => x), error: jest.fn(x => x) };

const app = express();
const wss = require('express-ws')(app).getWss('/');

// We always test against the distribution not the source.
const srcDir = path.join(__dirname, '..', 'src');
const dirs = {
    base: srcDir,
    nodeModules: path.join(srcDir, '..', '..', '..', 'node_modules'),
    constants: path.join(srcDir, 'client', 'utils'),
    rootPage: path.join(srcDir, 'landing.html')
};
const { Constants, Utils } = require('@ove-lib/utils')('core', app, dirs);
const log = Utils.Logger('OVE');

app.use(cors());
app.use(express.json());

const spaces = JSON.parse(fs.readFileSync(path.join(srcDir, '..', 'test', 'resources', Constants.SPACES_JSON_FILENAME)));
const server = require(path.join(srcDir, 'server', 'main'))(app, wss, spaces, log, Utils, Constants);

// Restore console before run.
global.console = OLD_CONSOLE;

// Separate test suite for scenarios where log level TRACE_SERVER is enabled.
// Based on how mock-socket is implemented, we cannot group all tests together.
describe('The OVE Core server with log level TRACE_SERVER enabled', () => {
    const { WebSocket, Server } = require('mock-socket');
    const PORT = 5556;
    const PEER_PORT = 5546;

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

        // We need at least one peer socket;
        sockets.peerSocket = new WebSocket(peerUrl);
        sockets.peerSocket.readyState = 1;

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
    });

    it('should be logging all received events', () => {
        const middleware = require(path.join(srcDir, 'server', 'messaging'))(server, log, Utils, Constants);
        middleware(sockets.serverSocket);

        sockets.messages = [];
        const spy = jest.spyOn(log, 'trace');
        server.peers['ws://localhost:' + PEER_PORT] = sockets.peerSocket;
        sockets.server.emit('message', JSON.stringify({ appId: 'foo', message: { action: Constants.Action.READ } }));
        expect(sockets.messages.length).toEqual(2);
        expect(sockets.messages.pop()).toEqual(JSON.stringify({ appId: 'foo', message: { action: Constants.Action.READ }, forwardedBy: [server.uuid] }));
        expect(sockets.messages.pop()).toEqual(JSON.stringify({ appId: 'foo', message: { action: Constants.Action.READ } }));
        expect(spy).toHaveBeenCalled();
        server.peers = {};
        spy.mockRestore();
    });

    afterAll(() => {
        sockets.server.stop();
        global.console = OLD_CONSOLE;
    });
});
