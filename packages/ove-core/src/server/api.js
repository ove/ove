const path = require('path');
const HttpStatus = require('http-status-codes');

module.exports = (server, log, Utils, Constants, ApiUtils) => {
    const operation = {};
    const Backing = require('./api-backing')(server, operation, log, Utils, Constants, ApiUtils);

    // send error message with a http bad request
    const _sendError = (res, msg, logging) => {
        log.error(logging || msg);
        Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: msg }));
    };

    // Lists details of all spaces, and accepts filters as a part of its query string.
    operation.listSpaces = (req, res) => {
        log.debug('Listing Spaces');
        const sectionId = req.query.oveSectionId;
        const spaces = Backing.listSpaces(sectionId);

        if (spaces) {
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(spaces));
        } else {
            log.debug(`Unable to produce list of spaces${sectionId ? ` for section id: ${sectionId}` : ''}`);
            Utils.sendEmptySuccess(res);
        }
    };

    operation.listConnections = (req, res) => {
        log.debug('Listing Connections');
        const connections = Backing.listConnections(req.query.space);
        Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(connections || { msg: `No connections for space: ${req.query.space}` }));
    };

    // Gets geometry of a named space.
    operation.getSpaceGeometry = (req, res) => {
        const space = req.params.name;
        const geometry = Backing.getSpaceGeometries()[space];

        if (Utils.isNullOrEmpty(geometry)) {
            _sendError(res, `Invalid Space: ${space}`);
        } else {
            log.debug('Returning geometry for space:', space);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(geometry));
        }
    };

    // handler for details api call, including errors
    operation.getSectionConnection = (req, res) => {
        log.debug('Getting Section Connection');

        if (req.body.protocol && !req.body.host) {
            _sendError(res, `No host provided, only protocol`);
            return;
        } else if (req.body.host && !req.query.space) {
            _sendError(res, `Space must be specified`);
            return;
        }

        const id = Number(req.params.id);
        const space = req.query.space || ApiUtils.getSpaceBySectionId(id);
        const elem = req.body.host ? { space: space, host: req.body.host, protocol: req.body.protocol || req.protocol }
            : ApiUtils.getDefaultElem(space);
        const mapping = Backing.getSectionConnection(id, elem);

        mapping ? Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ section: mapping }))
            : _sendError(res, `Section ${id} is not connected`);
    };

    operation.deleteConnection = async (req, res) => {
        log.debug('Deleting Connection');
        const spaces = { primary: req.params.primary, secondary: req.params.secondary };

        const primary = { space: spaces.primary, host: req.body?.primary || process.env.OVE_HOST, protocol: `${req.protocol}://` };
        const secondary = spaces.secondary ? { space: spaces.secondary, host: req.body?.secondary || process.env.OVE_HOST, protocol: `${req.body.protocol || req.protocol}://` } : undefined;

        (await Backing.deleteConnection(primary, secondary)) ? Utils.sendEmptySuccess(res)
            : _sendError(res, `No connection for space: ${spaces.secondary || spaces.primary}`);
    };

    operation.cache = async (req, res) => {
        const id = Number(req.params.id);

        if (!ApiUtils.isValidSectionId(id)) {
            _sendError(res, `No section found for id: ${id}`);
            return;
        }

        await Backing.cache(id, req.body);
        Utils.sendEmptySuccess(res);
    };

    operation.deleteConnections = async (req, res) => {
        await ApiUtils.clearConnectionsWrapper();
        Utils.sendEmptySuccess(res);
    };

    // http request handler, calling backing method. Includes error handling.
    // expecting primary and secondary as url query parameters.
    operation.createConnection = async (req, res) => {
        const sendError = msg => _sendError(res, msg);

        if (req.body.primary && req.body.primary !== process.env.OVE_HOST) {
            sendError(`Expected primary host: ${process.env.OVE_HOST}, received: ${req.body.primary}`);
            return;
        } else if ((req.body.primary && !req.body.secondary) || (req.body.secondary && !req.body.primary)) {
            sendError(`Expected two hosts, only received one`);
            return;
        } else if (req.body.primary && !req.body.protocol) {
            sendError('No protocol for the secondary host has been provided');
            return;
        }

        const primary = { space: req.params.primary, host: req.body.primary || process.env.OVE_HOST, protocol: `${req.protocol}://` };
        const secondary = { space: req.params.secondary, host: req.body.secondary || process.env.OVE_HOST, protocol: `${req.body.protocol || req.protocol}://` };

        if (ApiUtils.elemEquals(primary, secondary)) {
            _sendError(res, `Primary and secondary spaces are the same`);
            return;
        } else if ((await ApiUtils.isSecondaryWrapper(primary)) || (await ApiUtils.isConnectedWrapper(secondary))) {
            _sendError(res, `Could not connect ${primary.space} and ${secondary.space} as there is an existing connection`);
            return;
        }

        const sections = await Backing.createConnection(primary, secondary, req.body.url);
        sections ? Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ ids: sections }))
            : _sendError(res, `Error creating connection between spaces ${primary.space} and ${secondary.space}`);
    };

    operation.onEvent = (req, res) => {
        const id = Number(req.params.id);

        if (!ApiUtils.isValidSectionId(id)) {
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: `No section found for id: ${id}` }));
            return;
        }

        Backing.onEvent(id, req.body);
        Utils.sendEmptySuccess(res);
    };

    operation.distributeEvent = (req, res) => {
        const elem = req.body.elem;
        const id = Number(req.params.id);

        if (elem.host !== process.env.OVE_HOST) {
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: `Expected host: ${process.env.OVE_HOST}, received host: ${elem.host}` }));
            return;
        }

        Backing.distributeEvent(id, req.body);
        Utils.sendEmptySuccess(res);
    };

    operation.createSection = async (req, res) => {
        log.debug(`Creating section: ${JSON.stringify(req.body)} on server: ${process.env.OVE_HOST}`);
        const body = req.body;

        if (body.space && (await ApiUtils.isSecondaryWrapper(ApiUtils.getDefaultElem(body.space)) && !req.query.override)) {
            _sendError(res, `Operation unavailable as space is connected as a replica. Space: ${body.space}`);
            return;
        } else if (!body.space || !server.spaces[body.space]) {
            _sendError(res, 'Invalid Space', `Invalid Space for Request: ${JSON.stringify(body)}`);
            return;
        } else if (body.w === undefined || body.h === undefined || body.x === undefined || body.y === undefined) {
            // specifically testing for undefined since '0' is a valid input.
            _sendError(res, 'Invalid Dimensions', `Invalid Dimensions for Request: ${JSON.stringify(body)}`);
            return;
        } else if (body.app && !body.app.url) {
            _sendError(res, 'Invalid App Configuration', `Invalid App Configuration for Request: ${JSON.stringify(body.app)}`);
            return;
        }

        const id = await Backing.createSection(body);
        Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ id: id }));
    };

    operation.deleteSections = async (req, res) => {
        const space = req.query.space;
        const groupId = req.query.groupId;

        if (space && await ApiUtils.isSecondaryWrapper(ApiUtils.getDefaultElem(space)) && !req.query.override) {
            _sendError(res, `Operation unavailable as space is connected as a replica. Space: ${space}`);
            return;
        }

        const sections = await Backing.deleteSections(space, groupId);

        log.debug('Existing sections (active/deleted):', server.state.get('sections').length);
        log.debug('Existing groups (active/deleted):', server.state.get('groups').length);
        sections ? Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ ids: sections })) : Utils.sendEmptySuccess(res);
    };

    // Returns details of sections
    operation.readSections = async (req, res) => {
        const space = req.query.space;
        const groupId = req.query.groupId;
        const geometry = req.query.geometry;
        const fetchAppStates = ((req.query.includeAppStates + '').toLowerCase() === 'true');
        const result = (await Backing.readSections(space, groupId, geometry, fetchAppStates)).result;
        Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(result));
    };

    // Transforms sections
    operation.transformSections = (req, res) => {
        const space = req.query.space;
        const groupId = req.query.groupId;
        const op = { transform: req.body };
        const sections = server.state.get('sections');

        if (!(op.transform.scale || op.transform.translate)) {
            // An attempt to do something we don't understand
            _sendError(res, `Invalid Operation: ${JSON.stringify(op)}`);
            return;
        } else if (op.transform.scale && (op.transform.scale.x === undefined || op.transform.scale.y === undefined)) {
            _sendError(res, `Invalid Dimensions for Scale Operation: ${JSON.stringify(op.transform)}`);
            return;
        } else if (op.transform.translate && (op.transform.translate.x === undefined || op.transform.translate.y === undefined)) {
            _sendError(res, `Invalid Dimensions for Translate Operation: ${JSON.stringify(op.transform)}`);
            return;
        } else if (Utils.isNullOrEmpty(Backing.filterSections(groupId, space, sections, 'Updating'))) {
            // We check whether any operation has to be made.
            Utils.sendEmptySuccess(res);
            return;
        } else if (space && ApiUtils.isSecondary(ApiUtils.getDefaultElem(space)) && !req.query.override) {
            _sendError(res, 'Operation unavailable as space is currently connected as a replica');
            return;
        }

        const ids = Backing.updateSections({ transform: req.body }, space, groupId, req.body, sections);
        ids ? Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ ids: ids }))
            : _sendError(res, 'Invalid Dimensions. Unable to update sections due to one or more range errors');
    };

    // Moves sections to another space
    operation.moveSectionsTo = async (req, res) => {
        const space = req.query.space;
        const op = { moveTo: req.body };
        const groupId = req.query.groupId;

        if (!op.moveTo.space) {
            // An attempt to do something we don't understand
            _sendError(res, `Invalid Operation: ${JSON.stringify(op)}`);
            return;
        } else if (op.moveTo.space && !server.spaces[op.moveTo.space]) {
            _sendError(res, `Invalid Space: ${JSON.stringify(op)}`);
            return;
        } else if (Utils.isNullOrEmpty(Backing.filterSections(groupId, space, server.state.get('sections'), 'Updating'))) {
            // We check whether any operation has to be made.
            Utils.sendEmptySuccess(res);
            return;
        } else if (space && ApiUtils.isConnected(ApiUtils.getDefaultElem(space)) && !req.query.override) {
            _sendError(res, 'Operation unavailable as space is currently connected');
            return;
        }

        const ids = Backing.updateSections({ moveTo: req.body }, space, groupId, req.body, server.state.get('sections'));
        ids ? Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ ids: ids }))
            : _sendError(res, 'Invalid Dimensions. Unable to update sections due to one or more range errors');
    };

    // Refreshes individual section
    operation.refreshSectionById = (req, res) => {
        let sectionId = req.params.id;

        if (Utils.isNullOrEmpty(server.state.get('sections[' + sectionId + ']'))) {
            log.error('Invalid Section Id:', sectionId);
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid section id' }));
            return;
        }

        Backing.refreshSectionById(sectionId);
        log.info('Successfully refreshed section:', sectionId);

        Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ ids: [parseInt(sectionId, 10)] }));
    };

    // Refreshes all sections
    operation.refreshSections = (req, res) => {
        const space = req.query.space;
        const groupId = req.query.groupId;
        const sectionsToRefresh = Backing.refreshSections(space, groupId);

        if (sectionsToRefresh) {
            log.info('Successfully refreshed sections:', sectionsToRefresh);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ ids: sectionsToRefresh }));
        } else {
            Utils.sendEmptySuccess(res);
        }
    };

    // Fetches details of an individual section
    operation.readSectionById = async (req, res) => {
        let sectionId = req.params.id;
        let s = server.state.get('sections[' + sectionId + ']');

        if (Utils.isNullOrEmpty(s)) {
            log.debug('Unable to read configuration for section id:', sectionId);
            Utils.sendEmptySuccess(res);
            return;
        }

        const section = await Backing.readSectionById(sectionId, s, req.query.includeAppStates);
        Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(section));
    };

    // Updates an app associated with a section
    operation.updateSectionById = async (req, res) => {
        let sectionId = req.params.id;

        if (!(req.body.space || req.body.app || req.body.x || req.body.y || req.body.w || req.body.h)) {
            // An attempt to do something we don't understand
            _sendError(res, 'Invalid Operation', `Invalid Operation for Request: ${JSON.stringify(req.body)}`);
            return;
        } else if (Utils.isNullOrEmpty(server.state.get('sections[' + sectionId + ']'))) {
            _sendError(res, `Invalid Section Id: ${sectionId}`);
            return;
        } else if (req.body.app && !req.body.app.url) {
            _sendError(res, 'Invalid App Configuration', `Invalid App Configuration for Request: ${JSON.stringify(req.body.app)}`);
            return;
        } else if (req.body.space && !server.spaces[req.body.space]) {
            _sendError(res, 'Invalid Space', `Invalid Space for Request: ${JSON.stringify(req.body)}`);
            return;
        } else if ((req.body.space || req.body.w !== undefined || req.body.h !== undefined) && (req.body.x === undefined || req.body.y === undefined)) {
            // specifically testing for undefined since '0' is a valid input.
            // x and y positions must be provided if the space, w or h has changed.
            _sendError(res, 'Invalid Dimensions', `Invalid Dimensions. Both x and y positions are required to change space, height or width. Request: ${JSON.stringify(req.body)}`);
            return;
        } else if ((req.body.x !== undefined && req.body.y === undefined) || (req.body.y !== undefined && req.body.x === undefined)) {
            // specifically testing for undefined since '0' is a valid input.
            // x and y positions must be provided together
            _sendError(res, 'Invalid Dimensions', `Invalid Dimensions. Both x and y positions are required for a resize operation. Request: ${JSON.stringify(req.body)}`);
            return;
        } else if (ApiUtils.isSecondary(ApiUtils.getDefaultElem(req.body.space)) && !req.query.override) {
            _sendError(res, `Operation unavailable as space is connected as a replica. Space: ${req.body.space}`);
            return;
        }

        Backing.updateSectionById(sectionId, req.body);

        log.info('Successfully updated section:', sectionId);
        Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ id: parseInt(sectionId, 10) }));
    };

    // Deletes an individual section
    operation.deleteSectionById = async (req, res) => {
        let sectionId = req.params.id;

        if (Utils.isNullOrEmpty(server.state.get('sections[' + sectionId + ']'))) {
            _sendError(res, `Invalid Section Id: ${sectionId}`);
            return;
        } else if (ApiUtils.isSecondary(ApiUtils.getDefaultElem(ApiUtils.getSpaceBySectionId(Number(sectionId)))) && !req.query.override) {
            _sendError(res, `Operation unavailable as space is connected as a replica. Space: ${ApiUtils.getSpaceBySectionId(sectionId)}`);
            return;
        }

        Backing.deleteSectionById(Number(sectionId));

        log.info('Successfully deleted section:', sectionId);
        Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ ids: [parseInt(sectionId, 10)] }));
    };

    operation.readGroups = (req, res) => {
        let result = server.state.get('groups').filter(e => !Utils.isNullOrEmpty(e));

        log.debug('Successfully read configuration for all groups');
        Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(result));
    };

    // Creates an individual group
    operation.createGroup = (req, res) => {
        const groupId = server.state.get('groups').length;

        if (!req.body || !req.body.length || !Backing.validateSections(req.body)) {
            _sendError(res, 'Invalid Group', `Invalid Group for Request: ${JSON.stringify(req.body)}`);
            return;
        }

        Backing.createOrUpdateGroup(groupId, 'create', req.body);
        Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ id: parseInt(groupId, 10) }));
    };

    // Fetches details of an individual group
    operation.readGroupById = (req, res) => {
        let groupId = req.params.id;

        if (Utils.isNullOrEmpty(server.state.get('groups[' + groupId + ']'))) {
            _sendError(res, `Invalid Group Id: ${groupId}`);
        } else {
            log.debug('Successfully read configuration for group id:', groupId);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(server.state.get('groups[' + groupId + ']')));
        }
    };

    // Updates an individual group
    operation.updateGroupById = (req, res) => {
        let groupId = req.params.id;

        if (!req.body || !req.body.length || !Backing.validateSections(req.body)) {
            _sendError(res, 'Invalid Group', `Invalid Group for Request: ${JSON.stringify(req.body)}`);
            return;
        }

        Backing.createOrUpdateGroup(groupId, 'update', req.body);
        Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ id: parseInt(groupId, 10) }));
    };

    // Deletes an individual group. If there are no more non-empty groups at the end of this
    // operation, it will reset all groups on the server.
    operation.deleteGroupById = (req, res) => {
        let groupId = req.params.id;

        if (Utils.isNullOrEmpty(server.state.get('groups[' + groupId + ']'))) {
            _sendError(res, `Invalid Group Id: ${groupId}`);
            return;
        }

        Backing.deleteGroupById(groupId);
        Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ id: parseInt(groupId, 10) }));
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
        Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ connection: ApiUtils.deleteSpace(ApiUtils.getConnection(req.body.primary), req.body.elem) }));

    operation.deleteAllForSpace = (req, res) => Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ connection: ApiUtils.deleteAllForSpace(req.body.primary, req.body.elem) }));

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
