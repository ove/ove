initView = function () {
    window.ove.context.isInitialized = false;
    window.ove.socket.on(function (appId, message) {
        if (appId == 'maps') {
            window.ove.state.current = message;
            updateMap();
        }
    });
    initCommon();
};

updateMap = function () {
    let context = window.ove.context;
    let l = window.ove.layout;
    if (Object.keys(l).length == 0) {
        return;
    }
    let p = window.ove.state.current.position;
    let localCenter = [parseFloat(p.bounds.x) + (p.bounds.w * (0.5 * l.w + l.x) / l.section.w),
        parseFloat(p.bounds.y) + (p.bounds.h * (0.5 * l.h + l.y) / l.section.h)];
    context.layers.forEach(function (e, i) {
        e.setVisible(window.ove.state.current.enabledLayers.includes(i.toString()));
    });
    if (!context.isInitialized) {
        initMap({
            center: localCenter,
            resolution: parseFloat(p.resolution),
            zoom: parseInt(p.zoom),
            enableRotation: false });
        context.isInitialized = true;
    }
    context.map.getView().setCenter(localCenter);
    context.map.getView().setResolution(parseFloat(p.resolution));
};

beginInitialization = function () {
    initView();
    $(document).on('ove.loaded', function () {
        if (!window.ove.context.isInitialized) {
            window.ove.state.load().then(updateMap);
        }
    });
};
