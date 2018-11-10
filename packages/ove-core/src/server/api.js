const path = require('path');
const request = require('request');
const HttpStatus = require('http-status-codes');

module.exports = function (server, log, Utils, Constants) {
    const listClients = function (_req, res) {
        log.debug('Returning parsed result of Clients.json');
        Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(server.clients));
    };

    const listClientById = function (req, res) {
        let sectionId = req.params.id;
        if (!server.sections[sectionId]) {
            log.debug('Unable to produce list of clients for section id:', sectionId);
            Utils.sendEmptySuccess(res);
        } else {
            log.debug('Returning parsed result of Clients.json for section id:', sectionId);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(server.sections[sectionId].clients));
        }
    };

    // Creates an individual section
    const createSection = function (req, res) {
        if (!req.body.space || !server.clients[req.body.space]) {
            log.error('Invalid Space', 'request:', JSON.stringify(req.body));
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid space' }));
        } else if (req.body.w === undefined || req.body.h === undefined || req.body.x === undefined || req.body.y === undefined) {
            // specifically testing for undefined since '0' is a valid input.
            log.error('Invalid Dimensions', 'request:', JSON.stringify(req.body));
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));
        } else {
            let section = { w: req.body.w, h: req.body.h, clients: {} };
            section.clients[req.body.space] = [];

            // Calculate the dimensions on a client-by-client basis
            server.clients[req.body.space].forEach(function (e) {
                // A section overlaps with a client if all of these conditions are met:
                // - the section's left edge is to the left of the client's right edge
                // - the section's right edge is to the right of the client's left edge
                // - the section's top edge is above the client's bottom edge
                // - the section's bottom edge is below the client's top edge
                // If the section does not overlap with this client we ignore it.
                if ((e.x + e.w) > req.body.x && (req.body.x + req.body.w) > e.x &&
                    (e.y + e.h) > req.body.y && (req.body.y + req.body.h) > e.y) {
                    let c = Object.assign({}, e);
                    // We generally don't use offsets, but this can be used to move content relative
                    // to top-left both in the positive and negative directions. If the offsets were
                    // not set (the most common case), we initialize it to (0,0).
                    if (!c.offset) {
                        c.offset = { x: 0, y: 0 };
                    }
                    // In here we check if the section started before the starting point of a client
                    // and adjust it accordingly along the horizontal axis. If it wasn't the case, the
                    // section starts within the bounds of a client and therefore the offset is being
                    // set.
                    if (c.x >= req.body.x) {
                        c.x -= req.body.x;
                    } else {
                        c.offset.x += (req.body.x - c.x);
                        c.x = 0;
                        c.w -= c.offset.x;
                    }
                    // In here we check if the section ends before the ending point of the client and
                    // adjust the width of the frame along the horizontal axis.
                    if (c.x + c.w > req.body.w) {
                        c.w = (req.body.w - c.x);
                    }
                    // In here we check if the section started before the starting point of a client
                    // and adjust it accordingly along the vertical axis. If it wasn't the case, the
                    // section starts within the bounds of a client and therefore the offset is being
                    // set.
                    if (c.y >= req.body.y) {
                        c.y -= req.body.y;
                    } else {
                        c.offset.y += (req.body.y - c.y);
                        c.y = 0;
                        c.h -= c.offset.y;
                    }
                    // In here we check if the section ends before the ending point of the client and
                    // adjust the width of the frame along the vertical axis.
                    if (c.y + c.h > req.body.h) {
                        c.h = (req.body.h - c.y);
                    }
                    section.clients[req.body.space].push(c);
                } else {
                    section.clients[req.body.space].push({});
                }
            });
            log.debug('Generated client configuration for new section');

            // Deploy an App into a section
            let sectionId = server.sections.length;
            if (req.body.app) {
                const url = req.body.app.url.replace(/\/$/, '');
                section.app = { 'url': url };
                log.debug('Got URL for app:', url);
                if (req.body.app.states) {
                    /* istanbul ignore else */
                    // DEBUG logging is turned on by default, and only turned off in production deployments.
                    // The operation of the Constants.Logging.DEBUG flag has been tested elsewhere.
                    if (Constants.Logging.DEBUG) {
                        log.debug('Got state configuration for app:', JSON.stringify(req.body.app.states));
                    }
                    // Cache or load states if they were provided as a part of the create request.
                    if (req.body.app.states.cache) {
                        Object.keys(req.body.app.states.cache).forEach(function (name) {
                            log.debug('Caching new named state for future use:', name);
                            request.post(section.app.url + '/state/' + name, {
                                headers: { 'Content-Type': Constants.HTTP_CONTENT_TYPE_JSON },
                                json: req.body.app.states.cache[name]
                            });
                        });
                    }
                    if (req.body.app.states.load) {
                        // Either a named state or an in-line state configuration can be loaded.
                        if (typeof req.body.app.states.load === 'string' || req.body.app.states.load instanceof String) {
                            section.app.state = req.body.app.states.load;
                            log.debug('Loading existing named state:', section.app.state);
                        } else {
                            log.debug('Loading state configuration');
                            request.post(section.app.url + '/' + sectionId + '/state', {
                                headers: { 'Content-Type': Constants.HTTP_CONTENT_TYPE_JSON },
                                json: req.body.app.states.load
                            });
                        }
                    }
                }
            }
            server.sections[sectionId] = section;

            // Notify OVE viewers/controllers
            server.wss.clients.forEach(function (c) {
                if (c.readyState === Constants.WEBSOCKET_READY) {
                    // Sections are created on the browser and then the application is deployed after a
                    // short delay. This will ensure proper frame sizes.
                    c.safeSend(JSON.stringify({ appId: Constants.APP_NAME,
                        message: { action: Constants.Action.CREATE, id: sectionId, clients: section.clients } }));
                    if (section.app) {
                        setTimeout(function () {
                            c.safeSend(JSON.stringify({ appId: Constants.APP_NAME,
                                message: { action: Constants.Action.UPDATE, id: sectionId, app: section.app } }));
                        }, Constants.SECTION_UPDATE_DELAY);
                    }
                }
            });
            log.info('Successfully created new section:', sectionId);
            log.debug('Existing sections (active/deleted):', server.sections.length);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ id: sectionId }));
        }
    };

    // Deletes all sections
    const deleteSections = function (_req, res) {
        while (server.sections.length !== 0) {
            let section = server.sections.pop();
            if (section.app) {
                log.debug('Flushing application at URL:', section.app.url);
                request.post(section.app.url + '/flush');
            }
        }
        log.info('Deleting all sections');
        log.debug('Existing sections (active/deleted):', server.sections.length);

        server.wss.clients.forEach(function (c) {
            if (c.readyState === Constants.WEBSOCKET_READY) {
                c.safeSend(JSON.stringify({ appId: Constants.APP_NAME, message: { action: Constants.Action.DELETE } }));
            }
        });
        Utils.sendEmptySuccess(res);
    };

    // Fetches details of an individual section
    const readSectionById = function (req, res) {
        let sectionId = req.params.id;
        if (!server.sections[sectionId]) {
            log.debug('Unable to read configuration for section id:', sectionId);
            Utils.sendEmptySuccess(res);
        } else {
            let section = { id: parseInt(sectionId, 10), w: server.sections[sectionId].w, h: server.sections[sectionId].h };
            if (server.sections[sectionId].app && server.sections[sectionId].app.state) {
                section.state = server.sections[sectionId].app.state;
            }
            log.debug('Successfully read configuration for section id:', sectionId);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(section));
        }
    };

    // Updates an app associated with a section
    const updateSectionById = function (req, res) {
        let sectionId = req.params.id;
        if (Utils.isNullOrEmpty(server.sections[sectionId])) {
            log.error('Invalid Section Id:', sectionId);
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid section id' }));
        } else {
            // Redeploys an App into a section
            let commands = [];
            let oldURL = null;
            if (server.sections[sectionId].app) {
                oldURL = server.sections[sectionId].app.url;
                log.debug('Deleting existing application configuration');
                delete server.sections[sectionId].app;
                commands.push(JSON.stringify({ appId: Constants.APP_NAME, message: { action: Constants.Action.UPDATE, id: parseInt(sectionId, 10) } }));
            }
            if (req.body.app) {
                const url = req.body.app.url.replace(/\/$/, '');
                if (oldURL && oldURL !== url) {
                    log.debug('Flushing application at URL:', oldURL);
                    request.post(oldURL + '/flush');
                }
                server.sections[sectionId].app = { 'url': url };
                log.debug('Got URL for app:', url);
                if (req.body.app.states) {
                    /* istanbul ignore else */
                    // DEBUG logging is turned on by default, and only turned off in production deployments.
                    // The operation of the Constants.Logging.DEBUG flag has been tested elsewhere.
                    if (Constants.Logging.DEBUG) {
                        log.debug('Got state configuration for app:', JSON.stringify(req.body.app.states));
                    }
                    // Cache or load states if they were provided as a part of the update request.
                    if (req.body.app.states.cache) {
                        Object.keys(req.body.app.states.cache).forEach(function (name) {
                            log.debug('Caching new named state for future use:', name);
                            request.post(server.sections[sectionId].app.url + '/state/' + name, {
                                headers: { 'Content-Type': Constants.HTTP_CONTENT_TYPE_JSON },
                                json: req.body.app.states.cache[name]
                            });
                        });
                    }
                    if (req.body.app.states.load) {
                        // Either a named state or an in-line state configuration can be loaded.
                        if (typeof req.body.app.states.load === 'string' || req.body.app.states.load instanceof String) {
                            server.sections[sectionId].app.state = req.body.app.states.load;
                            log.debug('Loading existing named state:', server.sections[sectionId].app.state);
                        } else {
                            log.debug('Loading state configuration');
                            request.post(server.sections[sectionId].app.url + '/' + sectionId + '/state', {
                                headers: { 'Content-Type': Constants.HTTP_CONTENT_TYPE_JSON },
                                json: req.body.app.states.load
                            });
                        }
                    }
                }
                commands.push(JSON.stringify({ appId: Constants.APP_NAME, message: { action: Constants.Action.UPDATE, id: parseInt(sectionId, 10), app: req.body.app } }));
            } else if (oldURL) {
                log.debug('Flushing application at URL:', oldURL);
                request.post(oldURL + '/flush');
            }

            // Notify OVE viewers/controllers
            server.wss.clients.forEach(function (c) {
                if (c.readyState === Constants.WEBSOCKET_READY) {
                    commands.forEach(function (m) {
                        c.safeSend(m);
                    });
                }
            });
            log.info('Successfully updated section:', sectionId);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ id: parseInt(sectionId, 10) }));
        }
    };

    // Deletes an individual section
    const deleteSectionById = function (req, res) {
        let sectionId = req.params.id;
        if (Utils.isNullOrEmpty(server.sections[sectionId])) {
            log.error('Invalid Section Id:', sectionId);
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid section id' }));
        } else {
            let section = server.sections[sectionId];
            if (section.app) {
                log.debug('Flushing application at URL:', section.app.url);
                request.post(section.app.url + '/flush');
            }
            delete server.sections[sectionId];
            server.sections[sectionId] = {};

            server.wss.clients.forEach(function (c) {
                if (c.readyState === Constants.WEBSOCKET_READY) {
                    c.safeSend(JSON.stringify({ appId: Constants.APP_NAME, message: { action: Constants.Action.DELETE, id: parseInt(sectionId, 10) } }));
                }
            });
            log.info('Successfully deleted section:', sectionId);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ id: parseInt(sectionId, 10) }));
        }
    };

    server.app.get('/clients', listClients);
    server.app.get('/client/:id', listClientById);
    server.app.delete('/sections', deleteSections);
    server.app.post('/section', createSection);
    server.app.get('/section/:id', readSectionById);
    server.app.post('/section/:id', updateSectionById);
    server.app.delete('/section/:id', deleteSectionById);

    // Swagger API documentation
    Utils.buildAPIDocs(path.join(__dirname, 'swagger.yaml'), path.join(__dirname, '..', '..', 'package.json'));
};
