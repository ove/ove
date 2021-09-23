const path = require('path');
const axios = require('axios');
const RequestUtils = require(path.resolve(__dirname, 'request-utils'));

module.exports = (server, operation, log, Utils, Constants, ApiUtils) => {
    const peers = server.peers;

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

    const _listSpaces = sectionId => {
        if (Utils.isNullOrEmpty(sectionId)) {
            log.debug('Returning parsed result of ' + Constants.SPACES_JSON_FILENAME);
            return server.spaces;
        } else if (server.state.get(`sections[${sectionId}]`)) {
            log.debug('Returning parsed result of ' + Constants.SPACES_JSON_FILENAME + ' for section id:', sectionId);
            return server.state.get('sections[' + sectionId + '][spaces]');
        }
    };

    const _listConnections = link => {
        const groupBy = (xs, key) => xs.reduce((rv, x) => {
            (rv[x[key]] = rv[x[key]] || []).push(x.secondary.toString());
            return rv;
        }, {});
        const formatLink = link => ({ ...link, protocol: link.protocol.substring(0, link.protocol.length - 3) });
        const formatConnection = connection => ({
            primary: formatLink(connection.primary),
            secondary: connection.secondary.map(formatLink),
            sections: groupBy(connection.sections || [], 'primary')
        });

        if (link && !Utils.isNullOrEmpty(link) && !ApiUtils.isConnected(link)) return [];
        return ((link && !Utils.isNullOrEmpty(link)) ? [ApiUtils.getConnection(link)] : ApiUtils.getConnections())
            .map(formatConnection);
    };

    // Internal utility function to calculate space geometries.
    const _getSpaceGeometries = () => {
        if (!Utils.isNullOrEmpty(server.spaceGeometries) || Utils.isNullOrEmpty(server.spaces)) return server.spaceGeometries;
        Object.keys(server.spaces).forEach((s) => {
            const geometry = { w: Number.MIN_VALUE, h: Number.MIN_VALUE };
            server.spaces[s].forEach(e => {
                geometry.w = Math.max(e.x + e.w, geometry.w);
                geometry.h = Math.max(e.y + e.h, geometry.h);
            });
            log.debug('Successfully computed geometry for space:', s);
            server.spaceGeometries[s] = geometry;
        });
        return server.spaceGeometries;
    };

    // backing method for details api call.
    // returns the replicas if the id is primary
    // returns the primary if the id is secondary
    const _getSectionConnection = (id, link) => {
        const connection = ApiUtils.getConnection(link);

        if (!connection) return;
        if (ApiUtils.isPrimaryForConnection(connection, link)) {
            return { primary: id, secondary: ApiUtils.getReplicas(connection, id).map(({ secondary }) => secondary) };
        } else {
            const primary = ApiUtils.getPrimarySection(connection, id, link);
            return { primary: primary, secondary: ApiUtils.getReplicas(connection, primary).map(({ secondary }) => secondary) };
        }
    };

    const _deleteConnection = async (primary, secondary) => {
        const connection = await ApiUtils.getConnectionWrapper(secondary || primary);

        if (!connection) return false;

        await (secondary ? ApiUtils.disconnectSpaceWrapper(connection, secondary)
            : ApiUtils.removeConnectionWrapper(connection, primary));

        return true;
    };

    const _replicate = async (connection, section, link) => {
        let oldURL;
        const convertURL = url => {
            const split = url.split('/');
            split[2] = link.host;
            return split.join('/');
        };

        if (section?.app?.url) {
            oldURL = section.app.url;
            section.app.url = convertURL(section.app.url);
        }

        const primaryGeometry = await ApiUtils.getSpaceGeometriesWrapper(connection.primary, _getSpaceGeometries);
        const geometry = await ApiUtils.getSpaceGeometriesWrapper(link, _getSpaceGeometries);
        const data = { ...ApiUtils.getSectionData(section, primaryGeometry, geometry, link.space), primaryId: section.id, oldURL: oldURL };
        const id = await ApiUtils.createSectionWrapper(link, data, _createSection);

        return ApiUtils.replicateWrapper(connection, section, id, link);
    };

    const _getSectionMap = (sectionId, link) => {
        const connection = ApiUtils.getConnection(link);

        if (!connection) return;
        if (ApiUtils.isPrimaryForConnection(connection, link)) {
            return [{ id: sectionId, link: link }].concat(ApiUtils.getReplicas(connection, sectionId).map(({ secondary, link }) => ({
                id: secondary,
                link: link
            })));
        } else {
            const primary = ApiUtils.getPrimarySection(connection, sectionId, link);
            const replicas = ApiUtils.getReplicas(connection, primary).map(({ secondary, link }) => ({
                id: secondary,
                link: link
            })).filter(({ id }) => Number(id) !== Number(sectionId));
            return replicas.concat([{ id: primary, link: connection.primary }]);
        }
    };

    const _cache = async (id, body) => {
        const link = ApiUtils.getDefaultLink(ApiUtils.getSpaceBySectionId(id));
        const map = _getSectionMap(id, link);

        if (!map) return [];

        log.debug('Caching application state across all replicas: ', map.map(x => x.id));
        await Promise.all(map.map(async ({ id, link }) => {
            const url = `${await ApiUtils.getURLForIdWrapper(link, id)}/instances/${id}/state`;
            RequestUtils.post(url, ApiUtils.JSONHeader, body).catch(() => { throw new Error(`Failed to save state at: ${url}`); });
        }));

        return map.map(({ id }) => id);
    };

    const _createConnection = async (primary, secondary) => {
        const initialize = async connection => ApiUtils.updateConnectionWrapper({ ...connection, isInitialized: true });

        // update connections to include new connection
        const connection = await ApiUtils.updateConnectionWrapper(undefined, primary, secondary);

        // clear sections in secondary space
        ApiUtils.isLocal(secondary.host)
            ? await _deleteSections(secondary.space, undefined, () => {}, () => {})
            : await RequestUtils.delete(`${secondary.protocol}${secondary.host}/sections?space=${secondary.space}&override=true`, {});

        const primarySections = ApiUtils.getSectionsForSpace(primary);

        // replicate all sections from primary space to secondary
        const replicas = primarySections.length === 0 ? [] : await Promise.all(primarySections
            .map(async section => _replicate(connection, section, secondary)));

        await initialize(connection);

        return replicas.map(({ secondary }) => secondary);
    };

    const _onEvent = (id, body) => {
        const map = _getSectionMap(id, ApiUtils.getDefaultLink(ApiUtils.getSpaceBySectionId(id)));

        if (!map) return [];

        map.forEach(({ id, link }) =>
            ApiUtils.isLocal(link)
                ? _distributeEvent(id, body)
                : RequestUtils.post(`${link.protocol}${link.host}/connections/sections/distribute/${id}`,
                    ApiUtils.JSONHeader, { event: body, link: link }).catch(log.warn));

        return map.map(({ id }) => id);
    };

    const _distributeEvent = (id, body) => {
        _getReadySockets().forEach(c => {
            const newMessage = { appId: body.appId, sectionId: id.toString(), message: body.message };
            c.safeSend(JSON.stringify(newMessage));
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
    const _createSection = async body => {
        const _loadReplicatedState = (body, primaryId, sectionId) => {
            if (!body.app.url) return;
            section.app = body.app;
            log.debug('Loading state from primary section: ', primaryId);
            RequestUtils.get(`${body.oldURL}/instances/${primaryId}/state`, ApiUtils.JSONHeader)
                .then(text => RequestUtils.post(`${body.app.url}/instances/${sectionId}/state`, ApiUtils.JSONHeader, text).catch(log.warn))
                .catch(() => log.debug(`No state found at ${body.oldURL}`));
        };

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

            if (body.primaryId !== undefined) {
                _loadReplicatedState(body, body.primaryId, sectionId);
            } else {
                _loadSectionState(body.app, section, sectionId);
            }

            if (body.app.opacity) {
                log.debug('Setting opacity for app:', body.app.opacity);
                section.app.opacity = body.app.opacity;
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

        await ApiUtils.applyPrimary(body.space, async (connection, link) => _replicate(connection, section, link));

        log.debug('Successfully created replicas');
        log.info('Successfully created new section:', sectionId);
        log.debug('Existing sections (active/deleted):', server.state.get('sections').length);
        _messagePeers('createSection', { body: body });

        return sectionId;
    };

    const _objIsString = (obj) => typeof obj === 'string' || obj instanceof String;

    const _loadSectionState = (app, section, sectionId) => {
        const _loadCache = () =>
            Object.keys(app.states.cache).forEach(name => {
                log.debug('Caching new named state for future use:', name);
                RequestUtils.post(`${section.app.url}/states/${name}`, ApiUtils.JSONHeader, app.states.cache[name]).catch(log.warn);
            });

        const _loadNamed = () => {
            log.debug('Loading existing named state:', app.states.load);
            section.app.state = app.states.load;
        };

        const _load = () => {
            log.debug('Loading state configuration');
            RequestUtils.post(`${section.app.url}/instances/${sectionId}/state`, ApiUtils.JSONHeader, app.states.load).catch(log.warn);
        };

        if (!app.states) return;

        /* istanbul ignore else */
        // DEBUG logging is turned on by default, and only turned off in production deployments.
        // The operation of the Constants.Logging.DEBUG flag has been tested elsewhere.
        if (Constants.Logging.DEBUG) {
            log.debug('Got state configuration for app:', JSON.stringify(app.states));
        }

        // Cache or load states if they were provided as a part of the create request.
        if (app.states.cache) _loadCache();
        if (!app.states.load) return;

        // Either a named state or an in-line state configuration can be loaded.
        _objIsString(app.states.load) ? _loadNamed() : _load();
    };

    const _getReadySockets = () => ApiUtils.setToArray(server.wss.clients).filter(c => c.readyState === Constants.WEBSOCKET_READY);

    // Internal utility function to delete section by a given id. This function is used
    // either to delete all sections belonging to a given space, or to delete a specific
    // section by its id.
    const _deleteSectionById = sectionId => {
        const section = server.state.get('sections[' + sectionId + ']');
        if (Utils.isNullOrEmpty(section)) return;

        _messagePeers('deleteSectionById', { params: { id: sectionId } });

        if (ApiUtils.getSpaceBySectionId(sectionId)) {
            ApiUtils.applyPrimaryForSections(ApiUtils.getSpaceBySectionId(sectionId), async (connection, id, link) => ApiUtils.isLocal(link.host)
                ? _deleteSectionById(id)
                : RequestUtils.delete(`${link.protocol}${link.host}/sections/${id}?override=true`, ApiUtils.JSONHeader)
            ).then(log.debug('Successfully deleted replicated sections'));
        }

        if (section?.app?.url) {
            log.debug('Flushing application at URL:', section.app.url);
            RequestUtils.post(`${section.app.url}/instances/${sectionId}/flush`).catch(log.warn);
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

    const _deleteSections = async (space, groupId) => {
        let sections = server.state.get('sections');
        _messagePeers('deleteSections', { query: { space: space, groupId: groupId } });

        if (groupId || space) {
            const map = groupId ? e => { _deleteSectionById(e); return parseInt(e, 10); }
                : ({ index }) => { _deleteSectionById(index); return parseInt(index, 10); };
            const deletedSections = _filterSections(groupId, space, sections, 'Deleted', map);

            log.info('Successfully deleted sections:', deletedSections);
            return deletedSections;
        }

        const spaces = Object.keys(_listSpaces());

        spaces.forEach(space => {
            ApiUtils.applyPrimaryForSections(space, async (connection, id, link) => {
                if (!ApiUtils.isLocal(link.host)) {
                    await RequestUtils.delete(`${link.protocol}${link.host}/sections/${id}?override=true`, ApiUtils.JSONHeader);
                    await ApiUtils.deleteSectionForLinkWrapper(connection, id, link);
                }
            }).then(log.debug('Deleted replicated sections'));
        });

        sections.filter(s => s.app?.url).map(s => {
            log.debug('Flushing application at URL:', s.app.url);
            return s.app.url;
        }).filter((s, i, arr) => arr.indexOf(s) === i).forEach(s => RequestUtils.post(`${s}/instances/flush`).catch(log.warn));

        server.state.set('sections', []);
        server.state.set('groups', []);

        _getReadySockets().filter(c => _isInGeometry(c)).forEach(c => c.safeSend(JSON.stringify({
            appId: Constants.APP_NAME,
            message: { action: Constants.Action.DELETE }
        })));

        log.info('Successfully deleted all sections');
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

    const _readSections = async (space, groupId, geometry, fetchAppStates) => {
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

        for (const i of sectionsToFetch) {
            let s = sections[i];
            let section = { id: i, x: s.x, y: s.y, w: s.w, h: s.h, space: Object.keys(s.spaces)[0] };
            const app = s.app;
            if (app) {
                section.app = { url: app.url, state: app.state, opacity: app.opacity };
            }
            result.push(section);
            const ind = result.length - 1;

            if (app && fetchAppStates) {
                const r = await axios.get(s.app.url + '/instances/' + i + '/state', {
                    adapter: require('axios/lib/adapters/http')
                }).catch((err) => {
                    log.warn(err);
                    numSectionsToFetchState--;
                });
                if (!r) continue;
                result[ind].app.states = { load: r.data };
                numSectionsToFetchState--;
            } else if (fetchAppStates) {
                numSectionsToFetchState--;
            }
        }

        log.debug('Successfully read configuration for sections:', sectionsToFetch);
        return { result: result, numSectionsToFetchState: numSectionsToFetchState };
    };

    // Internal utility function to update section by a given id. This function is used
    // either to update all sections belonging to a given group, or to update a specific
    // section by its id.
    const _updateSectionById = (sectionId, body, space, geometry, app) => {
        let commands = [];
        let oldURL = null;
        app = body ? body.app : app;
        let oldOpacity = null;
        space = body ? body.space : space;
        let section = server.state.get('sections[' + sectionId + ']');
        geometry = body ? { x: body.x, y: body.y, w: body.w, h: body.h } : geometry;

        if (!section) return;
        _messagePeers('updateSectionById', { body: body, params: { id: sectionId } });

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
                RequestUtils.post(`${oldURL}/instances/${sectionId}/flush`).catch(log.warn);
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
                        RequestUtils.post(`${section.app.url}/states/${name}`, ApiUtils.JSONHeader, app.states.cache[name]).catch(log.warn);
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
                        RequestUtils.post(`${section.app.url}/instances/${sectionId}/state`, ApiUtils.JSONHeader, app.states.load).catch(log.warn);
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
            RequestUtils.post(`${oldURL}/instances/${sectionId}/flush`).catch(log.warn);
        }

        // Notify OVE viewers/controllers
        _getReadySockets().forEach(c => commands.filter(m => _isInGeometry(c, m.message.spaces)).forEach(m => c.safeSend(JSON.stringify(m))));

        server.state.set('sections[' + sectionId + ']', section);

        ApiUtils.applyPrimaryForSections(space, async (connection, id, link) => {
            const primaryGeometry = await ApiUtils.getSpaceGeometriesWrapper(connection.primary, _getSpaceGeometries);
            const geometry = await ApiUtils.getSpaceGeometriesWrapper(link, _getSpaceGeometries);
            const resized = ApiUtils.getSectionData(section, primaryGeometry, geometry, link.space);
            const newBody = { ...body, space: link.space, x: resized.x, y: resized.y, w: resized.w, h: resized.h };

            return ApiUtils.isLocal(link.host)
                ? _updateSectionById(id, newBody)
                : RequestUtils.post(`${link.protocol}${link.host}/sections/${id}?override=true`, ApiUtils.JSONHeader, newBody).text;
        }).then(log.debug('Successfully updated replicas'));
    };

    // Internal utility function to transform or move all or some sections.
    const _updateSections = (operation, space, groupId, body, sections) => {
        let rangeError = false;
        let geometries = {};

        const sectionsToUpdate = _filterSections(groupId, space, sections, 'Updating');
        _messagePeers(operation.transform ? 'transformSections' : 'moveSectionsTo', { body: body, query: { space: space, groupId: groupId } });

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

        if (rangeError) return;

        sectionsToUpdate.forEach(e => {
            const section = sections[e];
            let space;
            if (operation.moveTo && operation.moveTo.space) {
                space = operation.moveTo.space;
            }
            _updateSectionById(e, undefined, space, geometries[e], section?.app);
        });

        if (sectionsToUpdate.length === server.state.get('sections').length) {
            log.info('Successfully updated all sections');
        } else {
            log.info('Successfully updated sections:', sectionsToUpdate);
        }

        return sectionsToUpdate;
    };

    // Internal utility function to refresh a section by the given id.
    const _refreshSectionById = sectionId => {
        _messagePeers('refreshSectionById', { params: { id: sectionId } });
        _getReadySockets().forEach(c => c.safeSend(JSON.stringify({
            operation: Constants.Operation.REFRESH,
            sectionId: parseInt(sectionId, 10)
        })));

        ApiUtils.applyPrimaryForSections(ApiUtils.getSpaceBySectionId(sectionId), async (connection, id, link) => ApiUtils.isLocal(link.host)
            ? _refreshSectionById(id)
            : RequestUtils.post(`${link.protocol}${link.host}/sections/${id}/refresh?override=true`, ApiUtils.JSONHeader)
        ).then(log.debug('Successfully refreshed replicated sections'));
    };

    const _refreshSections = (space, groupId) => {
        let sectionsToRefresh = [];

        _messagePeers('refreshSections', { query: { space: space, groupId: groupId } });

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
            const spaces = Object.keys(_listSpaces());
            spaces.forEach(async space => ApiUtils.applyPrimaryForSections(space, async (connection, id, link) => {
                if (!ApiUtils.isLocal(link.host)) {
                    await RequestUtils.post(`${link.protocol}${link.host}/sections/${id}/refresh?override=true`, ApiUtils.JSONHeader);
                }
            }).then(log.debug('Successfully refreshed replicated sections')));
            log.info('Successfully refreshed all sections');
            return;
        }

        sectionsToRefresh.forEach(_refreshSectionById);
        return sectionsToRefresh;
    };

    const _readSectionById = async (sectionId, s, includeAppStates) => {
        const fetchAppStates = ((includeAppStates + '').toLowerCase() === 'true');
        const id = parseInt(sectionId, 10);
        let section = { id, x: s.x, y: s.y, w: s.w, h: s.h, space: Object.keys(s.spaces)[0] };
        const app = s.app;

        if (app) {
            section.app = { url: app.url, state: app.state, opacity: app.opacity };

            if (fetchAppStates) {
                const r = (await axios.get(s.app.url + '/instances/' + id + '/state', {
                    adapter: require('axios/lib/adapters/http')
                }).catch((err) => log.warn(err)))?.data;
                if (r) {
                    section.app.states = { load: r };
                }
            }
        }

        log.debug('Successfully read configuration for section id:', sectionId);
        return section;
    };

    // Internal utility function to delete a group by the given id
    const _deleteGroupById = groupId => {
        _messagePeers('deleteGroupById', { params: { id: groupId } });
        server.state.set('groups[' + groupId + ']', []);

        if (server.state.get('groups').some(e => !Utils.isNullOrEmpty(e))) {
            log.info('Successfully deleted group:', groupId);
        } else {
            server.state.set('groups', []);
            log.info('Successfully deleted all groups');
        }
    };

    const _validateSections = group => {
        const sections = server.state.get('sections');
        return !group.some(e => Utils.isNullOrEmpty(sections[e]) ||
            ApiUtils.isSecondary(ApiUtils.getDefaultLink(ApiUtils.getSpaceForSection(sections[e]))));
    };

    // Internal utility function to create or update a group
    const _createOrUpdateGroup = (groupId, operation, body) => {
        operation === 'create'
            ? _messagePeers('createGroup', { body: body })
            : _messagePeers('updateGroupById', { body: body, params: { id: groupId } });

        server.state.set('groups[' + groupId + ']', body.slice());
        log.info('Successfully ' + operation + 'd group:', groupId);
    };

    return {
        messagePeers: _messagePeers,
        listSpaces: _listSpaces,
        listConnections: _listConnections,
        getSpaceGeometries: _getSpaceGeometries,
        getSectionConnection: _getSectionConnection,
        deleteConnection: _deleteConnection,
        cache: _cache,
        createConnection: _createConnection,
        onEvent: _onEvent,
        distributeEvent: _distributeEvent,
        calculateSectionLayout: _calculateSectionLayout,
        deleteSectionById: _deleteSectionById,
        deleteSections: _deleteSections,
        readSections: _readSections,
        updateSectionById: _updateSectionById,
        filterSections: _filterSections,
        updateSections: _updateSections,
        refreshSectionById: _refreshSectionById,
        refreshSections: _refreshSections,
        readSectionById: _readSectionById,
        deleteGroupById: _deleteGroupById,
        validateSections: _validateSections,
        createOrUpdateGroup: _createOrUpdateGroup,
        createSection: _createSection
    };
};
