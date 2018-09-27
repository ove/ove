initControl = function (data) {
    let context = window.ove.context;
    context.isInitialized = false;

    let l = window.ove.layout;
    let maxWidth = Math.min(document.documentElement.clientWidth, window.innerWidth);
    let maxHeight = Math.min(document.documentElement.clientHeight, window.innerHeight);
    // multiplying by 1.0 for float division
    let width, height;
    if (l.section.w * maxHeight >= maxWidth * l.section.h) {
        width = maxWidth;
        height = maxWidth * 1.0 * l.section.h / l.section.w;
    } else {
        height = maxHeight;
        width = maxHeight * 1.0 * l.section.w / l.section.h;
    }
    $('#contentDiv').css({ width: width, height: height });
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
            window.ove.socket.send('images', window.ove.state.current);
            window.ove.state.cache();
        }
    }
};

beginInitialization = function () {
    $(document).on(OVE.Event.LOADED, function () {
        let state = window.ove.state.name || 'In2White';
        $.ajax({ url: 'state/' + state, dataType: 'json' }).done(function (data) {
            initControl(data);
        });
    });
};
