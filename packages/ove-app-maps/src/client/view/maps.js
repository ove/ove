initView = function () {
    window.ove.context.isInitialized = false;
    log.debug('Application is initialized:', window.ove.context.isInitialized);
    OVE.Utils.setOnStateUpdate(updateMap);
    initCommon();
};

updateMap = function () {
    const context = window.ove.context;
    const l = window.ove.layout;
    // This check is required since the state may not be loaded when the viewer
    // receives a state update.
    if (Object.keys(l).length === 0) {
        log.debug('State not fully loaded - retrying');
        return;
    }
    const p = window.ove.state.current.position;
    const center = [+(p.bounds.x) + (p.bounds.w * (0.5 * l.w + l.x) / l.section.w),
        +(p.bounds.y) + (p.bounds.h * (0.5 * l.h + l.y) / l.section.h)];
    // Unlike in the controller, all layers will be explicitly shown or hidden based
    // on whether they have been enabled.
    context.layers.forEach(function (e, i) {
        const visible = window.ove.state.current.enabledLayers.includes(i.toString());
        e.setVisible(visible);
        if (visible) {
            log.debug('Setting visible for layer:', i);
        }
    });
    // Initialization of OpenLayers requires center, resolution and a zoom level.
    // If the map has already been initialized what changes is the center and/or the
    // resolution.
    if (!context.isInitialized) {
        initMap({
            center: center,
            resolution: +(p.resolution),
            zoom: parseInt(p.zoom),
            enableRotation: false });
        context.isInitialized = true;
    }
    log.debug('Updating map with center:', center, ', and resolution:', +(p.resolution));
    context.map.getView().setCenter(center);
    context.map.getView().setResolution(+(p.resolution));
};

beginInitialization = function () {
    log.debug('Starting viewer initialization');
    OVE.Utils.initView(initView, updateMap);
};
