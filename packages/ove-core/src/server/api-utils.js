const path = require('path');
const RequestUtils = require(path.resolve(__dirname, 'request-utils'));

module.exports = (server, log, Utils, Constants) => {
    const JSONHeader = { [Constants.HTTP_HEADER_CONTENT_TYPE]: Constants.HTTP_CONTENT_TYPE_JSON };

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
                secondary: [secondary],
                sections: []
            };
        }
        return connection;
    };

    // returns the space for a section
    const _getSpaceForSection = section => section ? Object.keys(section.spaces)[0] : undefined;

    const _getSectionsForSpace = link =>
        server.state.get('sections').filter(section => !Utils.isNullOrEmpty(section) && _getSpaceForSection(section) === link.space);

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

    const _getConnectionId = connection => _getConnections().findIndex(c => !Utils.isNullOrEmpty(c) && _linkEquals(c.primary, connection.primary));

    const _getUniqueHosts = spaces => _unique(spaces, (x, y) => x.host === y.host);

    const _linkEquals = (x, y) => x.space === y.space && x.host === y.host;

    const _getDefaultLink = space => ({ space: space, host: process.env.OVE_HOST, protocol: `${Constants.DEFAULT_PROTOCOL}://` });

    // whether a space is primary within the given connection
    const _isPrimaryForConnection = (connection, link) => _linkEquals(connection.primary, link);

    // returns the primary section for the sectionId
    const _getPrimarySection = (connection, sectionId, link) => connection.sections
        .find(s => parseInt(s.secondary, 10) === parseInt(sectionId, 10) && _linkEquals(s.link, link)).primary;

    const _getMappingsForSecondary = (connection, link) => connection.sections ? connection.sections.filter(x => _linkEquals(x.link, link)).map(({ secondary }) => secondary) : [];

    const _filterWithIndex = (arr, handler) => arr.map((x, i) => ({ index: i, value: x })).filter(({ value }) => handler(value));

    const _setToArray = set => {
        const arr = [];
        set.forEach(x => arr.push(x));
        return arr;
    };

    // -------------------------------- //

    // whether the space is connected as a primary
    const _isPrimary = link => server.state.get('connections')
        .filter(connection => !Utils.isNullOrEmpty(connection))
        .find(connection => _linkEquals(connection.primary, link)) !== undefined;

    const _isSecondary = link => server.state.get('connections')
        .filter(connection => !Utils.isNullOrEmpty(connection))
        .find(connection => connection.secondary && connection.secondary.some(s => _linkEquals(s, link))) !== undefined;

    // whether the space is currently connected, either as primary or secondary
    const _isConnected = link => _isPrimary(link) || _isSecondary(link);

    // returns the connection corresponding to the space or undefined if not connected
    const _getConnection = link => {
        if (server.state.get('connections').length === 0) return;
        const primary = server.state.get('connections')
            .filter(connection => !Utils.isNullOrEmpty(connection))
            .find(connection => _linkEquals(connection.primary, link));
        const secondary = server.state.get('connections')
            .filter(connection => !Utils.isNullOrEmpty(connection))
            .find(connection => connection.secondary.some(s => _linkEquals(s, link)));
        return !primary ? secondary : primary;
    };

    const _updateConnection = connection => {
        connection.id = _getConnectionId(connection);

        if (connection.id === -1) {
            connection.id = server.state.get('connections').length;
        }

        server.state.set(`connections[${connection.id}]`, connection);

        return connection;
    };

    const _deleteLink = link => {
        const connection = _getConnection(link);
        const id = _getConnectionId(connection);

        connection.secondary.splice(connection.secondary.findIndex(s => _linkEquals(s, link)), 1);
        connection.id = id;
        server.state.set(`connections[${id}]`, connection);

        return connection;
    };

    const _deleteSectionForLink = (sectionId, link) => {
        const connection = _getConnection(link);
        const id = _getConnectionId(connection);

        connection.sections.splice(connection.sections
            .findIndex(s => parseInt(s.secondary, 10) === parseInt(sectionId, 10) && _linkEquals(s.link, link)), 1);
        connection.id = id;
        server.state.set(`connections[${id}]`, connection);
    };

    const _deleteSectionsForLink = secondary => {
        const connection = _getConnection(secondary);

        connection.sections
            .filter(({ link }) => _linkEquals(link, secondary))
            .map(({ secondary }) => secondary)
            .forEach(s => _deleteSectionForLink(s, secondary));
    };

    const _removeConnection = link => {
        const _remove = (index) => server.state.set(`connections[${index}]`, {});
        const primary = _getConnections().findIndex(connection => _linkEquals(connection.primary, link));
        _remove(primary !== -1
            ? primary
            : _getConnections().findIndex(connection => connection.secondary && connection.secondary.some(s => _linkEquals(s, link))));
    };

    // returns the section information for a given id
    const _getURLForId = sectionId => server.state.get(`sections[${sectionId}]`)?.app?.url;

    // -------------------------------- //

    // whether the space is connected as a secondary
    const _isSecondaryWrapper = async link => _isLocal(link.host)
        ? _isSecondary(link)
        : (await RequestUtils.get(`${link.protocol}${link.host}/link/isSecondary`, JSONHeader, link))
            .text.isSecondary;

    const _isPrimaryWrapper = async link => _isLocal(link.host)
        ? _isPrimary(link)
        : (await RequestUtils.get(`${link.protocol}${link.host}/link/isPrimary`, JSONHeader, link))
            .text.isPrimary;

    const _isConnectedWrapper = async link => _isLocal(link.host)
        ? _isConnected(link)
        : (await RequestUtils.get(`${link.protocol}${link.host}/link/isConnected`, JSONHeader, link))
            .text.isConnected;

    const _getConnectionWrapper = async link => _isLocal(link.host)
        ? _getConnection(link)
        : (await RequestUtils.get(`${link.protocol}${link.host}/connection`, JSONHeader, link))
            .text.connection;

    // creates connection for connection
    const _updateConnectionWrapper = async (connection, primary, secondary) => {
        connection = connection || _generateConnection(primary, secondary);
        const hosts = _getUniqueHosts([connection.primary].concat(connection.secondary));

        for (const { protocol, host } of hosts) {
            _isLocal(host)
                ? _updateConnection(connection)
                : await RequestUtils.post(`${protocol}${host}/connection`, JSONHeader, connection);
        }

        return connection;
    };

    const _replicateWrapper = async (connection, section, id, link) => {
        const mapping = { primary: section.id, secondary: id, link: link };
        connection.sections = [...connection.sections, mapping];
        const hosts = _getUniqueHosts([connection.primary].concat(connection.secondary));

        for (const { protocol, host } of hosts) {
            _isLocal(host)
                ? _updateConnection(connection)
                : await RequestUtils.post(`${protocol}${host}/connection`, JSONHeader, connection);
        }

        return mapping;
    };

    const _clearConnectionsWrapper = async () => {
        const connections = _getConnections();
        server.state.set('connections', []);

        for (const connection of connections) {
            if (_isLocal(connection.primary.host)) { continue; }
            await RequestUtils.delete(`${connection.primary.protocol}${connection.primary.host}/connection/${connection.primary.space}`,
                JSONHeader, { primary: connection.primary.host }, resolve => resolve());
        }
    };

    const _disconnectSpaceWrapper = async (connection, link) => {
        if (connection.secondary.length > 1) {
            const hosts = _getUniqueHosts([connection.primary].concat(connection.secondary));
            for (const { protocol, host } of hosts) {
                _isLocal(host)
                    ? _deleteSectionsForLink(link)
                    : await RequestUtils.delete(`${protocol}${host}/links/sections`, JSONHeader, { link: link });
                _isLocal(host)
                    ? _deleteLink(link)
                    : await RequestUtils.delete(`${protocol}${host}/link`, JSONHeader, { link: link });
            }
        } else {
            for (const { protocol, host } of _getUniqueHosts([connection.primary].concat(connection.secondary))) {
                _isLocal(host)
                    ? _removeConnection(connection.primary)
                    : await RequestUtils.delete(`${protocol}${host}/connection`, JSONHeader, connection.primary);
            }
        }
    };

    const _deleteSectionForLinkWrapper = async (connection, id, link) => {
        for (const { protocol, host } of _getUniqueHosts([connection.primary].concat(connection.secondary))) {
            _isLocal(host)
                ? _deleteSectionForLink(id, link)
                : await RequestUtils.delete(`${protocol}${host}/links/section/${id}`,
                    JSONHeader, { primary: connection.primary, link: link });
        }
    };

    const _removeConnectionWrapper = async (connection, link) => {
        for (const { protocol, host } of _getUniqueHosts([connection.primary].concat(connection.secondary))) {
            _isLocal(host)
                ? _removeConnection(link)
                : await RequestUtils.delete(`${protocol}${host}/connection`, JSONHeader, link);
        }
    };

    const _getURLForIdWrapper = async (link, id) => _isLocal(link.host)
        ? _getURLForId(id)
        : (await RequestUtils.get(`${link.protocol}${link.host}/sections/${id}/url`, JSONHeader))
            .text.url;

    const _getSpaceGeometriesWrapper = async (link, _local) => _isLocal(link.host)
        ? _local()[link.space]
        : (await RequestUtils.get(`${link.protocol}${link.host}/spaces/${link.space}/geometry`, JSONHeader)).text;

    const _createSectionWrapper = async (link, data, _local) => _isLocal(link.host)
        ? _local(data)
        : (await RequestUtils.post(`${link.protocol}${link.host}/section?override=true`, JSONHeader, data)).text.id;

    // -------------------------------- //

    const _forEachSecondarySection = async (connection, f) => Promise.all(connection.secondary.map(async s =>
        Promise.all(_getMappingsForSecondary(connection, s).map(async (id) => f(connection, id, s)))));

    const _forEachSecondary = async (connection, f) => Promise.all(connection.secondary.map(s => f(connection, s)));

    const _applyPrimaryForSections = async (space, f) => {
        const link = _getDefaultLink(space);
        const connection = _getConnection(link);

        if (connection && connection.isInitialized && _isPrimaryForConnection(connection, link)) {
            await _forEachSecondarySection(connection, f);
        }
    };

    const _applyPrimary = async (space, f) => {
        const link = _getDefaultLink(space);
        const connection = _getConnection(link);

        if (connection && connection.isInitialized && _isPrimaryForConnection(connection, link)) {
            await _forEachSecondary(connection, f);
        }
    };

    // -------------------------------- //

    return {
        JSONHeader: JSONHeader,

        isLocal: _isLocal,
        getSpaceBySectionId: _getSpaceBySectionId,
        getSectionForId: _getSectionForId,
        generateConnection: _generateConnection,
        getSpaceForSection: _getSpaceForSection,
        getSectionsForSpace: _getSectionsForSpace,
        getSectionData: _getSectionData,
        getConnections: _getConnections,
        linkEquals: _linkEquals,
        isValidSectionId: _isValidSectionId,
        getDefaultLink: _getDefaultLink,
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
        updateConnection: _updateConnection,
        removeConnection: _removeConnection,
        getURLForId: _getURLForId,
        deleteSectionForLink: _deleteSectionForLink,
        deleteLink: _deleteLink,
        deleteSectionsForLink: _deleteSectionsForLink,

        isPrimaryWrapper: _isPrimaryWrapper,
        isSecondaryWrapper: _isSecondaryWrapper,
        isConnectedWrapper: _isConnectedWrapper,
        getConnectionWrapper: _getConnectionWrapper,
        updateConnectionWrapper: _updateConnectionWrapper,
        replicateWrapper: _replicateWrapper,
        clearConnectionsWrapper: _clearConnectionsWrapper,
        disconnectSpaceWrapper: _disconnectSpaceWrapper,
        removeConnectionWrapper: _removeConnectionWrapper,
        getURLForIdWrapper: _getURLForIdWrapper,
        deleteSectionForLinkWrapper: _deleteSectionForLinkWrapper,
        getSpaceGeometriesWrapper: _getSpaceGeometriesWrapper,
        createSectionWrapper: _createSectionWrapper,

        forEachSecondarySection: _forEachSecondarySection,
        forEachSecondary: _forEachSecondary,
        applyPrimaryForSections: _applyPrimaryForSections,
        applyPrimary: _applyPrimary
    };
};
