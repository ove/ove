initControl = function (data) {
    let context = window.ove.context;
    context.isInitialized = false;

    let l = window.ove.layout;
    OVE.Utils.resizeController('.map, .outer');
    initCommon().then(function () {
        let enabledLayers = OVE.Utils.getQueryParam('layers', '0').split(',');
        if (window.ove.state.current.position && enabledLayers !== window.ove.state.current.enabledLayers) {
            // if the layers have changed, clear the cached position to force a broadcast.
            window.ove.state.current.position = null;
        }
        window.ove.state.current.enabledLayers = enabledLayers;
        window.ove.state.current.enabledLayers.forEach(function (e) {
            context.layers[e].setVisible(true);
        });
        initMap({
            center: [+(data.center[0]), +(data.center[1])],
            resolution: +(data.resolution) *
                (data.scaled ? Math.sqrt(l.section.w * l.section.h /
                    (parseInt($('.outer').css('width')) * parseInt($('.outer').css('height')))) : 1.0),
            zoom: parseInt(data.zoom),
            enableRotation: false
        });
        for (let e of ['change:resolution', 'change:zoom', 'change:center']) {
            context.map.getView().on(e, changeEvent);
        }
        context.map.getView().setZoom(parseInt(data.zoom));
        uploadMapPosition();
        context.isInitialized = true;
    });
};

uploadMapPosition = function () {
    let context = window.ove.context;
    let size = context.map.getSize();
    let tl = context.map.getCoordinateFromPixel([0, 0]);
    let br = context.map.getCoordinateFromPixel(size);
    let resolution = +(context.map.getView().getResolution()) /
        Math.sqrt(window.ove.layout.section.w * window.ove.layout.section.h / (size[0] * size[1]));
    if (tl == null || br == null) {
        setTimeout(uploadMapPosition, 70);
    } else {
        let position = {
            bounds: { x: tl[0], y: tl[1], w: (br[0] - tl[0]), h: (br[1] - tl[1]) },
            center: context.map.getView().getCenter(),
            resolution: resolution,
            zoom: context.map.getView().getZoom() };
        if (!window.ove.state.current.position ||
            !OVE.Utils.JSON.equals(position, window.ove.state.current.position)) {
            window.ove.state.current.position = position;
            OVE.Utils.broadcastState('maps', window.ove.state.current);
        }
    }
};

changeEvent = function () {
    if (window.ove.context.isInitialized) {
        uploadMapPosition();
    }
};

beginInitialization = function () {
    $(document).on(OVE.Event.LOADED, function () {
        window.ove.state.load().then(function () {
            if (window.ove.state.current.position) {
                let p = window.ove.state.current.position;
                initControl({ center: p.center, resolution: p.resolution, zoom: p.zoom, scaled: true });
            }
        });
        $(document).trigger('maps.stateLoaded');
    });
    $(document).on('maps.stateLoaded', function () {
        let state = window.ove.state.name || 'London';
        if (!window.ove.state.current.position) {
            $.ajax({ url: 'state/' + state, dataType: 'json' }).done(function (data) {
                initControl(data);
            });
        }
    });
};
