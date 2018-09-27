initControl = function (data) {
    window.ove.context.isInitialized = false;
    window.ove.state.current = data;
    const url = OVE.Utils.getQueryParam('url');
    if (url) {
        // If a URL was passed, the URL and the launchDelay of the loaded state would be overridden.
        window.ove.state.current.url = url;
        window.ove.state.current.launchDelay =
            parseInt(OVE.Utils.getQueryParam('launchDelay', 0));
    }
    // The changeAt time helps browsers load content precisely at the same time.
    window.ove.state.current.changeAt = new Date().getTime() + Constants.OPERATION_SYNC_DELAY;
    OVE.Utils.broadcastState(Constants.APP_NAME, window.ove.state.current);
    updateURL();
};

getCSS = function () {
    // Unlike most apps, the HTML app's controller renders the HTML page at a fixed
    // height and width.
    return { width: '100vw', height: '60vh' };
};

beginInitialization = function () {
    OVE.Utils.initControl(Constants.DEFAULT_STATE_NAME, initControl);
};
