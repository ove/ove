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
    let loadFunction = function () {
        if (!window.ove.context.isInitialized) {
            window.ove.socket.send('core', { action: 'request' });
        }
    };
    window.addEventListener('resize', function () {
        // We are waiting for a further 5s here to allow Windows to finish resizing the browser.
        setTimeout(loadFunction, 5000);
    });
    setTimeout(loadFunction, 15000);

    window.ove.socket.on(function (appId, message) {
        if (appId === 'core') {
            updateSections(message);
        }
    });
};

updateSections = function (m) {
    if (!window.ove.context.isInitialized) {
        window.ove.context.isInitialized = true;
    }
    let id = OVE.Utils.getQueryParam('oveClientId');
    if (m.action === 'create') {
        let client = id.substr(id.lastIndexOf('-') + 1);
        let space = id.substr(0, id.lastIndexOf('-'));
        let layout = (m.clients[space] || [])[client] || {};
        if (Object.keys(layout).length === 0) {
            // This can happen either when the clientId was valid and no layout exists or if the clientId was invalid.
            // This ensures that a frame is still created but not visible.
            layout = { h: 0, w: 0, offset: { x: 0, y: 0 } };
        }
        if (layout.h > 0 && layout.w > 0) {
            $('<iframe>', {
                id: 'content-frame-section-' + m.id,
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
    } else if (m.action === 'update') {
        let frame = $('#content-frame-section-' + m.id);
        if (frame.length) {
            if (m.app) {
                frame.attr('src', m.app.url + '/view.html?oveClientId=' + id + '.' + m.id);
            } else {
                if (frame.attr('src')) {
                    frame.attr('src', null);
                }
            }
        }
    } else if (m.action === 'delete') {
        if (m.id) {
            let frame = $('#content-frame-section-' + m.id);
            if (frame.length) {
                frame.remove();
            }
        } else {
            $('iframe').remove();
        }
    }
};
