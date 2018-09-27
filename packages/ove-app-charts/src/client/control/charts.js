initControl = function (data) {
    window.ove.context.isInitialized = false;

    OVE.Utils.resizeController('#vegaArea');
    window.ove.state.current = data;
    loadVega();
    OVE.Utils.broadcastState('charts', window.ove.state.current);
};

beginInitialization = function () {
    OVE.Utils.initControl('VegaSample', initControl);
};
