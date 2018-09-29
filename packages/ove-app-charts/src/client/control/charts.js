initControl = function (data) {
    window.ove.context.isInitialized = false;

    OVE.Utils.resizeController(Constants.CONTENT_DIV);
    window.ove.state.current = data;
    loadVega();
    OVE.Utils.broadcastState();
};

beginInitialization = function () {
    OVE.Utils.initControl(Constants.DEFAULT_STATE_NAME, initControl);
};
