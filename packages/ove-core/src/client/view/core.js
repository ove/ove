const log = OVE.Utils.Logger('OVE');

$(function () {
    // This is what happens first. After OVE is loaded, the viewer will be initialized
    $(document).ready(function () {
        window.ove = new OVE(Constants.APP_NAME);
        log.debug('Completed loading OVE');
        window.ove.context.isInitialized = false;
        log.debug('Application is initialized:', window.ove.context.isInitialized);
        initView();
    });
});

initView = function () {
    // We will attempt to load content by restoring the existing state either after a period of time
    // or when the browser is resized.
    const loadFunction = function () {
        if (!window.ove.context.isInitialized) {
            log.debug('Requesting an update of state configuration from server');
            window.ove.socket.send({ action: Constants.Action.READ });
        }
    };
    window.addEventListener('resize', function () {
        // We are waiting to allow Windows to finish resizing the browser.
        setTimeout(loadFunction, Constants.BROWSER_RESIZE_WAIT);
    });
    setTimeout(loadFunction, Constants.BROWSER_IDLE_WAIT);

    window.ove.socket.on(updateSections);
};

updateSections = function (m) {
    if (!window.ove.context.isInitialized) {
        window.ove.context.isInitialized = true;
        log.debug('Application is initialized:', window.ove.context.isInitialized);
    }
    const id = OVE.Utils.getQueryParam('oveViewId');
    switch (m.action) {
        case Constants.Action.CREATE:
            const client = id.substring(id.lastIndexOf('-') + 1);
            const space = id.substring(0, id.lastIndexOf('-'));
            let layout = (m.clients[space] || [])[client] || {};
            if (Object.keys(layout).length !== 0 && layout.h > 0 && layout.w > 0) {
                log.info('Creating new section:', m.id, ', on client:', client, ', space:', space);
                log.debug('Creating new iFrame with id:', Constants.SECTION_FRAME_ID.substring(1) + m.id);
                $('<iframe>', {
                    id: Constants.SECTION_FRAME_ID.substring(1) + m.id,
                    allowtransparency: true,
                    frameborder: 0,
                    scrolling: 'no'
                }).css({
                    // The height is scaled to avoid random scrollbars.
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
                log.info('Updating section:', m.id);
                if (m.app) {
                    const url = m.app.url + '/view.html?oveViewId=' + id + '.' + m.id;
                    log.info('Setting iFrame source URL:', url);
                    frame.attr('src', url);
                } else {
                    // An app may be un-deployed from a section without deleting the actual section.
                    if (frame.attr('src')) {
                        frame.attr('src', null);
                        log.info('Removing iFrame source URL');
                    }
                }
            }
            break;
        case Constants.Action.DELETE:
            if (m.id !== undefined) {
                const frame = $(Constants.SECTION_FRAME_ID + m.id);
                if (frame.length) {
                    log.info('Deleting section:', m.id);
                    frame.remove();
                }
            } else {
                log.info('Deleting all sections');
                $('iframe').remove();
            }
            break;
        default:
            log.warn('Ignoring unknown action:', m.action);
    }
};
