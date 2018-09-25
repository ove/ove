initView = function () {
    window.ove.context.isInitialized = false;
    window.ove.socket.on(function (appId, message) {
        if (appId == 'images') {
            window.ove.state.current = message;
            updateImage();
        }
    });
};

updateImage = function () {
    let context = window.ove.context;
    if (!context.isInitialized) {
        // Fix for chrome unable to load large images (#54)
        if (window.ove.state.current.config.tileSources && window.ove.state.current.config.tileSources.url) {
            window.ove.state.current.config.tileSources.url += '?nonce=' +
                new URLSearchParams(location.search.slice(1)).get('oveClientId');
        }
        loadOSD(window.ove.state.current.config).then(function () {
            context.osd.setVisible(false);
            context.osd.setFullPage(true);
            context.isInitialized = true;
            // OSD does not load the image at its proper location, so keep trying
            setTimeout(function () { setInterval(setPosition, 200); }, 350);
        });
    } else {
        setPosition();
    }
};

setPosition = function () {
    let context = window.ove.context;
    let l = window.ove.layout;
    var v = window.ove.state.current.viewport;
    if (v && Object.keys(l).length != 0) {
        var center = [v.bounds.x + v.bounds.w * (0.5 * l.w + l.x) / l.section.w,
            v.bounds.y + v.bounds.h * (0.5 * l.h + l.y) / l.section.h];
        context.osd.viewport.panTo(
            // multiplying by 1.0 for float division
            new OpenSeadragon.Point(center[0], center[1]), true).zoomTo(v.zoom * 1.0 * l.section.w / l.w);
        if (!context.osd.isVisible()) {
            context.osd.setVisible(true);
        }
    }
};

beginInitialization = function () {
    initView();
    $(document).on('ove.loaded', function () {
        if (!window.ove.context.isInitialized) {
            window.ove.state.load().then(updateImage);
        }
    });
};
