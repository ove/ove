const Utils = global.Utils;

// WebSocket testing is done using a Mock Socket. The tests run a WSS and inject the mocked
// WS into the express app.
describe('The OVE Core server', () => {
    const { WebSocket, Server } = require('mock-socket');
    const PORT = 5555;

    let sockets = {};
    WebSocket.prototype.send = (m) => {
        sockets.messages.push(m);
    };

    const OLD_CONSOLE = global.console;
    beforeAll(() => {
        global.console = { log: jest.fn(x => x), warn: jest.fn(x => x), error: jest.fn(x => x) };
        const url = 'ws://localhost:' + PORT;
        sockets.server = new Server(url);
        sockets.open = new WebSocket(url);
        sockets.open.readyState = 1;

        // There should also be a socket which is not ready to receive messages, and sockets
        // that fail to send messages which will ensure all code branches are tested.
        sockets.closed = new WebSocket(url);
        sockets.closed.send = () => {
            throw new Error('some error');
        };
        sockets.closed.readyState = 0;

        sockets.failing = new WebSocket(url);
        sockets.failing.send = () => {
            throw new Error('some error');
        };
        sockets.failing.readyState = 1;

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

    beforeEach(() => {
        sockets.messages = [];
        sockets.serverSocket.readyState = 1;
        sockets.open.readyState = 1;
        sockets.closed.readyState = 0;
        sockets.failing.readyState = 1;
    });

    it('should be complaining when a read event from the core application is sent with a section id', () => {
        let spy = jest.spyOn(global.console, 'error');
        Utils.getSafeSocket(sockets.closed).safeSend('message', JSON.stringify({ test: 'closed' }));
        expect(sockets.messages.length).toEqual(0);
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
        spy = jest.spyOn(global.console, 'error');
        Utils.getSafeSocket(sockets.failing).safeSend('message', JSON.stringify({ test: 'failing' }));
        expect(sockets.messages.length).toEqual(0);
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
        spy = jest.spyOn(global.console, 'error');
        Utils.getSafeSocket(sockets.open).safeSend('message', JSON.stringify({ test: 'open' }));
        expect(sockets.messages.length).toEqual(1);
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    afterAll(() => {
        global.console = OLD_CONSOLE;
    });
});
