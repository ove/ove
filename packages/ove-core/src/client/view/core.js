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
    window.ove.frame.on(function (message) {
        if (message.filters) {
            if (message.filters.includeOnly) {
                window.ove.context.includeOnlyFilter = message.filters.includeOnly;
                log.debug('Configured \'includeOnly\' filter:', window.ove.context.includeOnlyFilter);
            } else if (message.filters.exclude) {
                window.ove.context.excludeFilter = message.filters.exclude;
                log.debug('Configured \'exclude\' filter:', window.ove.context.excludeFilter);
            }
        }
        if (message.load) {
            loadFunction();
        }
        if (message.transparentBackground) {
            $('body').css('background', 'none');
        }
    });
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
    if (window.ove.context.includeOnlyFilter && window.ove.context.includeOnlyFilter.indexOf(m.id) === -1) {
        log.info('Using \'includeOnly\' filter. Ignoring Section:', m.id);
        return;
    } else if (window.ove.context.excludeFilter && window.ove.context.excludeFilter.indexOf(m.id) !== -1) {
        log.info('Using \'exclude\' filter. Ignoring Section:', m.id);
        return;
    }
    const id = OVE.Utils.getViewId();
    const client = id.substring(id.lastIndexOf('-') + 1);
    const space = id.substring(0, id.lastIndexOf('-'));
    switch (m.action) {
        case Constants.Action.CREATE:
            let geometry = (m.spaces[space] || [])[client] || {};
            if (Object.keys(geometry).length !== 0 && geometry.h > 0 && geometry.w > 0) {
                log.info('Creating new section:', m.id, ', on client:', client, ', space:', space);
                log.debug('Creating new iFrame with id:', Constants.SECTION_FRAME_ID.substring(1) + m.id);
                $('<iframe>', {
                    id: Constants.SECTION_FRAME_ID.substring(1) + m.id,
                    allowtransparency: true,
                    frameborder: 0,
                    scrolling: 'no'
                }).css({
                    // The height is scaled to avoid random scrollbars.
                    height: geometry.h * 0.999,
                    width: geometry.w,
                    zIndex: m.id,
                    position: 'absolute',
                    marginLeft: geometry.offset.x,
                    marginTop: geometry.offset.y
                }).appendTo('.container');
            }
            break;
        case Constants.Action.UPDATE:
            const frame = $(Constants.SECTION_FRAME_ID + m.id);
            if (frame.length) {
                log.info('Updating section:', m.id, ', on client:', client, ', space:', space);
                if (m.spaces) {
                    // If an iFrame exists, we may need to resize or remove it.
                    let geometry = (m.spaces[space] || [])[client] || {};
                    if (Object.keys(geometry).length !== 0 && geometry.h > 0 && geometry.w > 0) {
                        frame.css({
                            // The height is scaled to avoid random scrollbars.
                            height: geometry.h * 0.999,
                            width: geometry.w,
                            zIndex: m.id,
                            position: 'absolute',
                            marginLeft: geometry.offset.x,
                            marginTop: geometry.offset.y
                        });
                    } else {
                        log.debug('Removing iFrame with id:', Constants.SECTION_FRAME_ID.substring(1) + m.id);
                        frame.remove();
                    }
                } else if (m.app) {
                    const url = m.app.url + '/view.html?oveViewId=' + id + '.' + m.id;
                    log.info('Setting iFrame source URL:', url);
                    frame.attr('src', url);
                    frame.css('opacity', m.app.opacity);
                } else if (frame.attr('src')) {
                    // An app may be un-deployed from a section without deleting the actual section.
                    frame.attr('src', null);
                    log.info('Removing iFrame source URL');
                }
            } else if (m.spaces) {
                let geometry = (m.spaces[space] || [])[client] || {};
                if (Object.keys(geometry).length !== 0 && geometry.h > 0 && geometry.w > 0) {
                    log.info('Updating section:', m.id, ', on client:', client, ', space:', space);
                    log.debug('Creating new iFrame with id:', Constants.SECTION_FRAME_ID.substring(1) + m.id);
                    $('<iframe>', {
                        id: Constants.SECTION_FRAME_ID.substring(1) + m.id,
                        allowtransparency: true,
                        frameborder: 0,
                        scrolling: 'no'
                    }).css({
                        // The height is scaled to avoid random scrollbars.
                        height: geometry.h * 0.999,
                        width: geometry.w,
                        zIndex: m.id,
                        position: 'absolute',
                        marginLeft: geometry.offset.x,
                        marginTop: geometry.offset.y
                    }).appendTo('.container');
                }
            }
            break;
        case Constants.Action.DELETE:
            if (m.id !== undefined) {
                const frame = $(Constants.SECTION_FRAME_ID + m.id);
                if (frame.length) {
                    log.info('Deleting section:', m.id);
                    log.debug('Removing iFrame with id:', Constants.SECTION_FRAME_ID.substring(1) + m.id);
                    frame.remove();
                }
            } else {
                log.info('Deleting all sections');
                log.debug('Removing all iFrames');
                $('iframe').remove();
            }
            break;
        default:
            log.warn('Ignoring unknown action:', m.action);
    }
};
