initControl = function (data) {
    window.ove.context.isInitialized = false;

    OVE.Utils.resizeController(Constants.CONTENT_DIV);
    window.ove.state.current = data;
    loadSigma();
    OVE.Utils.broadcastState(Constants.APP_NAME, window.ove.state.current);
};

beginInitialization = function () {
    OVE.Utils.initControl(Constants.DEFAULT_STATE_NAME, initControl);
};
