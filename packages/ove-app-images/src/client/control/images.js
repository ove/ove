initControl = function (data) {
    const context = window.ove.context;
    context.isInitialized = false;

    OVE.Utils.resizeController(Constants.CONTENT_DIV);
    window.ove.state.current.config = data;
    // Viewport details would be updated for specific events - check OSD_MONITORED_EVENTS.
    loadOSD(data).then(function () {
        for (const e of Constants.OSD_MONITORED_EVENTS) {
            context.osd.addHandler(e, sendViewportDetails);
        }
    });
    context.isInitialized = true;
    sendViewportDetails();
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
            OVE.Utils.broadcastState(Constants.APP_NAME, window.ove.state.current);
        }
    }
};

beginInitialization = function () {
    OVE.Utils.initControl(Constants.DEFAULT_STATE_NAME, initControl);
};
