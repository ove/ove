module.exports = function (server, log, Utils, Constants) {
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
