const path = require('path');
const request = require('request');
const HttpStatus = require('http-status-codes');

module.exports = function (server, log, Utils, Constants) {
    // It is required that we are able to clean-up variables like these during testing.
    server.spaceGeometries = {};

    // Lists details of all spaces, and accepts filters as a part of its query string.
    const listSpaces = function (req, res) {
        let sectionId = req.query.oveSectionId;
        if (sectionId !== undefined) {
            if (!server.sections[sectionId]) {
                log.debug('Unable to produce list of spaces for section id:', sectionId);
                Utils.sendEmptySuccess(res);
            } else {
                log.debug('Returning parsed result of ' + Constants.SPACES_JSON_FILENAME + ' for section id:', sectionId);
                Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(server.sections[sectionId].spaces));
            }
        } else {
            log.debug('Returning parsed result of ' + Constants.SPACES_JSON_FILENAME);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(server.spaces));
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
            if ((e.x + e.w) > geometry.x && (geometry.x + geometry.w) > e.x &&
                (e.y + e.h) > geometry.y && (geometry.y + geometry.h) > e.y) {
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
            } else {
                layout.push({});
            }
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
        } else if (req.body.w === undefined || req.body.h === undefined || req.body.x === undefined || req.body.y === undefined) {
            // specifically testing for undefined since '0' is a valid input.
            log.error('Invalid Dimensions', 'request:', JSON.stringify(req.body));
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));
        } else if (req.body.app && !req.body.app.url) {
            log.error('Invalid App Configuration', 'request:', JSON.stringify(req.body.app));
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid app configuration' }));
        } else {
            let section = { w: req.body.w, h: req.body.h, x: req.body.x, y: req.body.y, spaces: {} };
            section.spaces[req.body.space] = _calculateSectionLayout(req.body.space, {
                x: req.body.x, y: req.body.y, w: req.body.w, h: req.body.h
            });
            log.debug('Generated spaces configuration for new section');

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
                            request.post(section.app.url + '/' + sectionId + '/state', {
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
            server.sections[sectionId] = section;

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
            log.debug('Existing sections (active/deleted):', server.sections.length);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ id: sectionId }));
        }
    };

    // Internal utility function to delete section by a given id. This function is used
    // either to delete all sections belonging to a given space, or to delete a specific
    // section by its id.
    const _deleteSectionById = function (sectionId) {
        let section = server.sections[sectionId];
        if (section.app) {
            log.debug('Flushing application at URL:', section.app.url);
            request.post(section.app.url + '/flush', _handleRequestError);
        }
        server.groups.forEach(function (e, groupId) {
            if (e.includes(parseInt(sectionId, 10))) {
                // The outcome of this operation is logged within the internal utility method
                _deleteGroupById(groupId);
            }
        });
        delete server.sections[sectionId];
        server.sections[sectionId] = {};

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
        if (groupId) {
            let deletedSections = [];
            if (!Utils.isNullOrEmpty(server.groups[groupId])) {
                log.info('Deleting sections of group:', groupId);
                const group = server.groups[groupId].slice();
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
            let i = server.sections.findIndex(findSectionsBySpace);
            while (i !== -1) {
                _deleteSectionById(i);
                deletedSections.push(parseInt(i, 10));
                i = server.sections.findIndex(findSectionsBySpace);
            }
            log.info('Successfully deleted sections:', deletedSections);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ ids: deletedSections }));
        } else {
            while (server.sections.length !== 0) {
                let section = server.sections.pop();
                if (section.app) {
                    log.debug('Flushing application at URL:', section.app.url);
                    request.post(section.app.url + '/flush', _handleRequestError);
                }
            }
            while (server.groups.length !== 0) {
                server.groups.pop();
            }
            server.wss.clients.forEach(function (c) {
                if (c.readyState === Constants.WEBSOCKET_READY) {
                    c.safeSend(JSON.stringify({ appId: Constants.APP_NAME, message: { action: Constants.Action.DELETE } }));
                }
            });
            log.info('Successfully deleted all sections');
            Utils.sendEmptySuccess(res);
        }
        log.debug('Existing sections (active/deleted):', server.sections.length);
        log.debug('Existing groups (active/deleted):', server.groups.length);
    };

    // Returns details of sections
    const readSections = function (req, res) {
        const space = req.query.space;
        const groupId = req.query.groupId;
        const geometry = req.query.geometry;
        let sectionsToFetch = [];
        if (groupId) {
            if (!Utils.isNullOrEmpty(server.groups[groupId])) {
                log.info('Fetching sections of group:', groupId);
                const group = server.groups[groupId].slice();
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
            i = server.sections.findIndex(findSectionsBySpace);
            while (i !== -1) {
                sectionsToFetch.push(i);
                i = server.sections.findIndex(findSectionsBySpace);
            }
        } else {
            server.sections.forEach(function (e, i) {
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
                    const e = server.sections[i];
                    // Top-Left and Bottom-Right of section should be within the given range.
                    return (e.x >= r.x && e.y >= r.y && (e.x + e.w) <= (r.x + r.w) && (e.y + e.h) <= (r.y + r.h));
                });
            }
        }
        let result = [];
        sectionsToFetch.forEach(function (i) {
            let section = {
                id: i,
                x: server.sections[i].x,
                y: server.sections[i].y,
                w: server.sections[i].w,
                h: server.sections[i].h,
                space: Object.keys(server.sections[i].spaces)[0]
            };
            const app = server.sections[i].app;
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
        if (server.sections[sectionId].app) {
            oldURL = server.sections[sectionId].app.url;
            oldOpacity = server.sections[sectionId].app.opacity;
            log.debug('Deleting existing application configuration');
            delete server.sections[sectionId].app;
            commands.push(JSON.stringify({ appId: Constants.APP_NAME, message: { action: Constants.Action.UPDATE, id: parseInt(sectionId, 10) } }));
        }

        let needsUpdate = false;
        if (space && !Object.keys(server.sections[sectionId].spaces).includes(space)) {
            log.debug('Changing space name to:', space);
            needsUpdate = true;
        }
        if (geometry.w !== undefined && geometry.w !== server.sections[sectionId].w) {
            log.debug('Changing space width to:', geometry.w);
            server.sections[sectionId].w = geometry.w;
            needsUpdate = true;
        }
        if (geometry.h !== undefined && geometry.h !== server.sections[sectionId].h) {
            log.debug('Changing space height to:', geometry.h);
            server.sections[sectionId].h = geometry.h;
            needsUpdate = true;
        }

        const spaceName = space || Object.keys(server.sections[sectionId].spaces)[0];
        if (geometry.x !== undefined && geometry.y !== undefined) {
            const layout = _calculateSectionLayout(spaceName, {
                x: geometry.x, y: geometry.y, w: server.sections[sectionId].w, h: server.sections[sectionId].h
            });
            if (!needsUpdate && !Utils.JSON.equals(server.sections[sectionId].spaces[spaceName], layout)) {
                server.sections[sectionId].x = geometry.x;
                server.sections[sectionId].y = geometry.y;
                needsUpdate = true;
            }
            if (needsUpdate) {
                log.debug('Updating spaces configuration of section');
                delete server.sections[sectionId].spaces;
                server.sections[sectionId].spaces = {};
                server.sections[sectionId].spaces[spaceName] = layout;
                commands.push(JSON.stringify({ appId: Constants.APP_NAME, message: { action: Constants.Action.UPDATE, id: parseInt(sectionId, 10), spaces: server.sections[sectionId].spaces } }));
            }
        }

        if (app) {
            const url = app.url.replace(/\/$/, '');
            needsUpdate = needsUpdate || (url !== oldURL);
            if (oldURL && (url !== oldURL)) {
                log.debug('Flushing application at URL:', oldURL);
                request.post(oldURL + '/flush', _handleRequestError);
            }
            server.sections[sectionId].app = { 'url': url };
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
                        request.post(server.sections[sectionId].app.url + '/state/' + name, {
                            headers: { 'Content-Type': Constants.HTTP_CONTENT_TYPE_JSON },
                            json: app.states.cache[name]
                        }, _handleRequestError);
                    });
                    needsUpdate = true;
                }
                if (app.states.load) {
                    // Either a named state or an in-line state configuration can be loaded.
                    if (typeof app.states.load === 'string' || app.states.load instanceof String) {
                        server.sections[sectionId].app.state = app.states.load;
                        log.debug('Loading existing named state:', server.sections[sectionId].app.state);
                    } else {
                        log.debug('Loading state configuration');
                        request.post(server.sections[sectionId].app.url + '/' + sectionId + '/state', {
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
                server.sections[sectionId].app.opacity = opacity;
                if (oldOpacity !== opacity && !needsUpdate) {
                    needsUpdate = true;
                }
            }
            // If nothing changed, there is no point in making an update.
            if (needsUpdate) {
                let $app = { 'url': server.sections[sectionId].app.url };
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
            request.post(oldURL + '/flush', _handleRequestError);
        }

        // Notify OVE viewers/controllers
        server.wss.clients.forEach(function (c) {
            if (c.readyState === Constants.WEBSOCKET_READY) {
                commands.forEach(function (m) {
                    c.safeSend(m);
                });
            }
        });
    };

    const updateSections = function (req, res) {
        if (req.body.space && !server.spaces[req.body.space]) {
            log.error('Invalid Space', 'request:', JSON.stringify(req.body));
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid space' }));
        } else if (req.body.scale && (req.body.scale.x === undefined || req.body.scale.y === undefined)) {
            log.error('Invalid Dimensions for Scale operation', 'request:', JSON.stringify(req.body));
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));
        } else if (req.body.translate && (req.body.translate.x === undefined || req.body.translate.y === undefined)) {
            log.error('Invalid Dimensions for Translate operation', 'request:', JSON.stringify(req.body));
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));
        } else {
            let sectionsToUpdate = [];
            const space = req.query.space;
            const groupId = req.query.groupId;
            if (groupId) {
                if (!Utils.isNullOrEmpty(server.groups[groupId])) {
                    log.info('Updating sections of group:', groupId);
                    const group = server.groups[groupId].slice();
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
                i = server.sections.findIndex(findSectionsBySpace);
                while (i !== -1) {
                    sectionsToUpdate.push(i);
                    i = server.sections.findIndex(findSectionsBySpace);
                }
            } else {
                server.sections.forEach(function (e, i) {
                    if (!Utils.isNullOrEmpty(e)) {
                        sectionsToUpdate.push(i);
                    }
                });
            }
            // Check whether any operation has to be made.
            if (!Utils.isNullOrEmpty(sectionsToUpdate) && (req.body.space || req.body.scale || req.body.translate)) {
                let rangeError = false;
                let geometries = {};
                sectionsToUpdate.forEach(function (e) {
                    const section = server.sections[e];
                    geometries[e] = { x: section.x, y: section.y, w: section.w, h: section.h };
                    const space = req.body.space || Object.keys(section.spaces)[0];
                    const bounds = _getSpaceGeometries()[space];
                    if (req.body.scale) {
                        geometries[e].w = (geometries[e].w * req.body.scale.x) << 0;
                        geometries[e].h = (geometries[e].h * req.body.scale.y) << 0;
                    }
                    if (req.body.translate) {
                        geometries[e].x = (geometries[e].x + req.body.translate.x) << 0;
                        geometries[e].y = (geometries[e].y + req.body.translate.y) << 0;
                    }
                    if (geometries[e].x < 0 || geometries[e].y < 0 || Math.max(geometries[e].x, geometries[e].w) > bounds.w || Math.max(geometries[e].y, geometries[e].h) > bounds.h) {
                        log.error('Section no longer fits within space after transformation for section id:', e, 'space:', space, 'geometry:', JSON.stringify(geometries[e]));
                        rangeError = true;
                    }
                });
                if (rangeError) {
                    log.error('Unable to update sections due to one or more range errors');
                    Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));
                } else {
                    sectionsToUpdate.forEach(function (e) {
                        const section = server.sections[e];
                        _updateSectionById(e, req.body.space, geometries[e], section.app);
                    });
                    if (sectionsToUpdate.length === server.sections.length) {
                        log.info('Successfully updated all sections');
                    } else {
                        log.info('Successfully updated sections:', sectionsToUpdate);
                    }
                    Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ ids: sectionsToUpdate }));
                }
            } else {
                Utils.sendEmptySuccess(res);
            }
        }
    };

    // Fetches details of an individual section
    const readSectionById = function (req, res) {
        let sectionId = req.params.id;
        if (Utils.isNullOrEmpty(server.sections[sectionId])) {
            log.debug('Unable to read configuration for section id:', sectionId);
            Utils.sendEmptySuccess(res);
        } else {
            let section = {
                id: parseInt(sectionId, 10),
                x: server.sections[sectionId].x,
                y: server.sections[sectionId].y,
                w: server.sections[sectionId].w,
                h: server.sections[sectionId].h,
                space: Object.keys(server.sections[sectionId].spaces)[0]
            };
            const app = server.sections[sectionId].app;
            if (app) {
                section.app = { url: app.url, state: app.state, opacity: app.opacity };
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
        if (Utils.isNullOrEmpty(server.sections[sectionId])) {
            log.error('Invalid Section Id:', sectionId);
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid section id' }));
        } else {
            _deleteSectionById(sectionId);
            log.info('Successfully deleted section:', sectionId);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ ids: [ parseInt(sectionId, 10) ] }));
        }
    };

    // Internal utility function to create or update a group
    const _createOrUpdateGroup = function (groupId, operation, req, res) {
        const validateSections = function (group) {
            let valid = true;
            group.forEach(function (e) {
                if (Utils.isNullOrEmpty(server.sections[e])) {
                    valid = false;
                }
            });
            return valid;
        };
        if (!req.body || !req.body.length || !validateSections(req.body)) {
            log.error('Invalid Group', 'request:', JSON.stringify(req.body));
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid group' }));
        } else {
            server.groups[groupId] = req.body.slice();
            log.info('Successfully ' + operation + 'd group:', groupId);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify({ id: parseInt(groupId, 10) }));
        }
    };

    // Creates an individual group
    const createGroup = function (req, res) {
        _createOrUpdateGroup(server.groups.length, 'create', req, res);
    };

    // Fetches details of an individual group
    const readGroupById = function (req, res) {
        let groupId = req.params.id;
        if (Utils.isNullOrEmpty(server.groups[groupId])) {
            log.error('Invalid Group Id:', groupId);
            Utils.sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid group id' }));
        } else {
            log.debug('Successfully read configuration for group id:', groupId);
            Utils.sendMessage(res, HttpStatus.OK, JSON.stringify(server.groups[groupId]));
        }
    };

    // Updates an individual group
    const updateGroupById = function (req, res) {
        _createOrUpdateGroup(req.params.id, 'update', req, res);
    };

    // Internal utility function to delete a group by the given id
    const _deleteGroupById = function (groupId) {
        delete server.groups[groupId];
        server.groups[groupId] = [];
        let hasNonEmptyGroups = false;
        server.groups.forEach(function (e) {
            if (!Utils.isNullOrEmpty(e)) {
                hasNonEmptyGroups = true;
            }
        });
        if (hasNonEmptyGroups) {
            log.info('Successfully deleted group:', groupId);
        } else {
            server.groups = [];
            log.info('Successfully deleted all groups');
        }
    };

    // Deletes an individual group. If there are no more non-empty groups at the end of this
    // operation, it will reset all groups on the server.
    const deleteGroupById = function (req, res) {
        let groupId = req.params.id;
        if (Utils.isNullOrEmpty(server.groups[groupId])) {
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
    server.app.post('/sections', updateSections);
    server.app.delete('/sections', deleteSections);
    server.app.post('/section', createSection);
    server.app.get('/section/:id', readSectionById);
    server.app.post('/section/:id', updateSectionById);
    server.app.delete('/section/:id', deleteSectionById);
    server.app.post('/group', createGroup);
    server.app.get('/group/:id', readGroupById);
    server.app.post('/group/:id', updateGroupById);
    server.app.delete('/group/:id', deleteGroupById);

    // Swagger API documentation
    Utils.buildAPIDocs(path.join(__dirname, 'swagger.yaml'), path.join(__dirname, '..', '..', 'package.json'));
};
