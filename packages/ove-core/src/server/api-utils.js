const RequestUtils = require('./request-utils');

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

    const _getSpaceBySectionId = id => _getSpaceForSection(_getSectionForId(id));

    const _getSectionForId = id => server.state.get('sections').find(section => section.id === id);

    const _isValidSectionId = sectionId => !Utils.isNullOrEmpty(server.state.get(`sections[${sectionId}]`));

    // returns the replicated sections for the sectionId
    const _getReplicas = (connection, sectionId) => connection.sections.filter(s => s.primary === sectionId);

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
    const _getSpaceForSection = section => section ? Object.keys(section.spaces)[0] : undefined;

    const _getSectionsForSpace = elem =>
        server.state.get('sections').filter(section => !Utils.isNullOrEmpty(section) && _getSpaceForSection(section) === elem.space);

    const _getSectionData = (section, primary, secondary, space) => {
        const widthFactor = secondary.w / primary.w;
        const heightFactor = secondary.h / primary.h;
        return {
            space: space,
            x: Math.floor(section.x * widthFactor),
            y: Math.floor(section.y * heightFactor),
            w: Math.floor(section.w * widthFactor),
            h: Math.floor(section.h * heightFactor),
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

    const _getConnectionId = connection => _getConnections().findIndex(c => !Utils.isNullOrEmpty(c) && _elemEquals(c.primary, connection.primary));

    const _getUniqueHosts = spaces => _unique(spaces, (x, y) => x.host === y.host);

    const _elemEquals = (x, y) => x.space === y.space && x.host === y.host;

    const _getDefaultElem = space => ({ space: space, host: process.env.OVE_HOST });

    // whether a space is primary within the given connection
    const _isPrimaryForConnection = (connection, elem) => _elemEquals(connection.primary, elem);

    // returns the primary section for the sectionId
    const _getPrimarySection = (connection, sectionId, elem) => connection.sections.find(s => Number(s.secondary) === Number(sectionId) && _elemEquals(s.elem, elem)).primary;

    const _getMappingsForSecondary = (connection, elem) => connection.sections ? connection.sections.filter(x => _elemEquals(x.elem, elem)).map(({ secondary }) => secondary) : [];

    const _filterWithIndex = (arr, handler) => arr.map((x, i) => ({ index: i, value: x })).filter(({ value }) => handler(value));

    const _setToArray = set => {
        const arr = [];
        set.forEach(x => arr.push(x));
        return arr;
    };

    // -------------------------------- //

    // whether the space is connected as a primary
    const _isPrimary = elem => server.state.get('connections')
        .filter(connection => !Utils.isNullOrEmpty(connection))
        .find(connection => _elemEquals(connection.primary, elem)) !== undefined;

    const _isSecondary = elem => server.state.get('connections')
        .filter(connection => !Utils.isNullOrEmpty(connection))
        .find(connection => connection.secondary && connection.secondary.some(s => _elemEquals(s, elem))) !== undefined;

    // whether the space is currently connected, either as primary or secondary
    const _isConnected = elem => _isPrimary(elem) || _isSecondary(elem);

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
        connection.sections.splice(connection.sections.findIndex(s => Number(s.secondary) === Number(sectionId) && _elemEquals(s.elem, elem)), 1);
        connection.id = id;
        server.state.set(`connections[${id}]`, connection);
        return connection;
    };

    const _deleteAllForSpace = (primary, secondary) => {
        let connection = _getConnection(primary);
        connection.sections
            .filter(({ elem }) => _elemEquals(elem, secondary))
            .map(({ secondary }) => secondary)
            .forEach(s => { connection = _deleteSecondarySection(connection, s, secondary); });
        return connection;
    };

    const _removeConnection = elem => {
        const _remove = (index) => server.state.set(`connections[${index}]`, {});
        const primary = _getConnections().findIndex(connection => _elemEquals(connection.primary, elem));
        _remove(primary !== -1 ? primary : _getConnections()
            .findIndex(connection => connection.secondary && connection.secondary.some(s => _elemEquals(s, elem))));
    };

    // returns the section information for a given id
    const _getURLForId = sectionId => server.state.get(`sections[${sectionId}]`)?.app?.url;

    // -------------------------------- //

    // whether the space is connected as a secondary
    const _isSecondaryWrapper = async elem => _isLocal(elem.host)
        ? _isSecondary(elem)
        : (await RequestUtils.get(
            `${elem.protocol}${elem.host}/api/isSecondary?override=true`,
            { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
            elem
        ).catch(log.warn)).isSecondary;

    const _isPrimaryWrapper = async elem => _isLocal(elem.host)
        ? _isPrimary(elem)
        : (await RequestUtils.get(
            `${elem.protocol}${elem.host}/api/isPrimary?override=true`,
            { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
            elem
        ).catch(log.warn)).isPrimary;

    const _isConnectedWrapper = async elem => _isLocal(elem.host)
        ? _isConnected(elem)
        : (await RequestUtils.get(
            `${elem.protocol}${elem.host}/api/isConnected?override=true`,
            { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
            elem
        ).catch(log.warn)).isConnected;

    const _getConnectionWrapper = async elem => _isLocal(elem.host)
        ? _getConnection(elem)
        : (await RequestUtils.get(
            `${elem.protocol}${elem.host}/api/getConnection?override=true`,
            { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
            elem
        ).catch(log.warn)).connection;

    const _updateConnectionStateWrapper = async (elem, connection) => _isLocal(elem.host)
        ? _updateConnectionState(connection)
        : RequestUtils.post(
            `${elem.protocol}${elem.host}/api/updateConnectionState?override=true`,
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
                    : await RequestUtils.post(
                        `${s.protocol}${s.host}/api/updateConnection?override=true`,
                        { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                        { connection: connection, host: s.host }
                    );
            }
        });
        _isLocal(primary.host)
            ? _updateConnection(connection)
            : await RequestUtils.post(
                `${primary.protocol}${primary.host}/api/updateConnection`,
                { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                connection
            );
        return connection;
    };

    const _replicateWrapper = async (connection, section, id, elem) => {
        const mapping = { primary: section.id, secondary: id, elem: elem };
        connection.sections = !connection.sections ? [mapping] : [...connection.sections, mapping];

        _isLocal(connection.primary.host)
            ? _updateConnectionState(connection)
            : await RequestUtils.post(
                `${connection.primary.protocol}${connection.primary.host}/api/updateConnectionState`,
                { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                connection
            ).catch(log.warn);
        for (const s of connection.secondary.filter(s => s.host !== connection.primary.host)) {
            _isLocal(s.host)
                ? _updateConnectionState(connection)
                : await RequestUtils.post(
                    `${s.protocol}${s.host}/api/updateConnectionState?override=true`,
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
            await RequestUtils.delete(
                `${connection.primary.protocol}${connection.primary.host}/connection/${connection.primary.space}`,
                { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                { primary: connection.primary.host },
                resolve => resolve()
            );
        }
    };

    const _disconnectSpaceWrapper = async (connection, elem) => {
        if (connection.secondary.length > 1) {
            const hosts = _getUniqueHosts([connection.primary].concat(connection.secondary));
            for (const { protocol, host } of hosts) {
                _isLocal(host)
                    ? _deleteSpace(connection, elem)
                    : await RequestUtils.delete(
                        `${protocol}${host}/api/deleteSpace?override=true`,
                        { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                        { primary: connection.primary, elem: elem }
                    );
                _isLocal(host)
                    ? _deleteAllForSpace(connection.primary, elem)
                    : await RequestUtils.delete(
                        `${protocol}${host}/api/deleteAllForSpace?override=true`,
                        { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                        { primary: connection.primary, elem: elem }
                    );
            }
        } else {
            for (const { protocol, host } of _getUniqueHosts([connection.primary].concat(connection.secondary))) {
                _isLocal(host)
                    ? _removeConnection(connection.primary)
                    : await RequestUtils.delete(
                        `${protocol}${host}/api/removeConnection`,
                        { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                        connection.primary
                    );
            }
        }
    };

    const _deleteSecondarySectionWrapper = async (connection, id, elem) => {
        for (const { protocol, host } of _getUniqueHosts([connection.primary].concat(connection.secondary))) {
            _isLocal(host)
                ? _deleteSecondarySection(connection, id, elem)
                : await RequestUtils.delete(
                    `${protocol}${host}/api/deleteSecondarySection/${id}?override=true`,
                    { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                    { primary: connection.primary, elem: elem }
                );
        }
    };

    const _removeConnectionWrapper = async (connection, elem) => {
        for (const { protocol, host } of _getUniqueHosts([connection.primary].concat(connection.secondary))) {
            _isLocal(host)
                ? _removeConnection(elem)
                : await RequestUtils.delete(
                    `${protocol}${host}/api/removeConnection?override=true`,
                    { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON },
                    elem
                );
        }
    };

    const _getURLForIdWrapper = async (elem, id) => _isLocal(elem.host)
        ? _getURLForId(id)
        : (await RequestUtils.get(
            `${elem.protocol}${elem.host}/api/getURLForId/${id}?override=true`,
            { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON }
        )).url;

    const _forEachSecondarySection = async (connection, f) => Promise.all(connection.secondary.map(async s =>
        Promise.all(_getMappingsForSecondary(connection, s).map(async (id) => f(connection, id, s)))));

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
