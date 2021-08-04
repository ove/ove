module.exports = (server, log, Utils) => {
    // returns the section information for a given id
    const _getSectionForId = (sectionId) => server.state.get('sections').find(s => Number(s.id) === Number(sectionId));
    const _isValidSectionId = (sectionId) => {
        const section = server.state.get(`sections[${sectionId}]`);
        return section !== undefined && !Utils.isNullOrEmpty(section);
    };
    // returns the connection corresponding to the space or undefined if not connected
    const _getConnection = (space) => {
        if (server.state.get('connections').length === 0) return;
        const primary = server.state.get('connections')
            .filter(connection => !Utils.isNullOrEmpty(connection))
            .find(connection => connection.primary === space);
        return !primary ? server.state.get('connections')
            .filter(connection => !Utils.isNullOrEmpty(connection))
            .find(connection => connection.secondary.includes(space)) : primary;
    };
    // whether a space is primary within the given connection
    const _isPrimaryForConnection = (connection, space) => space === connection.primary;
    // whether a section is primary within the given connection
    const _sectionIsPrimaryForConnection = (connection, sectionId) => _isPrimaryForConnection(connection, _getSpaceForSection(_getSectionForId(sectionId)));
    // returns the replicated sections for the sectionId
    const _getReplicas = (connection, sectionId) => connection.map.filter(s => Number(s.primary) === Number(sectionId)).map(s => s.secondary);
    // returns the space for a section
    const _getSpaceForSection = (section) => Object.keys(section.spaces)[0];
    // returns the connection corresponding to the space the section with id: sectionId is contained in
    const _getConnectionForSection = (sectionId) => {
        const section = _getSectionForId(sectionId);
        if (!section) return undefined;
        return _getConnection(_getSpaceForSection(section));
    };

    // updates/creates connection for connection
    const _updateConnection = (primary, secondary) => {
        let connection;
        if (_isConnected(primary)) {
            connection = _getConnection(primary);
            connection.secondary = [...connection.secondary, secondary];
        } else {
            connection = { isInitialized: false, isConnected: true, primary: primary, secondary: [secondary], uuid: -1, id: server.state.get('connections').length };
        }
        _updateConnectionState(connection);
        return connection;
    };

    const _updateConnectionState = (connection) => server.state.set(`connections[${connection.id}]`, connection);
    // whether the space is currently connected, either as primary or secondary
    const _isConnected = (space) => _isPrimary(space) || _isSecondary(space);
    const _removeConnection = (space) => {
        const _remove = (index) => server.state.set(`connections[${index}]`, {});
        const primary = server.state.get('connections').findIndex(connection => connection.primary === space);
        _remove(primary !== -1 ? primary : server.state.get('connections')
            .findIndex(connection => connection.secondary && connection.secondary.includes(space)));
    };
    // whether the space is connected as a primary
    const _isPrimary = (space) => server.state.get('connections')
        .filter(connection => !Utils.isNullOrEmpty(connection))
        .find(connection => connection.primary === space) !== undefined;
    // whether the space is connected as a secondary
    const _isSecondary = (space) => server.state.get('connections')
        .filter(connection => !Utils.isNullOrEmpty(connection))
        .find(connection => connection.secondary && connection.secondary.includes(space)) !== undefined;
    // returns the primary section for the sectionId
    const _getPrimary = (connection, sectionId) => connection.map.find(s => Number(s.secondary) === Number(sectionId)).primary;
    const _getSpaceBySectionId = (id) => _getSpaceForSection(_getSectionForId(id));
    const _deleteSecondarySection = (connection, sectionId) => {
        connection.map.splice(connection.map.findIndex(s => Number(s.secondary) === Number(sectionId)), 1);
        _updateConnectionState(connection);
    };
    const _deleteSpace = (connection, space) => {
        connection.secondary.splice(connection.secondary.indexOf(space), 1);
        _updateConnectionState(connection);
    };
    const _deleteAllForSpace = (connection, space) => _getSectionsForSpace(space).forEach(s => _deleteSecondarySection(connection, s.id));
    const _getSectionsForSpace = (space) => server.state.get('sections').filter(section => !Utils.isNullOrEmpty(section) && _getSpaceForSection(section) === space);
    const _forEachSpace = (connection, f) => connection.secondary.forEach(s => f(s));
    const _addSection = (connection, mapping) => {
        connection.map = !connection.map ? [mapping] : [...connection.map, mapping];
        _updateConnectionState(connection);
    };

    const _disconnectSpace = function (space) {
        const connection = _getConnection(space);
        if (connection.secondary.length > 1) {
            _deleteSpace(connection, space);
            _deleteAllForSpace(connection, space);
        } else {
            _removeConnection(space);
        }
    };
    const _getSectionData = function (section, primary, secondary, title) {
        const resize = (primary, secondary, x, y, w, h) => {
            const widthFactor = Number(secondary.w) / Number(primary.w);
            const heightFactor = Number(secondary.h) / Number(primary.h);
            return { x: x * widthFactor, y: y * heightFactor, w: w * widthFactor, h: h * heightFactor };
        };

        const coordinates = resize(primary, secondary, Number(section.x), Number(section.y), Number(section.w), Number(section.h));
        const data = {
            'space': title,
            'x': coordinates.x,
            'y': coordinates.y,
            'w': coordinates.w,
            'h': coordinates.h
        };
        if (section.app) {
            data['app'] = { 'url': section.app.url, 'states': { 'load': section.app.state } };
        }
        return data;
    };
    const _replicate = (connection, section, id) => {
        const mapping = { primary: section.id, secondary: id };
        _addSection(connection, mapping);
        return mapping;
    };
    const _applyPrimary = (space, f) => {
        const connection = _getConnection(space);
        if (connection && connection.isInitialized && _isPrimaryForConnection(connection, space)) {
            f(connection);
        }
    };
    const _clearConnections = () => server.state.set('connections', []);
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

    return {
        getSectionForId: _getSectionForId,
        isValidSectionId: _isValidSectionId,
        getConnection: _getConnection,
        isPrimaryForConnection: _isPrimaryForConnection,
        sectionIsPrimaryForConnection: _sectionIsPrimaryForConnection,
        getReplicas: _getReplicas,
        getSpaceForSection: _getSpaceForSection,
        getConnectionForSection: _getConnectionForSection,
        updateConnection: _updateConnection,
        isConnected: _isConnected,
        removeConnection: _removeConnection,
        isPrimary: _isPrimary,
        isSecondary: _isSecondary,
        getPrimary: _getPrimary,
        getSpaceBySectionId: _getSpaceBySectionId,
        deleteSecondarySection: _deleteSecondarySection,
        deleteSpace: _deleteSpace,
        deleteAllForSpace: _deleteAllForSpace,
        getSectionsForSpace: _getSectionsForSpace,
        forEachSpace: _forEachSpace,
        addSection: _addSection,
        disconnectSpace: _disconnectSpace,
        getSectionData: _getSectionData,
        replicate: _replicate,
        applyPrimary: _applyPrimary,
        clearConnections: _clearConnections,
        getConnections: _getConnections,
        updateConnectionState: _updateConnectionState
    };
};
