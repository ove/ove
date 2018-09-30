initControl = function (data) {
    window.ove.context.isInitialized = false;
    log.debug('Application is initialized:', window.ove.context.isInitialized);
    log.debug('Restoring state:', data);
    window.ove.state.current = data;
    const url = OVE.Utils.getQueryParam('url');
    if (url) {
        const launchDelay = parseInt(OVE.Utils.getQueryParam('launchDelay', 0));
        log.debug('New URL at controller:', url, ', with launch delay:', launchDelay);
        // If a URL was passed, the URL and the launchDelay of the loaded state would be overridden.
        window.ove.state.current.url = url;
        window.ove.state.current.launchDelay = launchDelay;
    }
    // The changeAt time helps browsers load content precisely at the same time.
    window.ove.state.current.changeAt = new Date().getTime() + Constants.OPERATION_SYNC_DELAY;
    log.debug('Scheduling change at time:', window.ove.state.current.changeAt);
    log.debug('Broadcasting state');
    OVE.Utils.broadcastState();
    updateURL();
};

getCSS = function () {
    // Unlike most apps, the HTML app's controller renders the HTML page at a fixed
    // height and width.
    return { width: '100vw', height: '60vh' };
};

beginInitialization = function () {
    log.debug('Starting controller initialization');
    OVE.Utils.initControl(Constants.DEFAULT_STATE_NAME, initControl);
};
