const RequestUtils = require('./request-utils');
const get = RequestUtils.get;
const post = RequestUtils.post;
const del = RequestUtils.delete;

module.exports = (server, log, Utils, Constants) => {
    // -------------------------------- //
    const _isLocal = host => host === process.env.OVE_HOST;

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

    const _deleteSpace = (connection, elem) => {
        const id = _getConnectionId(connection);
        connection.secondary.splice(connection.secondary.findIndex(s => _elemEquals(s, elem)), 1);
        connection.id = id;
        server.state.set(`connections[${id}]`, connection);
        return connection;
    };

    const _deleteSecondarySection = (connection, sectionId, elem) => {
        const id = _getConnectionId(connection);
        connection.map.splice(connection.map.findIndex(s => Number(s.secondary) === Number(sectionId) && _elemEquals(s.elem, elem)), 1);
        connection.id = id;
        server.state.set(`connections[${id}]`, connection);
        return connection;
    };

    const _deleteAllForSpace = (primary, secondary) => _getSectionsForSpace(secondary.space).forEach(s => _deleteSecondarySection(_getConnection(primary), s.id, secondary));

    const _removeConnection = elem => {
        const _remove = (index) => server.state.set(`connections[${index}]`, {});
        const primary = _getConnections().findIndex(connection => _elemEquals(connection.primary, elem));
        _remove(primary !== -1 ? primary : _getConnections()
            .findIndex(connection => connection.secondary && connection.secondary.some(s => _elemEquals(s, elem))));
    };

    // returns the section information for a given id
    const _getURLForId = sectionId => server.state.get('sections').find(s => Number(s.id) === Number(sectionId)).app.url;

    // -------------------------------- //

    // whether the space is connected as a secondary
    const _isSecondaryWrapper = async elem => _isLocal(elem.host)
        ? _isSecondary(elem)
        : (await get(
            `${Constants.HTTP_PROTOCOL}${elem.host}/api/isSecondary?override=true`,
            { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
            elem
        ).catch(log.warn)).isSecondary;

    const _isPrimaryWrapper = async elem => _isLocal(elem.host)
        ? _isPrimary(elem)
        : (await get(
            `${Constants.HTTP_PROTOCOL}${elem.host}/api/isPrimary?override=true`,
            { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
            elem
        ).catch(log.warn)).isPrimary;

    const _isConnectedWrapper = async elem => _isLocal(elem.host)
        ? _isConnected(elem)
        : (await get(
            `${Constants.HTTP_PROTOCOL}${elem.host}/api/isConnected?override=true`,
            { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
            elem
        ).catch(log.warn)).isConnected;

    const _getConnectionWrapper = async elem => _isLocal(elem.host)
        ? _getConnection(elem)
        : (await get(
            `${Constants.HTTP_PROTOCOL}${elem.host}/api/getConnection?override=true`,
            { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
            elem
        ).catch(log.warn)).connection;

    const _updateConnectionStateWrapper = async (host, connection) => _isLocal(host)
        ? _updateConnectionState(connection)
        : post(
            `${Constants.HTTP_PROTOCOL}${host}/api/updateConnectionState?override=true`,
            { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
            connection
        ).catch(log.warn);

    // updates/creates connection for connection
    const _updateConnectionWrapper = async (primary, secondary) => {
        const connection = _generateConnection(primary, secondary);
        await _forEachSecondary(connection, async (connection, s) => {
            if (primary.host !== s.host) {
                _isLocal(s.host)
                    ? _updateConnection(connection)
                    : await post(
                        `${Constants.HTTP_PROTOCOL}${s.host}/api/updateConnection?override=true`,
                        { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                        { connection: connection, host: s.host }
                    );
            }
        });
        _isLocal(primary.host)
            ? _updateConnection(connection)
            : await post(
                `${Constants.HTTP_PROTOCOL}${primary.host}/api/updateConnection`,
                { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                connection
            );
        return connection;
    };

    const _replicateWrapper = async (connection, section, id, elem) => {
        const mapping = { primary: section.id, secondary: id, elem: elem };
        connection.map = !connection.map ? [mapping] : [...connection.map, mapping];

        _isLocal(connection.primary.host)
            ? _updateConnectionState(connection)
            : await post(
                `${Constants.HTTP_PROTOCOL}${connection.primary.host}/api/updateConnectionState`,
                { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                connection
            ).catch(log.warn);
        for (const s of connection.secondary.filter(s => s.host !== connection.primary.host)) {
            _isLocal(s.host)
                ? _updateConnectionState(connection)
                : await post(
                    `${Constants.HTTP_PROTOCOL}${s.host}/api/updateConnectionState?override=true`,
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
            if (_isLocal(connection.primary.host)) { continue; }
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
            for (const host of hosts) {
                _isLocal(host)
                    ? _deleteSpace(connection, elem)
                    : await del(
                        `${Constants.HTTP_PROTOCOL}${host}/api/deleteSpace?override=true`,
                        { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                        { primary: connection.primary, elem: elem, host: host }
                    );
                _isLocal(host)
                    ? _deleteAllForSpace(connection.primary, elem)
                    : await del(
                        `${Constants.HTTP_PROTOCOL}${host}/api/deleteAllForSpace?override=true`,
                        { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                        { primary: connection.primary, elem: elem, host: host }
                    );
            }
        } else {
            _isLocal(connection.primary.host)
                ? _removeConnection(connection.primary)
                : await del(
                    `${Constants.HTTP_PROTOCOL}${connection.primary.host}/api/removeConnection`,
                    { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                    connection.primary
                );
        }
    };

    const _deleteSecondarySectionWrapper = async (connection, id, elem) => {
        for (const host of _getUniqueHosts([connection.primary].concat(connection.secondary))) {
            _isLocal(host)
                ? _deleteSecondarySection(connection, id, elem)
                : await del(
                    `${Constants.HTTP_PROTOCOL}${host}/api/deleteSecondarySection/${id}?override=true`,
                    { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                    { primary: connection.primary, elem: elem }
                );
        }
    };

    const _removeConnectionWrapper = async (connection, elem) => {
        for (const host of _getUniqueHosts([connection.primary].concat(connection.secondary))) {
            _isLocal(host)
                ? _removeConnection(elem)
                : await del(
                    `${Constants.HTTP_PROTOCOL}${host}/api/removeConnection?override=true`,
                    { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                    elem
                );
        }
    };

    const _getURLForIdWrapper = async (host, id) => _isLocal(host)
        ? _getURLForId(id)
        : (await get(
            `${Constants.HTTP_PROTOCOL}${host}/api/getURLForId/${id}?override=true`,
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
        isLocal: _isLocal,
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
