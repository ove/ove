const request = require('request');
const HttpStatus = require('http-status-codes');

module.exports = (server, log, Utils, Constants) => {
    // returns the section information for a given id
    const _getSectionForId = (sectionId) => server.state.get('sections').find(s => Number(s.id) === Number(sectionId));
    const _isValidSectionId = (sectionId) => {
        const section = server.state.get(`sections[${sectionId}]`);
        return section !== undefined && !Utils.isNullOrEmpty(section);
    };
    // whether a space is primary within the given connection
    const _isPrimaryForConnection = (connection, space) => space === connection.primary;
    // whether a section is primary within the given connection
    const _sectionIsPrimaryForConnection = (connection, sectionId) => _isPrimaryForConnection(connection, _getSpaceForSection(_getSectionForId(sectionId)));
    // returns the replicated sections for the sectionId
    const _getReplicas = (connection, sectionId) => connection.map.filter(s => Number(s.primary) === Number(sectionId)).map(s => s.secondary);
    // returns the connection corresponding to the space the section with id: sectionId is contained in
    const _getConnectionForSection = (sectionId) => {
        const section = _getSectionForId(sectionId);
        if (!section) return undefined;
        return _getConnection(_getSpaceForSection(section));
    };

    // returns the primary section for the sectionId
    const _getPrimarySection = (connection, sectionId) => connection.map.find(s => Number(s.secondary) === Number(sectionId)).primary;
    const _getSpaceBySectionId = (id) => _getSpaceForSection(_getSectionForId(id));
    const _forEachSpace = (connection, f) => connection.secondary.forEach(s => f(s));

    const _applyPrimary = (space, f) => {
        const connection = _getConnection(space);
        if (connection && connection.isInitialized && _isPrimaryForConnection(connection, space)) {
            f(connection);
        }
    };

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

    const _generateConnection = async (primary, secondary) => {
        let connection;
        if ((await _isConnectedWrapper(primary))) {
            connection = await _getConnectionWrapper(primary);
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
    const _getSpaceForSection = (section) => Object.keys(section.spaces)[0];

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

    const _getConnectionId = (connection) => server.state.get('connections').findIndex(c => c.primary === connection.primary);
    const _getConnectionFromSpace = (space) => server.state.get('connections').find(c => c.primary === space);

    const _getUniqueHosts = (spaces) => _unique(spaces, _elemEquals).map(s => s.host);

    const _elemEquals = (x, y) => x.space === y.space && x.host === y.host;

    // -------------------------------- //

    // whether the space is connected as a primary
    const _isPrimary = (elem) => server.state.get('connections')
        .filter(connection => !Utils.isNullOrEmpty(connection))
        .find(connection => _elemEquals(connection.primary, elem)) !== undefined;

    const _isSecondary = (elem) => server.state.get('connections')
        .filter(connection => !Utils.isNullOrEmpty(connection))
        .find(connection => connection.secondary && connection.secondary.some(s => _elemEquals(s, elem))) !== undefined;

    // whether the space is currently connected, either as primary or secondary
    const _isConnected = (space) => _isPrimary(space) || _isSecondary(space);

    // returns the connection corresponding to the space or undefined if not connected
    const _getConnection = (elem) => {
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
        connection.id = server.state.get('connections').length;
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

    const _deleteSecondarySection = (connection, sectionId) => {
        const id = _getConnectionId(connection);
        connection.map.splice(connection.map.findIndex(s => Number(s.secondary) === Number(sectionId)), 1);
        connection.id = id;
        server.state.set(`connections[${id}]`, connection);
        return connection;
    };

    const _deleteAllForSpace = (connection, space) => _getSectionsForSpace(space).forEach(s => _deleteSecondarySection(connection, s.id));

    const _removeConnection = (elem) => {
        const _remove = (index) => {
            server.state.set(`connections[${index}]`, {});
        };
        const primary = _getConnections().findIndex(connection => _elemEquals(connection.primary, elem));
        _remove(primary !== -1 ? primary : _getConnections()
            .findIndex(connection => connection.secondary && connection.secondary.some(s => _elemEquals(s, elem))));
    };

    // -------------------------------- //

    const post = async (url, headers, body) => new Promise((resolve, reject) =>
        request.post(url, {
            headers: headers,
            json: body
        }, (error, res, b) => {
            if (!Utils.isNullOrEmpty(error)) {
                reject(error);
            } else if (res.statusCode !== HttpStatus.OK) {
                reject(new Error(`Received status code: ${res.statusCode} and reason: ${b} when connecting to: ${url}`));
            } else {
                resolve(b);
            }
        }));

    const del = async (url, headers, body) => new Promise((resolve, reject) =>
        request.delete(url, { headers: headers, json: body || {} }, (error, res, b) => {
            if (!Utils.isNullOrEmpty(error)) {
                reject(error);
            } else if (res.statusCode !== HttpStatus.OK) {
                reject(new Error(`Received status code: ${res.statusCode} and reason: ${b} when connecting to: ${url}`));
            } else {
                resolve(b);
            }
        }));

    const get = async (url, headers, body) => new Promise((resolve, reject) =>
        request.get(url, { headers: headers, json: body || {} }, (error, res, b) => {
            if (!Utils.isNullOrEmpty(error)) {
                reject(error);
            } else if (res.statusCode !== HttpStatus.OK) {
                reject(new Error(`Received status code: ${res.statusCode} and reason: ${b} when connecting to: ${url}`));
            } else {
                resolve(b);
            }
        }));

    // -------------------------------- //

    // whether the space is connected as a secondary
    const _isSecondaryWrapper = async (elem) =>
        (await get(
            `${Constants.HTTP_PROTOCOL}${elem.host}/connection/api/isSecondary`,
            { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
            elem
        ).catch(log.warn)).isSecondary;

    const _isPrimaryWrapper = async (elem) => (await get(
        `${Constants.HTTP_PROTOCOL}${elem.host}/connection/api/isPrimary`,
        { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
        elem
    ).catch(log.warn)).isPrimary;

    const _isConnectedWrapper = async (elem) => (await get(
        `${Constants.HTTP_PROTOCOL}${elem.host}/connection/api/isConnected`,
        { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
        elem
    ).catch(log.warn)).isConnected;

    const _getConnectionWrapper = async (elem) => (await get(
        `${Constants.HTTP_PROTOCOL}${elem.host}/connection/api/getConnection`,
        { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
        elem
    ).catch(log.warn)).connection;

    const _updateConnectionStateWrapper = async (host, connection) => post(
        `${Constants.HTTP_PROTOCOL}${host}/connection/api/updateConnectionState`,
        { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
        connection
    ).catch(log.warn);

    // updates/creates connection for connection
    const _updateConnectionWrapper = async (primary, secondary) => {
        const connection = await _generateConnection(primary, secondary);
        await post(
            `${Constants.HTTP_PROTOCOL}${primary.host}/connection/api/updateConnection`,
            { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
            connection
        ).catch(log.warn);
        if (primary.host !== secondary.host) {
            await post(
                `${Constants.HTTP_PROTOCOL}${secondary.host}/connection/api/updateConnection`,
                { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                connection
            ).catch(log.warn);
        }
        return connection;
    };

    const _replicateWrapper = async (connection, section, id) => {
        const mapping = { primary: section.id, secondary: id };
        connection.map = !connection.map ? [mapping] : [...connection.map, mapping];

        await post(
            `${Constants.HTTP_PROTOCOL}${connection.primary.host}/connection/api/updateConnectionState`,
            { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
            connection
        ).catch(log.warn);
        for (const s of connection.secondary.filter(s => s.host !== connection.primary.host)) {
            await post(
                `${Constants.HTTP_PROTOCOL}${s.host}/connection/api/updateConnectionState`,
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
            for (const secondary of connection.secondary) {
                await del(
                    `${Constants.HTTP_PROTOCOL}${secondary.host}/connection/${connection.primary.space}/${secondary.space}`,
                    { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                    { primary: connection.primary.host, secondary: secondary.host }
                );
            }
        }
    };

    const _disconnectSpaceWrapper = async elem => {
        const connection = await _getConnectionWrapper(elem);
        if (connection.secondary.length > 1) {
            for (const host of _getUniqueHosts(connection.secondary)) {
                await del(
                    `${Constants.HTTP_PROTOCOL}${host}/connection/api/deleteSpace`,
                    { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                    { primary: connection.primary, elem: elem }
                );
                await del(
                    `${Constants.HTTP_PROTOCOL}${host}/connection/api/deleteAllForSpace`,
                    { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                    { primary: connection.primary, elem: elem }
                );
            }
        } else {
            for (const host of _getUniqueHosts([connection.primary].concat(connection.secondary))) {
                await del(
                    `${Constants.HTTP_PROTOCOL}${host}/connection/api/removeConnection`,
                    { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                    connection.primary
                );
            }
        }
    };

    const _removeConnectionWrapper = async elem => {
        const connection = _getConnectionFromSpace(elem.space);
        for (const host of _getUniqueHosts([connection.primary] + connection.secondary)) {
            await del(
                `${Constants.HTTP_PROTOCOL}${host}/connection/removeConnection`,
                { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                elem
            );
        }
    };

    // -------------------------------- //

    return {
        getSectionForId: _getSectionForId,
        isValidSectionId: _isValidSectionId,
        isPrimaryForConnection: _isPrimaryForConnection,
        sectionIsPrimaryForConnection: _sectionIsPrimaryForConnection,
        getReplicas: _getReplicas,
        getConnectionForSection: _getConnectionForSection,
        getPrimarySection: _getPrimarySection,
        getSpaceBySectionId: _getSpaceBySectionId,
        deleteSecondarySection: _deleteSecondarySection,
        deleteSpace: _deleteSpace,
        deleteAllForSpace: _deleteAllForSpace,
        forEachSpace: _forEachSpace,
        applyPrimary: _applyPrimary,

        generateConnection: _generateConnection,
        getSpaceForSection: _getSpaceForSection,
        getSectionsForSpace: _getSectionsForSpace,
        getSectionData: _getSectionData,
        getConnections: _getConnections,
        getElem: _getElem,
        getConnectionFromSpace: _getConnectionFromSpace,
        elemEquals: _elemEquals,

        isPrimary: _isPrimary,
        isSecondary: _isSecondary,
        isConnected: _isConnected,
        getConnection: _getConnection,
        updateConnectionState: _updateConnectionState,
        updateConnection: _updateConnection,
        removeConnection: _removeConnection,

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
        removeConnectionWrapper: _removeConnectionWrapper
    };
};
