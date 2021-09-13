const path = require('path');
const request = require('request');
const HttpStatus = require('http-status-codes');
const axios = require('axios');

module.exports = (server, log, Utils, Constants, ApiUtils) => {
    const peers = server.peers;
    const operation = {};

    // It is required that we are able to clean-up variables like these during testing.
    server.spaceGeometries = {};

    // Internal utility method to forward a payload to a peer.
    const _messagePeers = (op, req) => peers.send({ appId: Constants.APP_NAME, message: { op: op, req: req } });

    peers.receive.push(m => {
        const fn = operation[m.op];

        if (!fn) return;
        if (Constants.Logging.TRACE_SERVER) {
            log.trace('Got message from peer:', m.forwardedBy, ', message:', m);
        }

        fn(m.req, { status: () => { return { set: () => { return { send: () => {} }; } }; } });
    });

    // Lists details of all spaces, and accepts filters as a part of its query string.
    operation.listSpaces = (req, res) => {
        const sectionId = req.query.oveSectionId;

        if (sectionId === undefined) {
            log.debug('Returning parsed result of ' + Constants.SPACES_JSON_FILENAME);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(server.spaces));
        } else if (!server.state.get('sections[' + sectionId + ']')) {
            log.debug('Unable to produce list of spaces for section id:', sectionId);
            Utils.sendEmptySuccess(res);
        } else {
            log.debug('Returning parsed result of ' + Constants.SPACES_JSON_FILENAME + ' for section id:', sectionId);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(server.state.get('sections[' + sectionId + '][spaces]')));
        }
    };

    operation.listConnections = (req, res) => {
        log.debug('Listing connections');
        const space = req.query.space;
        const groupBy = (xs, key) => xs.reduce((rv, x) => {
            (rv[x[key]] = rv[x[key]] || []).push(x.secondary.toString());
            return rv;
        }, {});
        const formatConnection = (connection) => ({
            primary: connection.primary,
            secondary: connection.secondary,
            sections: groupBy(connection.map || [], 'primary')
        });

        if (space) {
            const connection = ApiUtils.getConnection(ApiUtils.getDefaultElem(space));
            if (connection) {
                Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(formatConnection(connection)));
            } else {
                Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ msg: `No connections for space: ${space}` }));
            }
        } else {
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(ApiUtils.getConnections().map(formatConnection)));
        }
    };

    // Internal utility function to calculate space geometries.
    const _getSpaceGeometries = () => {
        if (Utils.isNullOrEmpty(server.spaceGeometries) && !Utils.isNullOrEmpty(server.spaces)) {
            Object.keys(server.spaces).forEach(s => {
                const geometry = { w: Number.MIN_VALUE, h: Number.MIN_VALUE };
                server.spaces[s].forEach(e => {
                    geometry.w = Math.max(e.x + e.w, geometry.w);
                    geometry.h = Math.max(e.y + e.h, geometry.h);
                });
                log.debug('Successfully computed geometry for space:', s);
                server.spaceGeometries[s] = geometry;
            });
        }
        return server.spaceGeometries;
    };

    // Gets geometry of a named space.
    operation.getSpaceGeometry = (req, res) => {
        const spaceName = req.params.name;
        const geometry = _getSpaceGeometries()[spaceName];

        if (Utils.isNullOrEmpty(geometry)) {
            log.error('Invalid Space', 'name:', spaceName);
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid space' }));
        } else {
            log.debug('Returning geometry for space:', spaceName);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(geometry));
        }
    };

    // backing method for details api call.
    // returns the replicas if the id is primary
    // returns the primary if the id is secondary
    const _getSectionConnection = (id, onError) => {
        const elem = ApiUtils.getDefaultElem(ApiUtils.getSpaceBySectionId(id));
        const connection = ApiUtils.getConnection(elem);

        if (!connection) {
            onError(`Section ${id} is not connected`);
            return;
        }

        return ApiUtils.isPrimaryForConnection(connection, elem)
            ? { primary: id, secondary: ApiUtils.getReplicas(connection, id).map(({ secondary }) => secondary) }
            : { primary: ApiUtils.getPrimarySection(connection, id, elem), secondary: id };
    };

    // handler for details api call, including errors
    operation.getSectionConnection = (req, res) => {
        const mapping = _getSectionConnection(Number(req.params.id), msg => _sendError(res, msg));
        if (mapping) Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ section: mapping }));
    };

    // send error message with a http bad request
    const _sendError = (res, msg, logging) => {
        log.error(logging || msg);
        Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: msg }));
    };

    operation.deleteConnection = async (req, res) => {
        const primary = { space: req.params.primary, host: req.body?.primary || process.env.OVE_HOST };
        const secondary = req.params.secondary ? { space: req.params.secondary, host: req.body?.secondary || process.env.OVE_HOST } : undefined;
        const connection = await ApiUtils.getConnectionWrapper(secondary || primary);

        if (!connection) {
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: `No connection for space: ${req.params.secondary || req.params.primary}` }));
            return;
        }

        if (req.params.secondary) {
            await ApiUtils.disconnectSpaceWrapper(connection, secondary);
        } else {
            await ApiUtils.removeConnectionWrapper(connection, primary);
        }

        Utils.sendMessage(res, HttpStatus.OK, Utils.JSON.EMPTY);
    };

    const _replicate = async (connection, section, elem) => {
        // TODO: fix this URL conversion
        const convertURL = (url) => {
            const split = url.split('/');
            split[2] = elem.host;
            return split.join('/');
        };

        if (section?.app?.url) {
            section.app.url = convertURL(section.app.url);
        }

        const primaryGeometry = await ApiUtils.get(
            `${Constants.HTTP_PROTOCOL}${connection.primary.host}/spaces/${connection.primary.space}/geometry`,
            { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON }
        ).catch(log.warn);

        const geometry = await ApiUtils.get(
            `${Constants.HTTP_PROTOCOL}${elem.host}/spaces/${elem.space}/geometry`,
            { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON }
        ).catch(log.warn);

        const data = ApiUtils.getSectionData(section, primaryGeometry, geometry, elem.space);
        data.primaryId = section.id;

        const id = (await ApiUtils.post(
            `${Constants.HTTP_PROTOCOL}${elem.host}/section`,
            { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
            data
        ).catch(log.warn)).id;

        return ApiUtils.replicateWrapper(connection, section, id, elem);
    };

    operation.cache = async (req, res) => {
        if (!ApiUtils.isValidSectionId(req.params.id)) {
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: `No section found for id: ${req.params.id}` }));
            return;
        }

        const elem = ApiUtils.getDefaultElem(ApiUtils.getSpaceBySectionId(req.params.id));
        const map = _getSectionMap(req.params.id, elem);

        if (map) {
            await _cache(map, req.body);
            Utils.sendMessage(res, HttpStatus.OK, Utils.JSON.EMPTY);
        } else {
            Utils.sendEmptySuccess(res);
        }
    };

    const _getSectionMap = (sectionId, elem) => {
        const connection = ApiUtils.getConnection(elem);

        if (!connection) return;
        if (ApiUtils.isPrimaryForConnection(connection, elem)) {
            return ApiUtils.getReplicas(connection, sectionId).map(({ secondary, elem }) => ({
                id: secondary,
                elem: elem
            }));
        } else {
            const primary = ApiUtils.getPrimarySection(connection, sectionId, elem);
            const replicas = ApiUtils.getReplicas(connection, primary).map(({ secondary, elem }) => ({
                id: secondary,
                elem: elem
            })).filter(({ id }) => Number(id) !== Number(sectionId));
            return replicas.concat([{ id: primary, elem: connection.primary }]);
        }
    };

    const _cache = async (map, body) => {
        log.debug('Caching application state across all replicas: ', map.map(x => x.id));
        await Promise.all(map.map(async ({ id, elem }) =>
            ApiUtils.post(
                `${await ApiUtils.getURLForIdWrapper(elem.host, id)}/instances/${id}/state`,
                { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                body
            )));
    };

    operation.deleteConnections = async (req, res) => {
        await ApiUtils.clearConnectionsWrapper();
        Utils.sendMessage(res, HttpStatus.OK, Utils.JSON.EMPTY);
    };

    const _createConnection = async (primary, secondary, error) => {
        const initialize = async connection => {
            connection.isInitialized = true;
            await ApiUtils.updateConnectionStateWrapper(primary.host, connection);
            await ApiUtils.forEachSecondary(connection, async (connection, s) => {
                if (primary.host !== s.host) {
                    await ApiUtils.updateConnectionStateWrapper(s.host, connection);
                }
            });
        };

        if (ApiUtils.elemEquals(primary, secondary)) {
            error(`Primary and secondary spaces are the same`);
            return;
        }
        log.debug('primary:', primary);
        log.debug('secondary:', secondary);
        // check if primary is a secondary anywhere else and if the secondary has any connections, if so, error
        if ((await ApiUtils.isSecondaryWrapper(primary)) || (await ApiUtils.isConnectedWrapper(secondary))) {
            error(`Could not connect ${primary.space} and ${secondary.space} as there is an existing connection`);
            return;
        }
        // update connections to include new connection
        let connection;
        try {
            connection = await ApiUtils.updateConnectionWrapper(primary, secondary);
        } catch (e) {
            log.debug('Logging error:', e);
            error(`${e}`);
            return;
        }

        // clear sections in secondary space
        await ApiUtils.del(`${Constants.HTTP_PROTOCOL}${secondary.host}/sections?space=${secondary.space}`, {});

        const primarySections = ApiUtils.getSectionsForSpace(primary);
        if (primarySections.length === 0) {
            await initialize(connection);
            return [];
        }

        // replicate all sections from primary space to secondary
        const replicas = await Promise.all(primarySections
            .map(section => _replicate(connection, section, secondary)));

        await initialize(connection);

        return replicas.map(({ secondary }) => secondary);
    };

    // http request handler, calling backing method. Includes error handling.
    // expecting primary and secondary as url query parameters.
    operation.createConnection = async (req, res) => {
        const sendError = msg => _sendError(res, msg);

        if (req.body.primary && req.body.primary !== process.env.OVE_HOST) {
            sendError(`Expected primary host: ${process.env.OVE_HOST}, received: ${req.body.primary}`);
            return;
        }
        if ((req.body.primary && !req.body.secondary) || (req.body.secondary && !req.body.primary)) {
            sendError(`Expected two hosts, only received one`);
            return;
        }
        if (req.body.primary && !req.body.protocol) {
            sendError('No protocol for the secondary host has been provided');
            return;
        }

        const primary = { space: req.params.primary, host: req.body.primary || process.env.OVE_HOST, protocol: request.protocol };
        const secondary = { space: req.params.secondary, host: req.body.secondary || process.env.OVE_HOST, protocol: req.body.protocol || request.protocol };

        const sections = await _createConnection(primary, secondary, sendError);
        if (sections) Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ ids: sections }));
    };

    operation.onEvent = (req, res) => {
        const id = req.params.id;

        if (!ApiUtils.isValidSectionId(id)) {
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: `No section found for id: ${id}` }));
            return;
        }

        const map = _getSectionMap(id, ApiUtils.getDefaultElem(ApiUtils.getSpaceBySectionId(id)));

        if (!map) {
            Utils.sendEmptySuccess(res);
        } else {
            _onEvent(map, req.body);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ ids: map.map(({ id }) => id) }));
        }
    };

    operation.distributeEvent = (req, res) => {
        const elem = req.body.elem;
        const id = req.params.id;
        log.debug('id:', id, 'elem:', elem);

        if (elem.host !== process.env.OVE_HOST) {
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: `Expected host: ${process.env.OVE_HOST}, received host: ${elem.host}` }));
            return;
        }

        server.wss.clients.forEach(c => {
            if (c.readyState !== Constants.WEBSOCKET_READY) return;
            const newMessage = { appId: req.body.appId, sectionId: id.toString(), message: req.body.message };
            c.safeSend(JSON.stringify(newMessage));
        });

        Utils.sendEmptySuccess(res);
    };

    const _onEvent = (map, body) => {
        map.forEach(({ id, elem }) => {
            if (elem.host === process.env.OVE_HOST) {
                server.wss.clients.forEach(c => {
                    if (c.readyState !== Constants.WEBSOCKET_READY) return;
                    const newMessage = { appId: body.appId, sectionId: id.toString(), message: body.message };
                    c.safeSend(JSON.stringify(newMessage));
                });
                return;
            }
            ApiUtils.post(
                `${Constants.HTTP_PROTOCOL}${elem.host}/distribute/event/${id}`,
                { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                { ...body, elem: elem }
            );
        });
    };

    const _calculateSectionLayout = (spaceName, geometry) => {
        // Calculate the dimensions on a client-by-client basis
        let layout = [];
        server.spaces[spaceName].forEach(e => {
            // A section overlaps with a client if all of these conditions are met:
            // - the section's left edge is to the left of the client's right edge
            // - the section's right edge is to the right of the client's left edge
            // - the section's top edge is above the client's bottom edge
            // - the section's bottom edge is below the client's top edge
            // If the section does not overlap with this client we ignore it.
            if ((e.x + e.w) <= geometry.x || (geometry.x + geometry.w) <= e.x ||
                (e.y + e.h) <= geometry.y || (geometry.y + geometry.h) <= e.y) {
                layout.push({});
                return;
            }
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
            if (c.x >= geometry.x) {
                c.x -= geometry.x;
            } else {
                c.offset.x += (geometry.x - c.x);
                c.x = 0;
                c.w -= c.offset.x;
            }
            // In here we check if the section ends before the ending point of the client and
            // adjust the width of the frame along the horizontal axis.
            if (c.x + c.w > geometry.w) {
                c.w = (geometry.w - c.x);
            }
            // In here we check if the section started before the starting point of a client
            // and adjust it accordingly along the vertical axis. If it wasn't the case, the
            // section starts within the bounds of a client and therefore the offset is being
            // set.
            if (c.y >= geometry.y) {
                c.y -= geometry.y;
            } else {
                c.offset.y += (geometry.y - c.y);
                c.y = 0;
                c.h -= c.offset.y;
            }
            // In here we check if the section ends before the ending point of the client and
            // adjust the width of the frame along the vertical axis.
            if (c.y + c.h > geometry.h) {
                c.h = (geometry.h - c.y);
            }
            layout.push(c);
        });

        return layout;
    };

    const _handleRequestError = e => {
        /* istanbul ignore if */
        // It is impossible to test this scenario as there would be issues in the test runner if URLs
        // were invalid. This is easily testable using an integration test-case, since PM2/node will
        // eventually report the error after several seconds.
        if (e) {
            log.warn('Connection error when making request:', e);
        }
    };

    // method to determine whether a corresponding operation applies to the given socket or not.
    const _isInGeometry = (socket, spaces) => {
        if (socket.sectionId) {
            return false;
        } else if (!spaces) {
            return true;
        }

        let geometry = (spaces[socket.space] || [])[socket.client] || {};

        return Object.keys(geometry).length !== 0 && geometry.h > 0 && geometry.w > 0;
    };

    // body: space, w, h, x, y, app
    const _createSection = async (body, sendError, sendMessage) => {
        const _loadReplicatedState = (body, primaryId, sectionId) => {
            if (!body.app.url) return;
            log.debug('Loading state from primary section: ', primaryId);
            request.get({
                url: `${body.app.url}/instances/${primaryId}/state`,
                json: true
            }, (error, response, b) => {
                if (!error && response && response.statusCode === HttpStatus.OK) {
                    request.post(body.app.url + '/instances/' + sectionId + '/state', {
                        headers: { 'Content-Type': Constants.HTTP_CONTENT_TYPE_JSON },
                        json: b
                    }, _handleRequestError);
                }
            });
        };

        if (!sendMessage) { sendMessage = () => {}; }
        if (!body.space || !server.spaces[body.space]) {
            log.error('Invalid Space', 'request:', JSON.stringify(body));
            sendError('invalid space');
            return;
        } else if (body.w === undefined || body.h === undefined || body.x === undefined || body.y === undefined) {
            // specifically testing for undefined since '0' is a valid input.
            log.error('Invalid Dimensions', 'request:', JSON.stringify(body));
            sendError('invalid dimensions');
            return;
        } else if (body.app && !body.app.url) {
            log.error('Invalid App Configuration', 'request:', JSON.stringify(body.app));
            sendError('invalid app configuration');
            return;
        }
        let section = { w: body.w, h: body.h, x: body.x, y: body.y, spaces: {} };
        section.spaces[body.space] = _calculateSectionLayout(body.space, {
            x: body.x, y: body.y, w: body.w, h: body.h
        });
        log.debug('Generated spaces configuration for new section');

        // Deploy an App into a section
        let sectionId = server.state.get('sections').length;
        section.id = sectionId;

        if (body.app) {
            const url = body.app.url.replace(/\/$/, '');
            section.app = { 'url': url };
            log.debug('Got URL for app:', url);

            if (body.app.opacity) {
                log.debug('Setting opacity for app:', body.app.opacity);
                section.app.opacity = body.app.opacity;
            }

            if (body.primaryId !== undefined) {
                _loadReplicatedState(body, body.primaryId, sectionId);
            } else {
                _loadSectionState(body.app, section, sectionId);
            }
        }

        server.state.set('sections[' + sectionId + ']', section);

        // Notify OVE viewers/controllers
        _getReadySockets().filter(c => _isInGeometry(c)).forEach(c => {
            // Sections are created on the browser and then the application is deployed after a
            // short delay. This will ensure proper frame sizes.
            c.safeSend(JSON.stringify({
                appId: Constants.APP_NAME,
                message: { action: Constants.Action.CREATE, id: sectionId, spaces: section.spaces }
            }));
            if (section.app) {
                setTimeout(() => {
                    c.safeSend(JSON.stringify({
                        appId: Constants.APP_NAME,
                        message: { action: Constants.Action.UPDATE, id: sectionId, app: section.app }
                    }));
                }, Constants.SECTION_UPDATE_DELAY);
            }
        });

        await ApiUtils.applyPrimary(body.space, async (connection, elem) => _replicate(connection, section, elem));

        log.debug('Successfully created replicas');
        log.info('Successfully created new section:', sectionId);
        log.debug('Existing sections (active/deleted):', server.state.get('sections').length);

        sendMessage({ id: sectionId });

        return sectionId;
    };

    const _objIsString = (obj) => typeof obj === 'string' || obj instanceof String;

    const _loadSectionState = (app, section, sectionId) => {
        const _loadCache = () =>
            Object.keys(app.states.cache).forEach(name => {
                log.debug('Caching new named state for future use:', name);
                request.post(section.app.url + '/states/' + name, {
                    headers: { 'Content-Type': Constants.HTTP_CONTENT_TYPE_JSON },
                    json: app.states.cache[name]
                }, _handleRequestError);
            });

        const _loadNamed = () => {
            section.app.state = app.states.load;
            log.debug('Loading existing named state:', section.app.state);
        };

        const _load = () => {
            log.debug('Loading state configuration');
            request.post(section.app.url + '/instances/' + sectionId + '/state', {
                headers: { 'Content-Type': Constants.HTTP_CONTENT_TYPE_JSON },
                json: app.states.load
            }, _handleRequestError);
        };

        if (!app.states) return;

        /* istanbul ignore else */
        // DEBUG logging is turned on by default, and only turned off in production deployments.
        // The operation of the Constants.Logging.DEBUG flag has been tested elsewhere.
        if (Constants.Logging.DEBUG) {
            log.debug('Got state configuration for app:', JSON.stringify(app.states));
        }

        // Cache or load states if they were provided as a part of the create request.
        if (app.states.cache) {
            _loadCache();
        }
        if (!app.states.load) return;

        // Either a named state or an in-line state configuration can be loaded.
        _objIsString(app.states.load) ? _loadNamed() : _load();
    };

    // Creates an individual section
    operation.createSection = (req, res) => {
        const sendError = msg => Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: msg }));
        const sendMessage = msg => Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(msg));
        const id = _createSection(req.body, sendError, sendMessage);

        if (!id) return;
        _messagePeers('createSection', { body: req.body });
    };

    // Internal utility function to delete section by a given id. This function is used
    // either to delete all sections belonging to a given space, or to delete a specific
    // section by its id.
    const _deleteSectionById = sectionId => {
        const section = server.state.get('sections[' + sectionId + ']');

        if (section?.app?.url) {
            log.debug('Flushing application at URL:', section.app.url);
            request.post(section.app.url + '/instances/' + sectionId + '/flush', _handleRequestError);
        }
        server.state.get('groups').forEach((e, groupId) => {
            if (!e.includes(parseInt(sectionId, 10))) return;
            // The outcome of this operation is logged within the internal utility method
            if (e.length === 1) {
                _deleteGroupById(groupId);
            } else {
                e.splice(e.indexOf(parseInt(sectionId, 10)), 1);
                server.state.set('groups[' + groupId + ']', e);
            }
        });

        server.state.set('sections[' + sectionId + ']', {});

        _getReadySockets().filter(c => _isInGeometry(c)).forEach(c => c.safeSend(JSON.stringify({
            appId: Constants.APP_NAME,
            message: { action: Constants.Action.DELETE, id: parseInt(sectionId, 10) }
        })));
    };

    const _deleteSections = function (space, groupId, send, empty) {
        send = send || (() => {});
        _messagePeers('deleteSections', { query: { space: space, groupId: groupId } });
        let sections = server.state.get('sections');
        if (groupId || space) {
            const map = groupId ? e => { _deleteSectionById(e); return parseInt(e, 10); }
                : ({ index }) => { _deleteSectionById(index); return parseInt(index, 10); };
            const deletedSections = _filterSections(groupId, space, sections, 'Deleted', map);
            log.info('Successfully deleted sections:', deletedSections);
            send(deletedSections);
        } else {
            // TODO: handle deleting remote sections
            sections.filter(s => s.app?.url).map(s => {
                log.debug('Flushing application at URL:', s.app.url);
                return s.app.url;
            }).filter((s, i, arr) => arr.indexOf(s) === i).forEach(s => request.post(`${s}/instances/flush`, _handleRequestError));

            server.state.set('sections', []);
            server.state.set('groups', []);

            _getReadySockets().filter(c => _isInGeometry(c)).forEach(c => c.safeSend(JSON.stringify({
                appId: Constants.APP_NAME,
                message: { action: Constants.Action.DELETE }
            })));

            log.info('Successfully deleted all sections');
            empty();
        }

        log.debug('Existing sections (active/deleted):', server.state.get('sections').length);
        log.debug('Existing groups (active/deleted):', server.state.get('groups').length);
    };

    // Deletes all sections
    operation.deleteSections = async (req, res) => {
        const space = req.query.space;
        const groupId = req.query.groupId;
        const send = deletedSections => Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ ids: deletedSections }));

        if (space) {
            await ApiUtils.applyPrimaryForSections(space, async (connection, id, elem) => {
                await ApiUtils.del(
                    `${Constants.HTTP_PROTOCOL}${elem.host}/sections/${id}`,
                    { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON }
                );
                await ApiUtils.deleteSecondarySectionWrapper(connection, id, elem);
            });
            log.debug('Deleted replicated sections');
        }

        _deleteSections(space, groupId, send, () => Utils.sendEmptySuccess(res));
    };

    const _filterSections = (groupId, space, sections, action, map) => {
        if (groupId) {
            if (!Utils.isNullOrEmpty(server.state.get(`groups[${groupId}]`))) {
                log.info(`${action} sections of group:`, groupId);
                return server.state.get(`groups[${groupId}]`).slice().map(map || (e => parseInt(e, 10)));
            }
            return [];
        } else if (space) {
            log.info(`${action} sections of space:`, space);
            return ApiUtils
                .filterWithIndex(sections, e => !Utils.isNullOrEmpty(e) && !Utils.isNullOrEmpty(e.spaces[space]))
                .map(map || (({ index }) => index));
        } else {
            return ApiUtils.filterWithIndex(sections, e => !Utils.isNullOrEmpty(e)).map(map || (({ index }) => index));
        }
    };

    const _readSections = (space, groupId, geometry, fetchAppStates, sendResults) => {
        const sections = server.state.get('sections');

        let sectionsToFetch = _filterSections(groupId, space, sections, 'Fetching');

        if (geometry) {
            const g = geometry.split(',');
            const r = { x: g[0], y: g[1], w: g[2], h: g[3] };
            if (g.length !== 4) {
                log.warn('Ignoring invalid geometry:', r);
            } else {
                log.info('Filtering list of sections using geometry:', r);
                sectionsToFetch = sectionsToFetch.filter(i => {
                    const e = sections[i];
                    // Top-Left and Bottom-Right of section should be within the given range.
                    // We make sure that we are using numbers and not strings in our math.
                    return (+e.x >= +r.x && +e.y >= +r.y && (+e.x + (+e.w)) <= (+r.x + (+r.w)) &&
                        (+e.y + (+e.h)) <= (+r.y + (+r.h)));
                });
            }
        }

        let result = [];

        let numSectionsToFetchState = sectionsToFetch.length;

        sectionsToFetch.forEach(i => {
            let s = sections[i];
            let section = { id: i, x: s.x, y: s.y, w: s.w, h: s.h, space: Object.keys(s.spaces)[0] };
            const app = s.app;
            if (app) {
                section.app = { url: app.url, state: app.state, opacity: app.opacity };
            }
            result.push(section);
            const ind = result.length - 1;

            if (app && fetchAppStates) {
                axios.get(s.app.url + '/instances/' + i + '/state', {
                    adapter: require('axios/lib/adapters/http')
                }).then(r => {
                    result[ind].app.states = { load: r.data };
                    numSectionsToFetchState--;
                    if (numSectionsToFetchState === 0) { sendResults(result); }
                }).catch((err) => {
                    log.warn(err);
                    numSectionsToFetchState--;
                    if (numSectionsToFetchState === 0) { sendResults(result); }
                });
            } else if (fetchAppStates) {
                numSectionsToFetchState--;
            }
        });
        log.debug('Successfully read configuration for sections:', sectionsToFetch);
        const r = { result: result, numSectionsToFetchState: numSectionsToFetchState };

        if (!fetchAppStates || r.numSectionsToFetchState === 0) { // also catches case where there are no sections to fetch
            sendResults(r.result);
        }

        return r;
    };

    // Returns details of sections
    operation.readSections = (req, res) => {
        const space = req.query.space;
        const groupId = req.query.groupId;
        const geometry = req.query.geometry;
        const fetchAppStates = ((req.query.includeAppStates + '').toLowerCase() === 'true');
        _readSections(space, groupId, geometry, fetchAppStates, result => Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(result)));
    };

    // Internal utility function to update section by a given id. This function is used
    // either to update all sections belonging to a given group, or to update a specific
    // section by its id.
    const _updateSectionById = (sectionId, space, geometry, app) => {
        let commands = [];
        let oldURL = null;
        let oldOpacity = null;
        let section = server.state.get('sections[' + sectionId + ']');
        if (section.app) {
            oldURL = section.app.url;
            oldOpacity = section.app.opacity;
            log.debug('Deleting existing application configuration');
            delete section.app;
            commands.push({
                appId: Constants.APP_NAME,
                message: { action: Constants.Action.UPDATE, id: parseInt(sectionId, 10) }
            });
        }

        let needsUpdate = false;
        if (space && !Object.keys(section.spaces).includes(space)) {
            log.debug('Changing space name to:', space);
            needsUpdate = true;
        }
        if (geometry.w !== undefined && geometry.w !== section.w) {
            log.debug('Changing space width to:', geometry.w);
            section.w = geometry.w;
            needsUpdate = true;
        }
        if (geometry.h !== undefined && geometry.h !== section.h) {
            log.debug('Changing space height to:', geometry.h);
            section.h = geometry.h;
            needsUpdate = true;
        }

        const spaceName = space || Object.keys(section.spaces)[0];
        if (geometry.x !== undefined && geometry.y !== undefined) {
            const layout = _calculateSectionLayout(spaceName, {
                x: geometry.x, y: geometry.y, w: section.w, h: section.h
            });

            if (!needsUpdate && !Utils.JSON.equals(section.spaces[spaceName], layout)) {
                section.x = geometry.x;
                section.y = geometry.y;
                needsUpdate = true;
            }

            if (needsUpdate) {
                log.debug('Updating spaces configuration of section');
                delete section.spaces;
                section.spaces = {};
                section.spaces[spaceName] = layout;
                commands.push({ appId: Constants.APP_NAME, message: { action: Constants.Action.UPDATE, id: parseInt(sectionId, 10), spaces: section.spaces } });
            }
        }

        if (app) {
            const url = app.url.replace(/\/$/, '');
            needsUpdate = needsUpdate || (url !== oldURL);

            if (oldURL && (url !== oldURL)) {
                log.debug('Flushing application at URL:', oldURL);
                request.post(oldURL + '/instances/' + sectionId + '/flush', _handleRequestError);
            }

            section.app = { 'url': url };
            log.debug('Got URL for app:', url);

            if (app.states) {
                /* istanbul ignore else */
                // DEBUG logging is turned on by default, and only turned off in production deployments.
                // The operation of the Constants.Logging.DEBUG flag has been tested elsewhere.
                if (Constants.Logging.DEBUG) {
                    log.debug('Got state configuration for app:', JSON.stringify(app.states));
                }
                // Cache or load states if they were provided as a part of the update request.
                if (app.states.cache) {
                    Object.keys(app.states.cache).forEach(name => {
                        log.debug('Caching new named state for future use:', name);
                        request.post(section.app.url + '/states/' + name, {
                            headers: { 'Content-Type': Constants.HTTP_CONTENT_TYPE_JSON },
                            json: app.states.cache[name]
                        }, _handleRequestError);
                    });
                    needsUpdate = true;
                }
                if (app.states.load) {
                    // Either a named state or an in-line state configuration can be loaded.
                    if (typeof app.states.load === 'string' || app.states.load instanceof String) {
                        section.app.state = app.states.load;
                        log.debug('Loading existing named state:', section.app.state);
                    } else {
                        log.debug('Loading state configuration');
                        request.post(section.app.url + '/instances/' + sectionId + '/state', {
                            headers: { 'Content-Type': Constants.HTTP_CONTENT_TYPE_JSON },
                            json: app.states.load
                        }, _handleRequestError);
                    }
                    needsUpdate = true;
                }
            }
            const opacity = app.opacity;
            if (opacity) {
                log.debug('Setting opacity for app:', opacity);
                section.app.opacity = opacity;
                if (oldOpacity !== opacity && !needsUpdate) {
                    needsUpdate = true;
                }
            }
            // If nothing changed, there is no point in making an update.
            if (needsUpdate) {
                let $app = { 'url': section.app.url };
                if (opacity) {
                    $app.opacity = opacity;
                }
                commands.push({ appId: Constants.APP_NAME, message: { action: Constants.Action.UPDATE, id: parseInt(sectionId, 10), app: $app } });
            } else {
                // There is no need to check if the old url was set, because, if it was not, needsUpdate would be true anyway.
                // Removes the first update command.
                commands.shift();
            }
        } else if (oldURL) {
            log.debug('Flushing application at URL:', oldURL);
            request.post(oldURL + '/instances/' + sectionId + '/flush', _handleRequestError);
        }

        // Notify OVE viewers/controllers
        _getReadySockets().forEach(c => {
            commands.filter(m => _isInGeometry(c, m.message.spaces)).forEach(m => c.safeSend(JSON.stringify(m)));
        });

        server.state.set('sections[' + sectionId + ']', section);
    };

    // Internal utility function to transform or move all or some sections.
    const _updateSections = (operation, space, groupId, res) => {
        if (!((operation.moveTo && operation.moveTo.space) ||
        (operation.transform && (operation.transform.scale || operation.transform.translate)))) {
            // An attempt to do something we don't understand
            _sendError(res, 'invalid operation', `Invalid Operation: request: ${JSON.stringify(operation)}`);
            return;
        } else if (operation.moveTo && operation.moveTo.space && !server.spaces[operation.moveTo.space]) {
            _sendError(res, 'invalid space', `Invalid Space: request: ${JSON.stringify(operation)}`);
            return;
        } else if (operation.transform) {
            if (operation.transform.scale && (operation.transform.scale.x === undefined || operation.transform.scale.y === undefined)) {
                _sendError(res, 'invalid dimensions', `Invalid Dimensions for Scale Operation: request: ${JSON.stringify(operation)}`);
                return;
            } else if (operation.transform.translate && (operation.transform.translate.x === undefined || operation.transform.translate.y === undefined)) {
                _sendError(res, 'invalid dimensions', `Invalid Dimensions for Translate Operation: request: ${JSON.stringify(operation)}`);
                return;
            }
        }

        const sections = server.state.get('sections');
        let sectionsToUpdate = _filterSections(groupId, space, sections, 'Updating');

        // Check whether any operation has to be made.
        if (Utils.isNullOrEmpty(sectionsToUpdate)) {
            Utils.sendEmptySuccess(res);
            return;
        }

        let rangeError = false;
        let geometries = {};

        sectionsToUpdate.forEach(e => {
            const section = sections[e];
            geometries[e] = { x: section.x, y: section.y, w: section.w, h: section.h };
            let space;

            if (operation.moveTo && operation.moveTo.space) {
                space = operation.moveTo.space;
            } else {
                space = Object.keys(section.spaces)[0];
            }

            const bounds = _getSpaceGeometries()[space];

            if (operation.transform) {
                if (operation.transform.scale) {
                    geometries[e].w = (geometries[e].w * operation.transform.scale.x) << 0;
                    geometries[e].h = (geometries[e].h * operation.transform.scale.y) << 0;
                }
                if (operation.transform.translate) {
                    geometries[e].x = (geometries[e].x + operation.transform.translate.x) << 0;
                    geometries[e].y = (geometries[e].y + operation.transform.translate.y) << 0;
                }
            }

            if (geometries[e].x < 0 || geometries[e].y < 0 || Math.max(geometries[e].x, geometries[e].w) > bounds.w || Math.max(geometries[e].y, geometries[e].h) > bounds.h) {
                log.error('Section no longer fits within space after transformation for section id:', e, 'space:', space, 'geometry:', JSON.stringify(geometries[e]));
                rangeError = true;
            }
        });

        if (rangeError) {
            log.error('Unable to update sections due to one or more range errors');
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));
            return;
        }

        sectionsToUpdate.forEach(e => {
            const section = sections[e];
            let space;
            if (operation.moveTo && operation.moveTo.space) {
                space = operation.moveTo.space;
            }
            _updateSectionById(e, space, geometries[e], section.app);
        });

        if (sectionsToUpdate.length === server.state.get('sections').length) {
            log.info('Successfully updated all sections');
        } else {
            log.info('Successfully updated sections:', sectionsToUpdate);
        }

        Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ ids: sectionsToUpdate }));
    };

    // Transforms sections
    operation.transformSections = (req, res) => {
        const space = req.query.space;
        const groupId = req.query.groupId;

        _messagePeers('transformSections', { body: req.body, query: { space: space, groupId: groupId } });
        _updateSections({ transform: req.body }, space, groupId, res);
    };

    // Moves sections to another space
    operation.moveSectionsTo = async (req, res) => {
        const space = req.query.space;
        const groupId = req.query.groupId;

        if (space && ApiUtils.isConnected(ApiUtils.getDefaultElem(space))) {
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'Operation unavailable as space is currently connected' }));
            return;
        }

        _messagePeers('moveSectionsTo', { body: req.body, query: { space: space, groupId: groupId } });
        _updateSections({ moveTo: req.body }, space, groupId, res);
    };

    // Internal utility function to refresh a section by the given id.
    const _refreshSectionById = (sectionId) =>
        _getReadySockets().forEach(c => c.safeSend(JSON.stringify({
            operation: Constants.Operation.REFRESH,
            sectionId: parseInt(sectionId, 10)
        })));

    // Refreshes individual section
    operation.refreshSectionById = (req, res) => {
        let sectionId = req.params.id;

        if (Utils.isNullOrEmpty(server.state.get('sections[' + sectionId + ']'))) {
            log.error('Invalid Section Id:', sectionId);
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid section id' }));
            return;
        }

        _messagePeers('refreshSectionById', { params: { id: sectionId } });
        _refreshSectionById(sectionId);

        ApiUtils.applyPrimaryForSections(ApiUtils.getSpaceBySectionId(sectionId), async (connection, id, elem) => {
            await ApiUtils.post(
                `${Constants.HTTP_PROTOCOL}${elem.host}/sections/${id}/refresh`,
                { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON }
            );
        }).then(log.debug('Successfully refreshed replicated sections'));

        log.info('Successfully refreshed section:', sectionId);

        Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ ids: [parseInt(sectionId, 10)] }));
    };

    const _refreshSections = (space, groupId, sendEmpty) => {
        let sectionsToRefresh = [];

        if (groupId) {
            if (!Utils.isNullOrEmpty(server.state.get('groups[' + groupId + ']'))) {
                log.info('Refreshing sections of group:', groupId);
                sectionsToRefresh = server.state.get('groups[' + groupId + ']').slice().map(e => parseInt(e, 10));
            }
        } else if (space) {
            log.info('Refreshing sections of space:', space);
            sectionsToRefresh = ApiUtils
                .filterWithIndex(server.state.get('sections'),
                    e => !Utils.isNullOrEmpty(e) && !Utils.isNullOrEmpty(e.spaces[space]))
                .map(({ index }) => parseInt(index, 10));
        } else {
            _getReadySockets().forEach(c => c.safeSend(JSON.stringify({ operation: Constants.Operation.REFRESH })));
            log.info('Successfully refreshed all sections');
            sendEmpty();
            return;
        }

        sectionsToRefresh.forEach(_refreshSectionById);
        return sectionsToRefresh;
    };

    const _getReadySockets = () => ApiUtils.setToArray(server.wss.clients).filter(c => c.readyState === Constants.WEBSOCKET_READY);

    // Refreshes all sections
    operation.refreshSections = (req, res) => {
        const space = req.query.space;
        const groupId = req.query.groupId;
        const sendError = () => Utils.sendEmptySuccess(res);
        _messagePeers('refreshSections', { query: { space: space, groupId: groupId } });
        const sectionsToRefresh = _refreshSections(space, groupId, sendError);

        if (space) {
            ApiUtils.applyPrimary(space, async (connection, s) => {
                let query = '';

                if (space && groupId) {
                    query = `?groupId=${groupId}&space=${space}`;
                } else if (space) {
                    query = `?space=${space}`;
                } else if (groupId) {
                    query = `?groupId=${groupId}`;
                }

                await ApiUtils.post(
                    `${Constants.HTTP_PROTOCOL}${s.host}/sections/refresh${query}`,
                    { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON }
                );
            }).then(log.debug('Successfully refreshed replicated sections'));
        }

        log.info('Successfully refreshed sections:', sectionsToRefresh);
        Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ ids: sectionsToRefresh }));
    };

    // Fetches details of an individual section
    operation.readSectionById = (req, res) => {
        let sectionId = req.params.id;
        let s = server.state.get('sections[' + sectionId + ']');
        const fetchAppStates = ((req.query.includeAppStates + '').toLowerCase() === 'true');

        const sendResults = () => Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(section));

        if (Utils.isNullOrEmpty(s)) {
            log.debug('Unable to read configuration for section id:', sectionId);
            Utils.sendEmptySuccess(res);
            return;
        }

        const id = parseInt(sectionId, 10);
        let section = { id, x: s.x, y: s.y, w: s.w, h: s.h, space: Object.keys(s.spaces)[0] };
        const app = s.app;
        if (app) {
            section.app = { url: app.url, state: app.state, opacity: app.opacity };

            if (fetchAppStates) {
                axios.get(s.app.url + '/instances/' + id + '/state', {
                    adapter: require('axios/lib/adapters/http')
                }).then(r => {
                    section.app.states = { load: r.data };
                    sendResults();
                }).catch((err) => {
                    log.warn(err);
                    sendResults();
                });
            }
        }
        log.debug('Successfully read configuration for section id:', sectionId);

        if (!fetchAppStates || !app) {
            sendResults();
        }
    };

    // Updates an app associated with a section
    operation.updateSectionById = (req, res) => {
        let sectionId = req.params.id;
        if (!(req.body.space || req.body.app || req.body.x || req.body.y || req.body.w || req.body.h)) {
            // An attempt to do something we don't understand
            _sendError(res, 'invalid operation', `Invalid Operation: request: ${JSON.stringify(req.body)}`);
            return;
        } else if (Utils.isNullOrEmpty(server.state.get('sections[' + sectionId + ']'))) {
            _sendError(res, 'invalid section id', `Invalid Section Id: ${sectionId}`);
            return;
        } else if (req.body.app && !req.body.app.url) {
            _sendError(res, 'invalid app configuration', `Invalid App Configuration: request: ${JSON.stringify(req.body.app)}`);
            return;
        } else if (req.body.space && !server.spaces[req.body.space]) {
            _sendError(res, 'invalid space', `Invalid Space: request: ${JSON.stringify(req.body)}`);
            return;
        } else if ((req.body.space || req.body.w !== undefined || req.body.h !== undefined) && (req.body.x === undefined || req.body.y === undefined)) {
            // specifically testing for undefined since '0' is a valid input.
            // x and y positions must be provided if the space, w or h has changed.
            _sendError(res, 'invalid dimensions', `Both x and y positions are required to change space, height or width. Request: ${JSON.stringify(req.body)}`);
            return;
        } else if ((req.body.x !== undefined && req.body.y === undefined) || (req.body.y !== undefined && req.body.x === undefined)) {
            // specifically testing for undefined since '0' is a valid input.
            // x and y positions must be provided together
            _sendError(res, 'invalid dimensions', `Both x and y positions are required for a resize operation. Request: ${JSON.stringify(req.body)}`);
            return;
        } else if (ApiUtils.isSecondary(req.body.space)) {
            _sendError(res, `Operation unavailable as space is connected as a replica. Space: ${req.body.space}`);
            return;
        }

        _messagePeers('updateSectionById', { body: req.body, params: { id: sectionId } });
        const geometry = { x: req.body.x, y: req.body.y, w: req.body.w, h: req.body.h };
        _updateSectionById(sectionId, req.body.space, geometry, req.body.app);

        ApiUtils.applyPrimaryForSections(req.body.space, async (connection, id, elem) => {
            await ApiUtils.post(
                `${Constants.HTTP_PROTOCOL}${elem.host}/sections/${id}`,
                { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                { ...req.body, space: elem.space }
            );
        }).then(log.debug('Successfully updated replicas'));

        log.info('Successfully updated section:', sectionId);
        Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ id: parseInt(sectionId, 10) }));
    };

    // Deletes an individual section
    operation.deleteSectionById = (req, res) => {
        let sectionId = req.params.id;
        if (Utils.isNullOrEmpty(server.state.get('sections[' + sectionId + ']'))) {
            log.error('Invalid Section Id:', sectionId);
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid section id' }));
        } else if (ApiUtils.isSecondary(ApiUtils.getSpaceBySectionId(sectionId))) {
            log.error('Operation unavailable as space is connected as a replica');
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'Operation unavailable as space is connected as a replica' }));
        } else {
            _messagePeers('deleteSectionById', { params: { id: sectionId } });

            ApiUtils.applyPrimaryForSections(ApiUtils.getSpaceBySectionId(sectionId), async (connection, id, elem) => {
                await ApiUtils.del(
                    `${Constants.HTTP_PROTOCOL}${elem.host}/sections/${id}`,
                    { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON }
                );
            }).then(log.debug('Successfully deleted replicated sections'));

            _deleteSectionById(sectionId);

            log.info('Successfully deleted section:', sectionId);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ ids: [parseInt(sectionId, 10)] }));
        }
    };

    operation.readGroups = (req, res) => {
        let result = server.state.get('groups').filter(e => !Utils.isNullOrEmpty(e));

        log.debug('Successfully read configuration for all groups');
        Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(result));
    };

    // Internal utility function to create or update a group
    const _createOrUpdateGroup = (groupId, operation, req, res) => {
        const validateSections = group => {
            const sections = server.state.get('sections');
            return !group.some(e => Utils.isNullOrEmpty(sections[e]) ||
                ApiUtils.isSecondary(ApiUtils.getDefaultElem(ApiUtils.getSpaceForSection(sections[e]))));
        };

        if (!req.body || !req.body.length || !validateSections(req.body)) {
            log.error('Invalid Group', 'request:', JSON.stringify(req.body));
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid group' }));
        } else {
            server.state.set('groups[' + groupId + ']', req.body.slice());
            log.info('Successfully ' + operation + 'd group:', groupId);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ id: parseInt(groupId, 10) }));
        }
    };

    // Creates an individual group
    operation.createGroup = (req, res) => {
        _messagePeers('createGroup', { body: req.body });
        _createOrUpdateGroup(server.state.get('groups').length, 'create', req, res);
    };

    // Fetches details of an individual group
    operation.readGroupById = (req, res) => {
        let groupId = req.params.id;

        if (Utils.isNullOrEmpty(server.state.get('groups[' + groupId + ']'))) {
            log.error('Invalid Group Id:', groupId);
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid group id' }));
        } else {
            log.debug('Successfully read configuration for group id:', groupId);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(server.state.get('groups[' + groupId + ']')));
        }
    };

    // Updates an individual group
    operation.updateGroupById = (req, res) => {
        let groupId = req.params.id;

        _messagePeers('updateGroupById', { body: req.body, params: { id: groupId } });
        _createOrUpdateGroup(groupId, 'update', req, res);
    };

    // Internal utility function to delete a group by the given id
    const _deleteGroupById = groupId => {
        server.state.set('groups[' + groupId + ']', []);

        if (server.state.get('groups').some(e => !Utils.isNullOrEmpty(e))) {
            log.info('Successfully deleted group:', groupId);
        } else {
            server.state.set('groups', []);
            log.info('Successfully deleted all groups');
        }
    };

    // Deletes an individual group. If there are no more non-empty groups at the end of this
    // operation, it will reset all groups on the server.
    operation.deleteGroupById = (req, res) => {
        let groupId = req.params.id;
        if (Utils.isNullOrEmpty(server.state.get('groups[' + groupId + ']'))) {
            log.error('Invalid Group Id:', groupId);
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid group id' }));
        } else {
            _messagePeers('deleteGroupById', { params: { id: groupId } });
            _deleteGroupById(groupId);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ id: parseInt(groupId, 10) }));
        }
    };

    operation.isSecondary = (req, res) => Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ isSecondary: ApiUtils.isSecondary(req.body) }));

    operation.isPrimary = (req, res) => Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ isPrimary: ApiUtils.isPrimary(req.body) }));

    operation.isConnected = (req, res) => Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ isConnected: ApiUtils.isConnected(req.body) }));

    operation.getConnection = (req, res) =>
        Utils.sendMessage(res, HttpStatus.OK,
            JSON.stringify({ connection: ApiUtils.getConnection(req.body) }));

    operation.updateConnectionState = (req, res) => {
        ApiUtils.updateConnectionState(req.body);
        Utils.sendEmptySuccess(res);
    };

    operation.updateConnection = (req, res) => {
        if (req.body.host && req.body.host !== process.env.OVE_HOST) {
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: `Expected host: ${process.env.OVE_HOST}, received host: ${req.body.host}` }));
            return;
        }

        Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ connection: ApiUtils.updateConnection(req.body.host ? req.body.connection : req.body) }));
    };

    operation.removeConnection = (req, res) => {
        ApiUtils.removeConnection(req.body);
        Utils.sendEmptySuccess(res);
    };

    operation.deleteSpace = (req, res) =>
        Utils.sendMessage(res, HttpStatus.OK,
            JSON.stringify(ApiUtils.deleteSpace(ApiUtils.getConnection(req.body.primary), req.body.elem)));

    operation.deleteAllForSpace = (req, res) => {
        ApiUtils.deleteAllForSpace(req.body.primary, req.body.elem);
        Utils.sendEmptySuccess(res);
    };

    operation.getURLForId = (req, res) => Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ url: ApiUtils.getURLForId(req.params.id) }));

    operation.deleteSecondarySection = (req, res) => {
        ApiUtils.deleteSecondarySection(ApiUtils.getConnection(req.body.primary), req.params.id, req.body.elem);
        Utils.sendEmptySuccess(res);
    };

    server.app.get('/spaces', operation.listSpaces);
    server.app.get('/spaces/:name/geometry', operation.getSpaceGeometry);
    server.app.get('/sections', operation.readSections);
    server.app.delete('/sections', operation.deleteSections);
    server.app.post('/section', operation.createSection);
    server.app.get('/sections/:id([0-9]+)', operation.readSectionById);
    server.app.post('/sections/:id([0-9]+)', operation.updateSectionById);
    server.app.delete('/sections/:id([0-9]+)', operation.deleteSectionById);
    server.app.post('/sections/refresh', operation.refreshSections);
    server.app.post('/sections/:id([0-9]+)/refresh', operation.refreshSectionById);
    server.app.post('/sections/transform', operation.transformSections);
    server.app.post('/sections/moveTo', operation.moveSectionsTo);
    server.app.get('/groups', operation.readGroups);
    server.app.post('/group', operation.createGroup);
    server.app.get('/groups/:id([0-9]+)', operation.readGroupById);
    server.app.post('/groups/:id([0-9]+)', operation.updateGroupById);
    server.app.delete('/groups/:id([0-9]+)', operation.deleteGroupById);

    server.app.get('/api/isSecondary', operation.isSecondary);
    server.app.get('/api/isPrimary', operation.isPrimary);
    server.app.get('/api/isConnected', operation.isConnected);
    server.app.get('/api/getConnection', operation.getConnection);
    server.app.post('/api/updateConnectionState', operation.updateConnectionState);
    server.app.post('/api/updateConnection', operation.updateConnection);
    server.app.delete('/api/removeConnection', operation.removeConnection);
    server.app.delete('/api/deleteSpace', operation.deleteSpace);
    server.app.delete('/api/deleteAllForSpace', operation.deleteAllForSpace);
    server.app.get('/api/getURLForId/:id([0-9]+)', operation.getURLForId);
    server.app.delete('/api/deleteSecondarySection/:id([0-9]+)', operation.deleteSecondarySection);

    server.app.get('/connections', operation.listConnections);
    server.app.delete('/connections', operation.deleteConnections);
    server.app.post('/connection/:primary/:secondary', operation.createConnection);
    server.app.get('/connections/section/:id([0-9]+)', operation.getSectionConnection);
    server.app.delete('/connection/:primary', operation.deleteConnection);
    server.app.delete('/connection/:primary/:secondary', operation.deleteConnection);

    server.app.post('/event/:id([0-9]+)', operation.onEvent);
    server.app.post('/distribute/event/:id([0-9]+)', operation.distributeEvent);
    server.app.post('/cache/:id([0-9]+)', operation.cache);

    // Swagger API documentation
    Utils.buildAPIDocs(path.join(__dirname, 'swagger.yaml'), path.join(__dirname, '..', '..', 'package.json'));
};
