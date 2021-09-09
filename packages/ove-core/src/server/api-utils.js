const request = require('request');
const HttpStatus = require('http-status-codes');

module.exports = (server, log, Utils, Constants) => {
    // -------------------------------- //

    const _unique = (xs, handler) => {
        const arr = [];
        for (let i = 0; i < xs.length; i++) {
            if (!arr.some(a => handler(a, xs[i]))) {
                arr.push(xs[i]);
            }
        }
        return arr;
    };

    const _getSpaceBySectionId = (id) => _getSpaceForSection(_getSectionForId(id));

    const _getSectionForId = (id) => server.state.get('sections').find(section => Number(section.id) === Number(id));

    const _isValidSectionId = (sectionId) => !Utils.isNullOrEmpty(server.state.get(`sections[${sectionId}]`));

    // returns the replicated sections for the sectionId
    const _getReplicas = (connection, sectionId) => connection.map.filter(s => Number(s.primary) === Number(sectionId));

    const _generateConnection = (primary, secondary) => {
        let connection;
        if (_isConnected(primary)) {
            connection = _getConnection(primary);
            connection.secondary = [...connection.secondary, secondary];
        } else {
            connection = {
                isInitialized: false,
                primary: primary,
                secondary: [secondary]
            };
        }
        return connection;
    };

    // returns the space for a section
    const _getSpaceForSection = (section) => section ? Object.keys(section.spaces)[0] : undefined;

    const _getSectionsForSpace = (elem) => server.state.get('sections').filter(section => !Utils.isNullOrEmpty(section) && _getSpaceForSection(section) === elem.space);

    const _getSectionData = function (section, primary, secondary, title) {
        const resize = (primary, secondary, x, y, w, h) => {
            const widthFactor = Number(secondary.w) / Number(primary.w);
            const heightFactor = Number(secondary.h) / Number(primary.h);
            return {
                x: Math.floor(x * widthFactor),
                y: Math.floor(y * heightFactor),
                w: Math.floor(w * widthFactor),
                h: Math.floor(h * heightFactor)
            };
        };

        const coordinates = resize(primary, secondary, Number(section.x), Number(section.y), Number(section.w), Number(section.h));
        return {
            space: title,
            x: coordinates.x,
            y: coordinates.y,
            w: coordinates.w,
            h: coordinates.h,
            app: section.app
        };
    };

    const _getConnections = () => {
        const connections = [];
        for (let i = 0; i < server.state.get('connections').length; i++) {
            const connection = server.state.get(`connections[${i}]`);
            if (!Utils.isNullOrEmpty(connection)) {
                connections.push(connection);
            }
        }
        return connections;
    };

    const _getElem = (space) => {
        const connection = _getConnections().filter(c => c.primary.space === space || c.secondary.map(s => s.space).includes(space))[0];
        if (connection.primary.space === space) return connection.primary;
        return connection.secondary.find(s => s.space === space);
    };

    const _getConnectionId = (connection) => _getConnections().findIndex(c => !Utils.isNullOrEmpty(c) && _elemEquals(c.primary, connection.primary));

    const _getUniqueHosts = (spaces) => _unique(spaces, (x, y) => x.host === y.host).map(s => s.host);

    const _elemEquals = (x, y) => x.space === y.space && x.host === y.host;

    const _getDefaultElem = space => ({ space: space, host: process.env.OVE_HOST });

    // whether a space is primary within the given connection
    const _isPrimaryForConnection = (connection, elem) => _elemEquals(connection.primary, elem);

    // returns the primary section for the sectionId
    const _getPrimarySection = (connection, sectionId, elem) => connection.map.find(s => Number(s.secondary) === Number(sectionId) && _elemEquals(s.elem, elem)).primary;

    const _getMappingsForSecondary = (connection, elem) => connection.map ? connection.map.filter(x => _elemEquals(x.elem, elem)).map(({ secondary }) => secondary) : [];

    const _filterWithIndex = (arr, handler) => arr.map((x, i) => ({ index: i, value: x })).filter(({ value }) => handler(value));

    const _setToArray = set => {
        const arr = [];
        set.forEach(x => arr.push(x));
        return arr;
    };

    // -------------------------------- //

    // whether the space is connected as a primary
    const _isPrimary = (elem) => server.state.get('connections')
        .filter(connection => !Utils.isNullOrEmpty(connection))
        .find(connection => _elemEquals(connection.primary, elem)) !== undefined;

    const _isSecondary = (elem) => server.state.get('connections')
        .filter(connection => !Utils.isNullOrEmpty(connection))
        .find(connection => connection.secondary && connection.secondary.some(s => _elemEquals(s, elem))) !== undefined;

    // whether the space is currently connected, either as primary or secondary
    const _isConnected = (elem) => _isPrimary(elem) || _isSecondary(elem);

    // returns the connection corresponding to the space or undefined if not connected
    const _getConnection = elem => {
        if (server.state.get('connections').length === 0) return;
        const primary = server.state.get('connections')
            .filter(connection => !Utils.isNullOrEmpty(connection))
            .find(connection => _elemEquals(connection.primary, elem));
        const secondary = server.state.get('connections')
            .filter(connection => !Utils.isNullOrEmpty(connection))
            .find(connection => connection.secondary.some(s => _elemEquals(s, elem)));
        return !primary ? secondary : primary;
    };

    const _updateConnectionState = (connection, gen) => {
        const id = gen ? connection.id : _getConnectionId(connection);
        connection.id = id;
        server.state.set(`connections[${id}]`, connection);
    };

    const _updateConnection = (connection) => {
        if (connection.id !== undefined) {
            connection.id = _getConnectionId(connection);
        } else {
            connection.id = server.state.get('connections').length;
        }

        _updateConnectionState(connection, true);

        return connection;
    };

    const _deleteSpace = async (connection, elem) => {
        const id = _getConnectionId(connection);
        connection.secondary.splice(connection.secondary.findIndex(s => _elemEquals(s, elem)), 1);
        connection.id = id;
        server.state.set(`connections[${id}]`, connection);
        return connection;
    };

    const _deleteSecondarySection = (connection, sectionId, elem) => {
        const id = _getConnectionId(connection);
        log.debug('elem:', elem);
        connection.map.splice(connection.map.findIndex(s => Number(s.secondary) === Number(sectionId) && _elemEquals(s.elem, elem)), 1);
        connection.id = id;
        server.state.set(`connections[${id}]`, connection);
        return connection;
    };

    const _deleteAllForSpace = (primary, secondary) => _getSectionsForSpace(secondary.space).forEach(s => _deleteSecondarySection(_getConnection(primary), s.id, secondary));

    const _removeConnection = (elem) => {
        const _remove = (index) => server.state.set(`connections[${index}]`, {});
        const primary = _getConnections().findIndex(connection => _elemEquals(connection.primary, elem));
        _remove(primary !== -1 ? primary : _getConnections()
            .findIndex(connection => connection.secondary && connection.secondary.some(s => _elemEquals(s, elem))));
    };

    // returns the section information for a given id
    const _getURLForId = (sectionId) => server.state.get('sections').find(s => Number(s.id) === Number(sectionId)).app.url;

    // -------------------------------- //

    const _defaultError = (resolve, reject, url, error, res, b) => {
        if (!Utils.isNullOrEmpty(error)) {
            reject(error);
        } else if (res?.statusCode !== HttpStatus.OK) {
            reject(new Error(`Received status code: ${res?.statusCode} and reason: ${JSON.stringify(b)} when connecting to: ${url}`));
        } else {
            resolve(b);
        }
    };

    const post = async (url, headers, body, handler) => new Promise((resolve, reject) =>
        request.post(url, {
            headers: headers,
            json: body
        }, (handler || _defaultError).bind(null, resolve, reject, url)));

    const del = async (url, headers, body, handler) => new Promise((resolve, reject) =>
        request.delete(url, {
            headers: headers,
            json: body || {}
        }, (handler || _defaultError).bind(null, resolve, reject, url)));

    const get = async (url, headers, body, handler) => new Promise((resolve, reject) =>
        request.get(url, {
            headers: headers,
            json: body || {}
        }, (handler || _defaultError).bind(null, resolve, reject, url)));

    // -------------------------------- //

    // whether the space is connected as a secondary
    const _isSecondaryWrapper = async (elem) =>
        (await get(
            `${Constants.HTTP_PROTOCOL}${elem.host}/api/isSecondary`,
            { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
            elem
        ).catch(log.warn)).isSecondary;

    const _isPrimaryWrapper = async elem => (await get(
        `${Constants.HTTP_PROTOCOL}${elem.host}/api/isPrimary`,
        { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
        elem
    ).catch(log.warn)).isPrimary;

    const _isConnectedWrapper = async elem => {
        log.debug('elem:', elem);
        const v = (await get(
            `${Constants.HTTP_PROTOCOL}${elem.host}/api/isConnected`,
            { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
            elem
        ).catch(log.warn));
        log.debug('v:', v);
        return v.isConnected;
    };

    const _getConnectionWrapper = async elem => (await get(
        `${Constants.HTTP_PROTOCOL}${elem.host}/api/getConnection`,
        { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
        elem
    ).catch(log.warn)).connection;

    const _updateConnectionStateWrapper = async (host, connection) => post(
        `${Constants.HTTP_PROTOCOL}${host}/api/updateConnectionState`,
        { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
        connection
    ).catch(log.warn);

    // updates/creates connection for connection
    const _updateConnectionWrapper = async (primary, secondary) => {
        const connection = _generateConnection(primary, secondary);
        await _forEachSecondary(connection, async (connection, s) => {
            if (primary.host !== s.host) {
                await post(
                    `${Constants.HTTP_PROTOCOL}${s.host}/api/updateConnection`,
                    { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                    { connection: connection, host: s.host }
                );
            }
        });
        await post(
            `${Constants.HTTP_PROTOCOL}${primary.host}/api/updateConnection`,
            { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
            connection
        );
        return connection;
    };

    const _replicateWrapper = async (connection, section, id, elem) => {
        const mapping = { primary: section.id, secondary: id, elem: elem };
        connection.map = !connection.map ? [mapping] : [...connection.map, mapping];

        await post(
            `${Constants.HTTP_PROTOCOL}${connection.primary.host}/api/updateConnectionState`,
            { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
            connection
        ).catch(log.warn);
        for (const s of connection.secondary.filter(s => s.host !== connection.primary.host)) {
            await post(
                `${Constants.HTTP_PROTOCOL}${s.host}/api/updateConnectionState`,
                { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                connection
            ).catch(log.warn);
        }

        return mapping;
    };

    const _clearConnectionsWrapper = async () => {
        const connections = _getConnections();
        server.state.set('connections', []);

        for (const connection of connections) {
            await del(
                `${Constants.HTTP_PROTOCOL}${connection.primary.host}/connection/${connection.primary.space}`,
                { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                { primary: connection.primary.host },
                resolve => resolve()
            );
        }
    };

    const _disconnectSpaceWrapper = async (connection, elem) => {
        if (connection.secondary.length > 1) {
            const hosts = _getUniqueHosts([connection.primary].concat(connection.secondary));
            log.debug('hosts: ', hosts);
            for (const host of hosts) {
                await del(
                    `${Constants.HTTP_PROTOCOL}${host}/api/deleteSpace`,
                    { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                    { primary: connection.primary, elem: elem, host: host }
                );
                await del(
                    `${Constants.HTTP_PROTOCOL}${host}/api/deleteAllForSpace`,
                    { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                    { primary: connection.primary, elem: elem, host: host }
                );
            }
        } else {
            await del(
                `${Constants.HTTP_PROTOCOL}${connection.primary.host}/api/removeConnection`,
                { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                connection.primary
            );
        }
    };

    const _deleteSecondarySectionWrapper = async (connection, id, elem) => {
        for (const host of _getUniqueHosts([connection.primary].concat(connection.secondary))) {
            await del(
                `${Constants.HTTP_PROTOCOL}${host}/api/deleteSecondarySection/${id}`,
                { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                { primary: connection.primary, elem: elem }
            );
        }
    };

    const _removeConnectionWrapper = async (connection, elem) => {
        for (const host of _getUniqueHosts([connection.primary].concat(connection.secondary))) {
            await del(
                `${Constants.HTTP_PROTOCOL}${host}/api/removeConnection`,
                { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                elem
            );
        }
    };

    const _getURLForIdWrapper = async (host, id) => (await get(
        `${Constants.HTTP_PROTOCOL}${host}/api/getURLForId/${id}`,
        { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON }
    )).url;

    const _forEachSecondarySection = async (connection, f) => Promise.all(connection.secondary.map(async s => Promise.all(_getMappingsForSecondary(connection, s).map(async (id) => f(connection, id, s)))));

    const _forEachSecondary = async (connection, f) => Promise.all(connection.secondary.map(s => f(connection, s)));

    const _applyPrimaryForSections = async (space, f) => {
        const elem = _getDefaultElem(space);
        const connection = _getConnection(elem);

        if (connection && connection.isInitialized && _isPrimaryForConnection(connection, elem)) {
            await _forEachSecondarySection(connection, f);
        }
    };

    const _applyPrimary = async (space, f) => {
        const elem = _getDefaultElem(space);
        const connection = _getConnection(elem);

        if (connection && connection.isInitialized && _isPrimaryForConnection(connection, elem)) {
            await _forEachSecondary(connection, f);
        }
    };

    // -------------------------------- //

    return {
        getSpaceBySectionId: _getSpaceBySectionId,
        getSectionForId: _getSectionForId,
        generateConnection: _generateConnection,
        getSpaceForSection: _getSpaceForSection,
        getSectionsForSpace: _getSectionsForSpace,
        getSectionData: _getSectionData,
        getConnections: _getConnections,
        getElem: _getElem,
        elemEquals: _elemEquals,
        isValidSectionId: _isValidSectionId,
        getDefaultElem: _getDefaultElem,
        isPrimaryForConnection: _isPrimaryForConnection,
        getReplicas: _getReplicas,
        getPrimarySection: _getPrimarySection,
        getMappingsForSecondary: _getMappingsForSecondary,
        filterWithIndex: _filterWithIndex,
        setToArray: _setToArray,

        isPrimary: _isPrimary,
        isSecondary: _isSecondary,
        isConnected: _isConnected,
        getConnection: _getConnection,
        updateConnectionState: _updateConnectionState,
        updateConnection: _updateConnection,
        removeConnection: _removeConnection,
        getURLForId: _getURLForId,
        deleteSecondarySection: _deleteSecondarySection,
        deleteSpace: _deleteSpace,
        deleteAllForSpace: _deleteAllForSpace,

        post: post,
        del: del,
        get: get,

        isPrimaryWrapper: _isPrimaryWrapper,
        isSecondaryWrapper: _isSecondaryWrapper,
        isConnectedWrapper: _isConnectedWrapper,
        getConnectionWrapper: _getConnectionWrapper,
        updateConnectionStateWrapper: _updateConnectionStateWrapper,
        updateConnectionWrapper: _updateConnectionWrapper,
        replicateWrapper: _replicateWrapper,
        clearConnectionsWrapper: _clearConnectionsWrapper,
        disconnectSpaceWrapper: _disconnectSpaceWrapper,
        removeConnectionWrapper: _removeConnectionWrapper,
        getURLForIdWrapper: _getURLForIdWrapper,
        deleteSecondarySectionWrapper: _deleteSecondarySectionWrapper,
        forEachSecondarySection: _forEachSecondarySection,
        forEachSecondary: _forEachSecondary,
        applyPrimaryForSections: _applyPrimaryForSections,
        applyPrimary: _applyPrimary
    };
};
