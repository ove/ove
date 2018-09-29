initControl = function (data) {
    window.ove.context.isInitialized = false;
    logger.debug('Application is initialized:', window.ove.context.isInitialized);
    initCommon();
    logger.debug('Restoring state:', data);
    window.ove.state.current = data;
    const url = OVE.Utils.getQueryParam('url');
    if (url) {
        logger.debug('New URL at controller:', url);
        // If a URL was passed, the URL of the loaded state would be overridden.
        window.ove.state.current.url = url;
    }
    loadURL();
};

refresh = function () { }; // View-only operation

requestRegistration = function () {
    // Broadcast a registration request along with a state update such that viewers
    // then replicate the state.
    logger.debug('Sending registration request and broadcasting state');
    window.ove.socket.send({ bufferStatus: { type: { requestRegistration: true } } });
    OVE.Utils.broadcastState({ state: window.ove.state.current });
};

doRegistration = function () { }; // View-only operation

beginInitialization = function () {
    logger.debug('Starting controller initialization');
    OVE.Utils.initControl(Constants.DEFAULT_STATE_NAME, initControl);
};
