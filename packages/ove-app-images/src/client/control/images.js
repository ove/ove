initControl = function (data) {
    let context = window.ove.context;
    context.isInitialized = false;

    OVE.Utils.resizeController('#contentDiv');
    window.ove.state.current.config = data;
    loadOSD(data).then(function () {
        for (let e of ['resize', 'zoom', 'pan']) {
            context.osd.addHandler(e, sendViewportDetails);
        }
    });
    context.isInitialized = true;
    sendViewportDetails();
};

sendViewportDetails = function (viewer) {
    if (window.ove.context.isInitialized) {
        let context = window.ove.context;
        let bounds = context.osd.viewport.getBounds();
        let viewport = {
            bounds: { x: bounds.x, y: bounds.y, w: bounds.width, h: bounds.height },
            zoom: context.osd.viewport.getZoom()
        };
        if (!window.ove.state.current.viewport ||
            !OVE.Utils.JSON.equals(viewport, window.ove.state.current.viewport)) {
            window.ove.state.current.viewport = viewport;
            OVE.Utils.broadcastState('images', window.ove.state.current);
        }
    }
};

beginInitialization = function () {
    OVE.Utils.initControl('Blockchain', initControl);
};
