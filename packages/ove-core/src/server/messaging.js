const HttpStatus = require('http-status-codes');

module.exports = function (server, log, Utils, Constants) {
    /**************************************************************
                           Peers of OVE Core
    **************************************************************/

    // It is required that we are able to access variables like these during testing.
    server.peers = {};

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
        const peers = [];
        req.body.forEach(function (peer) {
            if (peer.url) {
                peers.push(_getPeerSocketURL(peer.url));
            }
        });
        peers.forEach(function (peer) {
            if (!server.peers[peer]) {
                log.debug('Adding peer:', peer);
                server.peers[peer] = getSocket(peer);
            }
        });
        Object.keys(server.peers).forEach(function (peer) {
            if (peers.indexOf(peer) === -1) {
                log.debug('Removing peer:', peer);
                server.peers[peer].close();
                delete server.peers[peer];
            }
        });
        log.info('Successfully updated peers of node');
        log.debug('Existing active peers:', Object.keys(server.peers).length);
        Utils.sendEmptySuccess(res);
    };

    server.app.post('/peers', updatePeers);

    /**************************************************************
                        Messaging Functionality
    **************************************************************/
    return function (s) {
        s.safeSend(JSON.stringify({ func: 'connect' }));
        s.on('message', function (msg) {
            let m = JSON.parse(msg);

            // All methods except the method for viewers to request section information that
            // helps browser crash recovery
            if (m.appId !== Constants.APP_NAME || m.message.action !== Constants.Action.READ) {
                server.wss.clients.forEach(function (c) {
                    // We respond to every socket but not to the sender
                    if (c !== s && c.readyState === Constants.WEBSOCKET_READY) {
                        if (Constants.Logging.TRACE_SERVER) {
                            log.trace('Sending to socket:', c.id, ', message:', msg);
                        }
                        c.safeSend(msg);
                    }
                });
                // We forward the same message to all peers
                Object.keys(server.peers).forEach(function (p) {
                    const c = server.peers[p];
                    if (c.readyState === Constants.WEBSOCKET_READY) {
                        if (Constants.Logging.TRACE_SERVER) {
                            log.trace('Sending to peer:', p, ', message:', msg);
                        }
                        c.safeSend(msg);
                    }
                });
                return;
            }

            // We need a section id for anything beyond this point.
            if (m.sectionId !== undefined) {
                // specifically testing for undefined since '0' is a valid input.
                log.error('Section information cannot be requested from within a section');
                return;
            }

            // Method for viewers to request section information, helps browser crash recovery
            const sections = server.state.get('sections');
            sections.forEach(function (section, sectionId) {
                // We respond only to the sender and only if a section exists.
                if (section && s.readyState === Constants.WEBSOCKET_READY) {
                    // Sections are created on the browser and then the application is deployed after a
                    // short delay. This will ensure proper frame sizes.
                    s.safeSend(JSON.stringify({ appId: Constants.APP_NAME, message: { action: Constants.Action.CREATE, id: sectionId, spaces: section.spaces } }));
                    if (section.app) {
                        setTimeout(function () {
                            s.safeSend(JSON.stringify({ appId: Constants.APP_NAME, message: { action: Constants.Action.UPDATE, id: sectionId, app: section.app } }));
                        }, Constants.SECTION_UPDATE_DELAY);
                    }
                }
            });
        });
        /* istanbul ignore else */
        // DEBUG logging is turned on by default, and only turned off in production deployments.
        // The operation of the Constants.Logging.DEBUG flag has been tested elsewhere.
        if (Constants.Logging.DEBUG) {
            // Associate an ID for each WebSocket, which will subsequently be used when logging.
            s.id = server.wss.clients.size;
            log.debug('WebSocket connection established. Clients connected:', server.wss.clients.size);
        }
    };
};
