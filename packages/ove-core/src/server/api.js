const path = require('path');
const request = require('request');
const HttpStatus = require('http-status-codes');

module.exports = function (server, log, Utils, Constants) {
    // It is required that we are able to clean-up variables like these during testing.
    server.spaceGeometries = {};

    // Lists details of all spaces, and accepts filters as a part of its query string.
    const listSpaces = function (req, res) {
        let sectionId = req.query.oveSectionId;
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

    // Internal utility function to calculate space geometries.
    const _getSpaceGeometries = function () {
        if (Utils.isNullOrEmpty(server.spaceGeometries) && !Utils.isNullOrEmpty(server.spaces)) {
            Object.keys(server.spaces).forEach(function (s) {
                const geometry = { w: Number.MIN_VALUE, h: Number.MIN_VALUE };
                server.spaces[s].forEach(function (e) {
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
    const getSpaceGeometry = function (req, res) {
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

    const _calculateSectionLayout = function (spaceName, geometry) {
        // Calculate the dimensions on a client-by-client basis
        let layout = [];
        server.spaces[spaceName].forEach(function (e) {
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

    const _handleRequestError = function (e) {
        /* istanbul ignore if */
        // It is impossible to test this scenario as there would be issues in the test runner if URLs
        // were invalid. This is easily testable using an integration test-case, since PM2/node will
        // eventually report the error after several seconds.
        if (e) {
            log.warn('Connection error when making request:', e);
        }
    };

    // Creates an individual section
    const createSection = function (req, res) {
        if (!req.body.space || !server.spaces[req.body.space]) {
            log.error('Invalid Space', 'request:', JSON.stringify(req.body));
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid space' }));
            return;
        } else if (req.body.w === undefined || req.body.h === undefined || req.body.x === undefined || req.body.y === undefined) {
            // specifically testing for undefined since '0' is a valid input.
            log.error('Invalid Dimensions', 'request:', JSON.stringify(req.body));
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));
            return;
        } else if (req.body.app && !req.body.app.url) {
            log.error('Invalid App Configuration', 'request:', JSON.stringify(req.body.app));
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid app configuration' }));
            return;
        }
        let section = { w: req.body.w, h: req.body.h, x: req.body.x, y: req.body.y, spaces: {} };
        section.spaces[req.body.space] = _calculateSectionLayout(req.body.space, {
            x: req.body.x, y: req.body.y, w: req.body.w, h: req.body.h
        });
        log.debug('Generated spaces configuration for new section');

        // Deploy an App into a section
        let sectionId = server.state.get('sections').length;
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
                        request.post(section.app.url + '/states/' + name, {
                            headers: { 'Content-Type': Constants.HTTP_CONTENT_TYPE_JSON },
                            json: req.body.app.states.cache[name]
                        }, _handleRequestError);
                    });
                }
                if (req.body.app.states.load) {
                    // Either a named state or an in-line state configuration can be loaded.
                    if (typeof req.body.app.states.load === 'string' || req.body.app.states.load instanceof String) {
                        section.app.state = req.body.app.states.load;
                        log.debug('Loading existing named state:', section.app.state);
                    } else {
                        log.debug('Loading state configuration');
                        request.post(section.app.url + '/instances/' + sectionId + '/state', {
                            headers: { 'Content-Type': Constants.HTTP_CONTENT_TYPE_JSON },
                            json: req.body.app.states.load
                        }, _handleRequestError);
                    }
                }
            }
            const opacity = req.body.app.opacity;
            if (opacity) {
                log.debug('Setting opacity for app:', opacity);
                section.app.opacity = opacity;
            }
        }
        server.state.set('sections[' + sectionId + ']', section);

        // Notify OVE viewers/controllers
        server.wss.clients.forEach(function (c) {
            if (c.readyState === Constants.WEBSOCKET_READY) {
                // Sections are created on the browser and then the application is deployed after a
                // short delay. This will ensure proper frame sizes.
                c.safeSend(JSON.stringify({ appId: Constants.APP_NAME,
                    message: { action: Constants.Action.CREATE, id: sectionId, spaces: section.spaces } }));
                if (section.app) {
                    setTimeout(function () {
                        c.safeSend(JSON.stringify({ appId: Constants.APP_NAME,
                            message: { action: Constants.Action.UPDATE, id: sectionId, app: section.app } }));
                    }, Constants.SECTION_UPDATE_DELAY);
                }
            }
        });
        log.info('Successfully created new section:', sectionId);
        log.debug('Existing sections (active/deleted):', server.state.get('sections').length);
        Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ id: sectionId }));
    };

    // Internal utility function to delete section by a given id. This function is used
    // either to delete all sections belonging to a given space, or to delete a specific
    // section by its id.
    const _deleteSectionById = function (sectionId) {
        let section = server.state.get('sections[' + sectionId + ']');
        if (section.app && section.app.url) {
            log.debug('Flushing application at URL:', section.app.url);
            request.post(section.app.url + '/instances/' + sectionId + '/flush', _handleRequestError);
        }
        server.state.get('groups').forEach(function (e, groupId) {
            if (e.includes(parseInt(sectionId, 10))) {
                // The outcome of this operation is logged within the internal utility method
                if (e.length === 1) {
                    _deleteGroupById(groupId);
                } else {
                    e.splice(e.indexOf(parseInt(sectionId, 10)), 1);
                    server.state.set('groups[' + groupId + ']', e);
                }
            }
        });
        server.state.set('sections[' + sectionId + ']', {});

        server.wss.clients.forEach(function (c) {
            if (c.readyState === Constants.WEBSOCKET_READY) {
                c.safeSend(JSON.stringify({ appId: Constants.APP_NAME, message: { action: Constants.Action.DELETE, id: parseInt(sectionId, 10) } }));
            }
        });
    };

    // Deletes all sections
    const deleteSections = function (req, res) {
        const space = req.query.space;
        const groupId = req.query.groupId;
        let sections = server.state.get('sections');
        if (groupId) {
            let deletedSections = [];
            if (!Utils.isNullOrEmpty(server.state.get('groups[' + groupId + ']'))) {
                log.info('Deleting sections of group:', groupId);
                const group = server.state.get('groups[' + groupId + ']').slice();
                group.forEach(function (e) {
                    _deleteSectionById(e);
                    deletedSections.push(parseInt(e, 10));
                });
            }
            log.info('Successfully deleted sections:', deletedSections);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ ids: deletedSections }));
        } else if (space) {
            let findSectionsBySpace = function (e) {
                return !Utils.isNullOrEmpty(e) && !Utils.isNullOrEmpty(e.spaces[space]);
            };
            log.info('Deleting sections of space:', space);
            let deletedSections = [];
            let i = sections.findIndex(findSectionsBySpace);
            while (i !== -1) {
                _deleteSectionById(i);
                deletedSections.push(parseInt(i, 10));
                i = server.state.get('sections').findIndex(findSectionsBySpace);
            }
            log.info('Successfully deleted sections:', deletedSections);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ ids: deletedSections }));
        } else {
            let appsToFlush = [];
            while (sections.length !== 0) {
                let section = sections.pop();
                if (section.app && section.app.url) {
                    log.debug('Flushing application at URL:', section.app.url);
                    appsToFlush.push(section.app.url);
                }
            }
            appsToFlush = appsToFlush.filter(function (e, i) {
                return appsToFlush.indexOf(e) === i;
            });
            while (appsToFlush.length !== 0) {
                let appToFlush = appsToFlush.pop();
                request.post(appToFlush + '/instances/flush', _handleRequestError);
            }
            server.state.set('sections', []);
            server.state.set('groups', []);
            server.wss.clients.forEach(function (c) {
                if (c.readyState === Constants.WEBSOCKET_READY) {
                    c.safeSend(JSON.stringify({ appId: Constants.APP_NAME, message: { action: Constants.Action.DELETE } }));
                }
            });
            log.info('Successfully deleted all sections');
            Utils.sendEmptySuccess(res);
        }
        log.debug('Existing sections (active/deleted):', server.state.get('sections').length);
        log.debug('Existing groups (active/deleted):', server.state.get('groups').length);
    };

    // Returns details of sections
    const readSections = function (req, res) {
        const space = req.query.space;
        const groupId = req.query.groupId;
        const geometry = req.query.geometry;
        const sections = server.state.get('sections');
        let sectionsToFetch = [];
        if (groupId) {
            if (!Utils.isNullOrEmpty(server.state.get('groups[' + groupId + ']'))) {
                log.info('Fetching sections of group:', groupId);
                const group = server.state.get('groups[' + groupId + ']').slice();
                group.forEach(function (e) {
                    let i = parseInt(e, 10);
                    sectionsToFetch.push(i);
                });
            }
        } else if (space) {
            log.info('Fetching sections of space:', space);
            let i = -1;
            let findSectionsBySpace = function (e, x) {
                return x > i && !Utils.isNullOrEmpty(e) && !Utils.isNullOrEmpty(e.spaces[space]);
            };
            i = sections.findIndex(findSectionsBySpace);
            while (i !== -1) {
                sectionsToFetch.push(i);
                i = sections.findIndex(findSectionsBySpace);
            }
        } else {
            sections.forEach(function (e, i) {
                if (!Utils.isNullOrEmpty(e)) {
                    sectionsToFetch.push(i);
                }
            });
        }
        if (geometry) {
            const g = geometry.split(',');
            const r = { x: g[0], y: g[1], w: g[2], h: g[3] };
            if (g.length !== 4) {
                log.warn('Ignoring invalid geometry:', r);
            } else {
                log.info('Filtering list of sections using geometry:', r);
                sectionsToFetch = sectionsToFetch.filter(function (i) {
                    const e = sections[i];
                    // Top-Left and Bottom-Right of section should be within the given range.
                    return (e.x >= r.x && e.y >= r.y && (e.x + e.w) <= (r.x + r.w) && (e.y + e.h) <= (r.y + r.h));
                });
            }
        }
        let result = [];
        sectionsToFetch.forEach(function (i) {
            let s = sections[i];
            let section = { id: i, x: s.x, y: s.y, w: s.w, h: s.h, space: Object.keys(s.spaces)[0] };
            const app = s.app;
            if (app) {
                section.app = { url: app.url, state: app.state, opacity: app.opacity };
            }
            result.push(section);
        });
        log.debug('Successfully read configuration for sections:', sectionsToFetch);
        Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(result));
    };

    // Internal utility function to update section by a given id. This function is used
    // either to update all sections belonging to a given group, or to update a specific
    // section by its id.
    const _updateSectionById = function (sectionId, space, geometry, app) {
        let commands = [];
        let oldURL = null;
        let oldOpacity = null;
        let section = server.state.get('sections[' + sectionId + ']');
        if (section.app) {
            oldURL = section.app.url;
            oldOpacity = section.app.opacity;
            log.debug('Deleting existing application configuration');
            delete section.app;
            commands.push(JSON.stringify({ appId: Constants.APP_NAME, message: { action: Constants.Action.UPDATE, id: parseInt(sectionId, 10) } }));
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
                commands.push(JSON.stringify({ appId: Constants.APP_NAME, message: { action: Constants.Action.UPDATE, id: parseInt(sectionId, 10), spaces: section.spaces } }));
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
                    Object.keys(app.states.cache).forEach(function (name) {
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
                commands.push(JSON.stringify({ appId: Constants.APP_NAME, message: { action: Constants.Action.UPDATE, id: parseInt(sectionId, 10), app: $app } }));
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
        server.wss.clients.forEach(function (c) {
            if (c.readyState === Constants.WEBSOCKET_READY) {
                commands.forEach(function (m) {
                    c.safeSend(m);
                });
            }
        });
        server.state.set('sections[' + sectionId + ']', section);
    };

    // Internal utility function to transform or move all or some sections.
    const _updateSections = function (operation, space, groupId, res) {
        if (!((operation.moveTo && operation.moveTo.space) ||
        (operation.transform && (operation.transform.scale || operation.transform.translate)))) {
            // An attempt to do something we don't understand
            log.error('Invalid Operation:', 'request:', JSON.stringify(operation));
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid operation' }));
        } else if (operation.moveTo && operation.moveTo.space && !server.spaces[operation.moveTo.space]) {
            log.error('Invalid Space', 'request:', JSON.stringify(operation));
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid space' }));
            return;
        } else if (operation.transform) {
            if (operation.transform.scale && (operation.transform.scale.x === undefined || operation.transform.scale.y === undefined)) {
                log.error('Invalid Dimensions for Scale operation', 'request:', JSON.stringify(operation));
                Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));
                return;
            } else if (operation.transform.translate && (operation.transform.translate.x === undefined || operation.transform.translate.y === undefined)) {
                log.error('Invalid Dimensions for Translate operation', 'request:', JSON.stringify(operation));
                Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));
                return;
            }
        }

        let sectionsToUpdate = [];
        const sections = server.state.get('sections');
        if (groupId) {
            if (!Utils.isNullOrEmpty(server.state.get('groups[' + groupId + ']'))) {
                log.info('Updating sections of group:', groupId);
                const group = server.state.get('groups[' + groupId + ']').slice();
                group.forEach(function (e) {
                    let i = parseInt(e, 10);
                    sectionsToUpdate.push(i);
                });
            }
        } else if (space) {
            log.info('Updating sections of space:', space);
            let i = -1;
            let findSectionsBySpace = function (e, x) {
                return x > i && !Utils.isNullOrEmpty(e) && !Utils.isNullOrEmpty(e.spaces[space]);
            };
            i = sections.findIndex(findSectionsBySpace);
            while (i !== -1) {
                sectionsToUpdate.push(i);
                i = sections.findIndex(findSectionsBySpace);
            }
        } else {
            sections.forEach(function (e, i) {
                if (!Utils.isNullOrEmpty(e)) {
                    sectionsToUpdate.push(i);
                }
            });
        }

        // Check whether any operation has to be made.
        if (Utils.isNullOrEmpty(sectionsToUpdate)) {
            Utils.sendEmptySuccess(res);
            return;
        }

        let rangeError = false;
        let geometries = {};
        sectionsToUpdate.forEach(function (e) {
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

        sectionsToUpdate.forEach(function (e) {
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
    const transformSections = function (req, res) {
        _updateSections({ transform: req.body }, req.query.space, req.query.groupId, res);
    };

    // Moves sections to another space
    const moveSectionsTo = function (req, res) {
        _updateSections({ moveTo: req.body }, req.query.space, req.query.groupId, res);
    };

    // Fetches details of an individual section
    const readSectionById = function (req, res) {
        let sectionId = req.params.id;
        let s = server.state.get('sections[' + sectionId + ']');
        if (Utils.isNullOrEmpty(s)) {
            log.debug('Unable to read configuration for section id:', sectionId);
            Utils.sendEmptySuccess(res);
            return;
        }

        let section = {
            id: parseInt(sectionId, 10), x: s.x, y: s.y, w: s.w, h: s.h, space: Object.keys(s.spaces)[0]
        };
        const app = s.app;
        if (app) {
            section.app = { url: app.url, state: app.state, opacity: app.opacity };
        }
        log.debug('Successfully read configuration for section id:', sectionId);
        Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(section));
    };

    // Updates an app associated with a section
    const updateSectionById = function (req, res) {
        let sectionId = req.params.id;
        if (!(req.body.space || req.body.app || req.body.x || req.body.y || req.body.w || req.body.h)) {
            // An attempt to do something we don't understand
            log.error('Invalid Operation:', 'request:', JSON.stringify(req.body));
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid operation' }));
        } else if (Utils.isNullOrEmpty(server.state.get('sections[' + sectionId + ']'))) {
            log.error('Invalid Section Id:', sectionId);
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid section id' }));
        } else if (req.body.app && !req.body.app.url) {
            log.error('Invalid App Configuration', 'request:', JSON.stringify(req.body.app));
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid app configuration' }));
        } else if (req.body.space && !server.spaces[req.body.space]) {
            log.error('Invalid Space', 'request:', JSON.stringify(req.body));
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid space' }));
        } else if ((req.body.space || req.body.w !== undefined || req.body.h !== undefined) && (req.body.x === undefined || req.body.y === undefined)) {
            // specifically testing for undefined since '0' is a valid input.
            // x and y positions must be provided if the space, w or h has changed.
            log.error('Both x and y positions are required to change space, height or width', 'request:', JSON.stringify(req.body));
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));
        } else if ((req.body.x !== undefined && req.body.y === undefined) || (req.body.y !== undefined && req.body.x === undefined)) {
            // specifically testing for undefined since '0' is a valid input.
            // x and y positions must be provided together
            log.error('Both x and y positions are required for a resize operation', 'request:', JSON.stringify(req.body));
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));
        } else {
            _updateSectionById(sectionId, req.body.space, { x: req.body.x, y: req.body.y, w: req.body.w, h: req.body.h }, req.body.app);
            log.info('Successfully updated section:', sectionId);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ id: parseInt(sectionId, 10) }));
        }
    };

    // Deletes an individual section
    const deleteSectionById = function (req, res) {
        let sectionId = req.params.id;
        if (Utils.isNullOrEmpty(server.state.get('sections[' + sectionId + ']'))) {
            log.error('Invalid Section Id:', sectionId);
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid section id' }));
        } else {
            _deleteSectionById(sectionId);
            log.info('Successfully deleted section:', sectionId);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ ids: [ parseInt(sectionId, 10) ] }));
        }
    };

    const readGroups = function (_req, res) {
        let result = [];
        server.state.get('groups').forEach(function (e, i) {
            if (!Utils.isNullOrEmpty(server.state.get('groups[' + i + ']'))) {
                result.push(e);
            }
        });
        log.debug('Successfully read configuration for all groups');
        Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(result));
    };

    // Internal utility function to create or update a group
    const _createOrUpdateGroup = function (groupId, operation, req, res) {
        const validateSections = function (group) {
            let valid = true;
            const sections = server.state.get('sections');
            group.forEach(function (e) {
                if (Utils.isNullOrEmpty(sections[e])) {
                    valid = false;
                }
            });
            return valid;
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
    const createGroup = function (req, res) {
        _createOrUpdateGroup(server.state.get('groups').length, 'create', req, res);
    };

    // Fetches details of an individual group
    const readGroupById = function (req, res) {
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
    const updateGroupById = function (req, res) {
        _createOrUpdateGroup(req.params.id, 'update', req, res);
    };

    // Internal utility function to delete a group by the given id
    const _deleteGroupById = function (groupId) {
        server.state.set('groups[' + groupId + ']', []);
        let hasNonEmptyGroups = false;
        server.state.get('groups').forEach(function (e) {
            if (!Utils.isNullOrEmpty(e)) {
                hasNonEmptyGroups = true;
            }
        });
        if (hasNonEmptyGroups) {
            log.info('Successfully deleted group:', groupId);
        } else {
            server.state.set('groups', []);
            log.info('Successfully deleted all groups');
        }
    };

    // Deletes an individual group. If there are no more non-empty groups at the end of this
    // operation, it will reset all groups on the server.
    const deleteGroupById = function (req, res) {
        let groupId = req.params.id;
        if (Utils.isNullOrEmpty(server.state.get('groups[' + groupId + ']'))) {
            log.error('Invalid Group Id:', groupId);
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid group id' }));
        } else {
            _deleteGroupById(groupId);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ id: parseInt(groupId, 10) }));
        }
    };

    server.app.get('/spaces', listSpaces);
    server.app.get('/spaces/:name/geometry', getSpaceGeometry);
    server.app.get('/sections', readSections);
    server.app.delete('/sections', deleteSections);
    server.app.post('/section', createSection);
    server.app.get('/sections/:id([0-9]+)', readSectionById);
    server.app.post('/sections/:id([0-9]+)', updateSectionById);
    server.app.delete('/sections/:id([0-9]+)', deleteSectionById);
    server.app.post('/sections/transform', transformSections);
    server.app.post('/sections/moveTo', moveSectionsTo);
    server.app.get('/groups', readGroups);
    server.app.post('/group', createGroup);
    server.app.get('/groups/:id([0-9]+)', readGroupById);
    server.app.post('/groups/:id([0-9]+)', updateGroupById);
    server.app.delete('/groups/:id([0-9]+)', deleteGroupById);

    // Swagger API documentation
    Utils.buildAPIDocs(path.join(__dirname, 'swagger.yaml'), path.join(__dirname, '..', '..', 'package.json'));
};
