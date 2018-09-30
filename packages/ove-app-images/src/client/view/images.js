initView = function () {
    window.ove.context.isInitialized = false;
    OVE.Utils.setOnStateUpdate(updateImage);
};

updateImage = function () {
    const context = window.ove.context;
    if (!context.isInitialized) {
        // Fix for chrome unable to load large images (#54)
        if (window.ove.state.current.config.tileSources && window.ove.state.current.config.tileSources.url) {
            window.ove.state.current.config.tileSources.url += '?nonce=' + OVE.Utils.getQueryParam('oveClientId');
        }
        loadOSD(window.ove.state.current.config).then(function () {
            // Delaying visibility to support better loading experience.
            context.osd.setVisible(false);
            context.osd.setFullPage(true);
            context.isInitialized = true;
            // OSD does not load the image at its proper location, so keep trying
            setTimeout(function () {
                setInterval(setPosition, Constants.OSD_POSITION_UPDATE_FREQUENCY);
            }, Constants.OSD_POST_LOAD_WAIT_TIME);
        }).catch(log.error);
    } else {
        setPosition();
    }
};

setPosition = function () {
    const context = window.ove.context;
    const l = window.ove.layout;
    const v = window.ove.state.current.viewport;
    if (v && Object.keys(l).length !== 0) {
        // multiplying by 0.5 to get half the distance, for horizontal and vertical center.
        const center = [v.bounds.x + v.bounds.w * (0.5 * l.w + l.x) / l.section.w,
            v.bounds.y + v.bounds.h * (0.5 * l.h + l.y) / l.section.h];
        // We always center the image and then zoom it.
        context.osd.viewport.panTo(
            new OpenSeadragon.Point(center[0], center[1]), true).zoomTo(v.zoom * l.section.w / l.w);
        if (!context.osd.isVisible()) {
            context.osd.setVisible(true);
        }
    }
};

beginInitialization = function () {
    OVE.Utils.initView(initView, updateImage);
};
