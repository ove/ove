initControl = function (data) {
    window.ove.context.isInitialized = false;
    window.ove.state.current = data;
    const url = OVE.Utils.getQueryParam('url');
    if (url) {
        window.ove.state.current.url = url;
        window.ove.state.current.launchDelay =
            parseInt(OVE.Utils.getQueryParam('launchDelay', 0));
    }
    window.ove.state.current.changeAt = new Date().getTime() + 350;
    OVE.Utils.broadcastState('html', window.ove.state.current);
    updateURL();
};

getCSS = function () {
    return { width: '100vw', height: '60vh' };
};

beginInitialization = function () {
    OVE.Utils.initControl('Matrix', initControl);
};
