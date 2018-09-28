$(function () {
    // This is what happens first. After OVE is loaded, the viewer will be initialized
    $(document).ready(function () {
        window.ove = new OVE();
        window.ove.context.isInitialized = false;
        initView();
    });
});

initView = function () {
    // We will attempt to load content by restoring the existing state either after 15s,
    // or when the browser is resized.
    const loadFunction = function () {
        if (!window.ove.context.isInitialized) {
            window.ove.socket.send(Constants.APP_NAME, { action: Constants.Action.READ });
        }
    };
    window.addEventListener('resize', function () {
        // We are waiting for a further 5s here to allow Windows to finish resizing the browser.
        setTimeout(loadFunction, 5000);
    });
    setTimeout(loadFunction, 15000);

    window.ove.socket.on(function (appId, message) {
        if (appId === Constants.APP_NAME) {
            updateSections(message);
        }
    });
};

updateSections = function (m) {
    if (!window.ove.context.isInitialized) {
        window.ove.context.isInitialized = true;
    }
    const id = OVE.Utils.getQueryParam('oveClientId');
    switch (m.action) {
        case Constants.Action.CREATE:
            const client = id.substr(id.lastIndexOf('-') + 1);
            const space = id.substr(0, id.lastIndexOf('-'));
            let layout = (m.clients[space] || [])[client] || {};
            if (Object.keys(layout).length === 0) {
                // This can happen either when the clientId was valid and no layout exists or if the clientId was invalid.
                // This ensures that a frame is still created but not visible.
                layout = { h: 0, w: 0, offset: { x: 0, y: 0 } };
            }
            if (layout.h > 0 && layout.w > 0) {
                $('<iframe>', {
                    id: Constants.SECTION_FRAME_ID.substring(1) + m.id,
                    frameborder: 0,
                    scrolling: 'no'
                }).css({
                    // The height is scaled to suit display ranges in most screens
                    height: layout.h * 0.999,
                    width: layout.w,
                    zIndex: m.id,
                    position: 'absolute',
                    marginLeft: layout.offset.x,
                    marginTop: layout.offset.y
                }).appendTo('.container');
            }
            break;
        case Constants.Action.UPDATE:
            const frame = $(Constants.SECTION_FRAME_ID + m.id);
            if (frame.length) {
                if (m.app) {
                    frame.attr('src', m.app.url + '/view.html?oveClientId=' + id + '.' + m.id);
                } else {
                    // An app may be un-deployed from a section without deleting the actual section.
                    if (frame.attr('src')) {
                        frame.attr('src', null);
                    }
                }
            }
            break;
        case Constants.Action.DELETE:
            if (m.id) {
                const frame = $(Constants.SECTION_FRAME_ID + m.id);
                if (frame.length) {
                    frame.remove();
                }
            } else {
                // All sections can be deleted at once.
                $('iframe').remove();
            }
            break;
        default:
            console.warn('Ignoring unknown action: ' + m.action);
    }
};
