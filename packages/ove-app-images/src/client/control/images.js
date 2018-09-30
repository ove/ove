initControl = function (data) {
    const context = window.ove.context;
    context.isInitialized = false;
    log.debug('Application is initialized:', window.ove.context.isInitialized);

    OVE.Utils.resizeController(Constants.CONTENT_DIV);
    log.debug('Restoring state:', data);
    window.ove.state.current.config = data;
    // Viewport details would be updated for specific events - check OSD_MONITORED_EVENTS.
    loadOSD(data).then(function () {
        for (const e of Constants.OSD_MONITORED_EVENTS) {
            log.debug('Registering OpenSeadragon handler:', e);
            context.osd.addHandler(e, sendViewportDetails);
        }
        context.isInitialized = true;
        log.debug('Application is initialized:', context.isInitialized);
        sendViewportDetails();
    }).catch(log.error);
};

sendViewportDetails = function () {
    const context = window.ove.context;
    if (context.isInitialized) {
        const bounds = context.osd.viewport.getBounds();
        // The viewport information sent across includes bounds and zoom level.
        const viewport = {
            bounds: { x: bounds.x, y: bounds.y, w: bounds.width, h: bounds.height },
            zoom: context.osd.viewport.getZoom()
        };
        // Viewport details are only sent across only if they have changed. This is
        // validated by checking the current state.
        if (!window.ove.state.current.viewport ||
            !OVE.Utils.JSON.equals(viewport, window.ove.state.current.viewport)) {
            window.ove.state.current.viewport = viewport;
            log.debug('Broadcasting state with viewport:', viewport);
            OVE.Utils.broadcastState();
        }
    }
};

beginInitialization = function () {
    log.debug('Starting controller initialization');
    OVE.Utils.initControl(Constants.DEFAULT_STATE_NAME, initControl);
};
