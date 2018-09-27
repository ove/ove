initControl = function (data) {
    window.ove.context.isInitialized = false;
    initCommon();
    window.ove.state.current = data;
    const url = OVE.Utils.getQueryParam('url');
    if (url) {
        // If a URL was passed, the URL of the loaded state would be overridden.
        window.ove.state.current.url = url;
    }
    loadURL();
};

refresh = function () { }; // View-only operation

requestRegistration = function () {
    // Broadcast a registration request along with a state update such that viewers
    // then replicate the state.
    window.ove.socket.send(Constants.APP_NAME, { bufferStatus: { type: { requestRegistration: true } } });
    OVE.Utils.broadcastState(Constants.APP_NAME, { state: window.ove.state.current });
};

doRegistration = function () { }; // View-only operation

beginInitialization = function () {
    OVE.Utils.initControl(Constants.DEFAULT_STATE_NAME, initControl);
};
