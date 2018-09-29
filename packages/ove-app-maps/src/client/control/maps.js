initControl = function (data) {
    const context = window.ove.context;
    context.isInitialized = false;

    const l = window.ove.layout;
    OVE.Utils.resizeController('.map, .outer');
    initCommon().then(function () {
        const enabledLayers = OVE.Utils.getQueryParam('layers', '0').split(',');
        if (window.ove.state.current.position && enabledLayers !== window.ove.state.current.enabledLayers) {
            // If the layers have changed, clear the cached position to force a broadcast.
            window.ove.state.current.position = null;
        }
        window.ove.state.current.enabledLayers = enabledLayers;
        // Make enabled layers visible.
        window.ove.state.current.enabledLayers.forEach(function (e) {
            context.layers[e].setVisible(true);
        });
        initMap({
            center: [+(data.center[0]), +(data.center[1])],
            // The resolution can be scaled to match the section's dimensions, or it could be
            // the original resolution intended for the controller. The data.scaled parameter
            // is used to determine the option.
            resolution: +(data.resolution) *
                (data.scaled ? Math.sqrt(l.section.w * l.section.h /
                    (parseInt($('.outer').css('width')) * parseInt($('.outer').css('height')))) : 1.0),
            zoom: parseInt(data.zoom),
            enableRotation: false
        });
        // We force the setting of the zoom.
        context.map.getView().setZoom(parseInt(data.zoom));
        uploadMapPosition();
        context.isInitialized = true;
        // Handlers for OpenLayers events.
        for (const e of Constants.OL_MONITORED_EVENTS) {
            if (e === 'change:center') {
                context.map.getView().on(e, uploadMapPosition);
            } else {
                context.map.getView().on(e, changeEvent);
            }
        }
    });
};

uploadMapPosition = function () {
    const context = window.ove.context;
    const size = context.map.getSize();
    const topLeft = context.map.getCoordinateFromPixel([0, 0]);
    const bottomRight = context.map.getCoordinateFromPixel(size);
    const resolution = +(context.map.getView().getResolution()) /
        Math.sqrt(window.ove.layout.section.w * window.ove.layout.section.h / (size[0] * size[1]));
    if (topLeft === null || bottomRight === null) {
        // This method will loop until the top-left and bottom-right can be calculated.
        setTimeout(uploadMapPosition, 70);
    } else {
        // We broadcast the coordinates of the center, the zoom level and the resolution.
        // We also send the coordinates of the top-left and bottom-right, to ensure the
        // map is focusing on the correct lat/long.
        const position = {
            bounds: {
                x: topLeft[0],
                y: topLeft[1],
                w: bottomRight[0] - topLeft[0],
                h: bottomRight[1] - topLeft[1]
            },
            center: context.map.getView().getCenter(),
            resolution: resolution,
            zoom: context.map.getView().getZoom()
        };
        // The broadcast happens only if the position has changed.
        if (!window.ove.state.current.position ||
            !OVE.Utils.JSON.equals(position, window.ove.state.current.position)) {
            window.ove.state.current.position = position;
            OVE.Utils.broadcastState();
        }
    }
};

changeEvent = function () {
    // We need to reset center if we change zoom-level as the map resizes itself.
    setTimeout(function () {
        window.ove.context.map.getView().setCenter(window.ove.context.map.getView().getCenter());
    }, Constants.OL_CHANGE_CENTER_AFTER_UPDATE_WAIT_TIME);
    uploadMapPosition();
};

beginInitialization = function () {
    $(document).on(OVE.Event.LOADED, function () {
        // The maps controller can pre-load an existing state and continue navigation
        // from that point onwards and does not reset what's already loaded.
        window.ove.state.load().then(function () {
            if (window.ove.state.current.position) {
                const p = window.ove.state.current.position;
                initControl({ center: p.center, resolution: p.resolution, zoom: p.zoom, scaled: true });
            } else {
                // There could be a situation where a current state exists but without a position.
                OVE.Utils.initControlOnDemand(Constants.DEFAULT_STATE_NAME, initControl);
            }
        }).catch(function () {
            // If the promise is rejected, that means no current state is existing.
            OVE.Utils.initControlOnDemand(Constants.DEFAULT_STATE_NAME, initControl);
        });
    });
};
