const HttpStatus = require('http-status-codes');

module.exports = function (server, log, Utils, Constants) {
    /**************************************************************
                           Peers of OVE Core
    **************************************************************/
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        let r = Math.random() * 16 | 0;
        let v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });

    // It is required that we are able to access variables like these during testing.
    const peers = {
        clients: {},
        uuid: uuid,
        // We maintain an array of handler that would be called when we receive a message
        // from a a peer. Each handler should validate the message and ignore if it was not
        // the message that it expected.
        receive: [],
        send: function (m) {
            Object.keys(peers.clients).forEach(function (p) {
                const c = peers.clients[p];
                if (c.readyState === Constants.WEBSOCKET_READY) {
                    if (Constants.Logging.TRACE_SERVER) {
                        log.trace('Sending to peer:', p, ', message:', m);
                    }
                    // We set a forwardedBy property on the message to avoid it being forwarded
                    // in a loop. There can be more than one peer participating in a broadcast
                    // so we need to keep track of multiple peers who have forwarded the same
                    // message.
                    if (!m.forwardedBy) {
                        m.forwardedBy = [];
                    }
                    m.forwardedBy.push(uuid);
                    c.safeSend(JSON.stringify(m));
                }
            });
        }
    };

    const getSocket = function (peerHost) {
        const socketURL = 'ws://' + peerHost;
        log.debug('Establishing WebSocket connection with:', socketURL);

        let ws = new (require('ws'))(socketURL);
        ws.on('close', function (code) {
            log.warn('Lost websocket connection: closed with code:', code);
            log.warn('Attempting to reconnect in ' + Constants.SOCKET_REFRESH_DELAY + 'ms');
            // If the socket is closed, we try to refresh it.
            setTimeout(getSocket, Constants.SOCKET_REFRESH_DELAY);
        });
        ws.on('error', log.error);
        return Utils.getSafeSocket(ws);
    };

    // Utility function to get peer socket URL
    const _getPeerSocketURL = function (peerURL) {
        let host = peerURL;
        /* istanbul ignore else */
        // The host should never be null, empty or undefined based on how this method is used.
        // This check is an additional precaution.
        if (host) {
            if (host.indexOf('//') >= 0) {
                host = host.substring(host.indexOf('//') + 2);
            }
            if (host.indexOf('/') >= 0) {
                host = host.substring(0, host.indexOf('/'));
            }
        }
        return host;
    };

    const updatePeers = function (req, res) {
        if (!(req.body instanceof Array)) {
            log.error('Invalid request to update peers:', JSON.stringify(req.body));
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, Utils.JSON.EMPTY);
            return;
        }
        const peerList = [];
        req.body.forEach(function (peer) {
            if (peer.url) {
                peerList.push(_getPeerSocketURL(peer.url));
            }
        });
        peerList.forEach(function (peer) {
            if (!peers.clients[peer]) {
                log.debug('Adding peer:', peer);
                peers.clients[peer] = getSocket(peer);
            }
        });
        Object.keys(peers.clients).forEach(function (peer) {
            if (peerList.indexOf(peer) === -1) {
                log.debug('Removing peer:', peer);
                peers.clients[peer].close();
                delete peers.clients[peer];
            }
        });
        log.info('Successfully updated peers of node');
        log.debug('Existing active peers:', Object.keys(peers.clients).length);
        Utils.sendEmptySuccess(res);
    };

    server.app.post('/peers', updatePeers);

    return peers;
};
