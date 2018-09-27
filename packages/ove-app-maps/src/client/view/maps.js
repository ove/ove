initView = function () {
    window.ove.context.isInitialized = false;
    window.ove.socket.on(function (appId, message) {
        if (appId === 'maps') {
            window.ove.state.current = message;
            updateMap();
        }
    });
    initCommon();
};

updateMap = function () {
    const context = window.ove.context;
    const l = window.ove.layout;
    if (Object.keys(l).length === 0) {
        return;
    }
    const p = window.ove.state.current.position;
    const center = [+(p.bounds.x) + (p.bounds.w * (0.5 * l.w + l.x) / l.section.w),
        +(p.bounds.y) + (p.bounds.h * (0.5 * l.h + l.y) / l.section.h)];
    context.layers.forEach(function (e, i) {
        e.setVisible(window.ove.state.current.enabledLayers.includes(i.toString()));
    });
    if (!context.isInitialized) {
        initMap({
            center: center,
            resolution: +(p.resolution),
            zoom: parseInt(p.zoom),
            enableRotation: false });
        context.isInitialized = true;
    }
    context.map.getView().setCenter(center);
    context.map.getView().setResolution(+(p.resolution));
};

beginInitialization = function () {
    OVE.Utils.initView(initView, updateMap);
};
