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

cullSections = function (id, hide) {
    // There is no use in displaying content that is completely covered by other content
    // that is in front of it. The only exception is if the content on top is not fully
    // opaque or does not entirely cover the object behind it on a given screen. We first
    // determine the suitability to cull content. And, all content that is being culled
    // will be labelled appropriately such that they can be displayed once again if the
    // section that was originally covering it gets updated or deleted. If there are
    // multiple sections above a given section, then it is important to understand which
    // section was responsible for culling the given content. As culling happens in the
    // order of sections being created the responsibility would generally be with the
    // overlapping section that is the nearest.
    const f = $('iframe:zIndex(' + id + ')');
    if (f.length && (!f.css('opacity') || +f.css('opacity') === 1)) {
        // The region has a format of {w}x{h}+{x}+{y}
        const region = parseFloat(f.css('width')) + 'x' + parseFloat(f.css('height')) + '+' +
            parseFloat(f.css('marginLeft')) + '+' + parseFloat(f.css('marginTop'));
        if (hide) {
            const s = $('iframe:inRegion(' + region + '):behind(' + id + ')');
            if (s.length) {
                log.debug('Hiding ' + s.length + ' sections covered by section:', id);
                s.hide();
                s.each(function () {
                    const e = $(this);
                    e.attr({ hiddenSrc: e.attr('src') }).removeAttr('src');
                });
                s.attr('culledBy', id);
            }
        } else {
            const s = $('iframe:inRegion(' + region + '):behind(' + id + '):hidden')
                .filter(function () { return $(this).attr('culledBy') === id.toString(); });
            if (s.length) {
                log.debug('Displaying ' + s.length + ' sections covered by section:', id);
                s.removeAttr('culledBy');
                s.each(function () {
                    const e = $(this);
                    e.attr({ src: e.attr('hiddenSrc') }).removeAttr('hiddenSrc');
                });
                s.show();
            }
        }
    }
};

initView = function () {
    // Sizzle expressions for occlusion culling
    $.expr[':'].zIndex = function (e, _i, match) {
        return +$(e).css('zIndex') === parseInt(match[3], 10);
    };
    $.expr[':'].behind = function (e, _i, match) {
        return +$(e).css('zIndex') < parseInt(match[3], 10);
    };
    $.expr[':'].inRegion = function (e, _i, match) {
        const g = match[3].split('+');
        const bounds = {
            x: parseFloat(g[1]),
            y: parseFloat(g[2]),
            w: parseFloat(g[0].split('x')[0]),
            h: parseFloat(g[0].split('x')[1])
        };
        const actual = {
            x: parseFloat($(e).css('marginLeft')),
            y: parseFloat($(e).css('marginTop')),
            w: parseFloat($(e).css('width')),
            h: parseFloat($(e).css('height'))
        };
        return (actual.x >= bounds.x) && (actual.x + actual.w <= bounds.x + bounds.w) &&
            (actual.y >= bounds.y) && (actual.y + actual.h <= bounds.y + bounds.h);
    };

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
        if (message.cull) {
            cullSections(message.cull.sectionId, true);
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
    if (window.ove.context.includeOnlyFilter && !window.ove.context.includeOnlyFilter.includes(m.id)) {
        log.info('Using \'includeOnly\' filter. Ignoring Section:', m.id);
        return;
    } else if (window.ove.context.excludeFilter && window.ove.context.excludeFilter.includes(m.id)) {
        log.info('Using \'exclude\' filter. Ignoring Section:', m.id);
        return;
    }
    const id = OVE.Utils.getViewId();
    const client = id.substring(id.lastIndexOf('-') + 1);
    const space = id.substring(0, id.lastIndexOf('-'));
    if (!space) {
        log.warn('Name of space not provided');
    }
    if (!client && client !== 0) {
        log.warn('Client id not provided');
    }
    switch (m.action) {
        case Constants.Action.CREATE: {
            const geometry = (m.spaces && ((m.spaces[space] || [])[client] || {})) || {};
            if (Object.keys(geometry).length !== 0 && geometry.h > 0 && geometry.w > 0) {
                log.info('Creating new section:', m.id, ', on client:', client, ', space:', space);
                log.debug('Creating new iFrame with id:', Constants.SECTION_FRAME_ID.substring(1) + m.id);
                $('<iframe>', {
                    id: Constants.SECTION_FRAME_ID.substring(1) + m.id,
                    allowtransparency: true,
                    frameborder: 0,
                    scrolling: 'no'
                }).css({
                    transformOrigin: 'top left',
                    transform: 'scale(' + (geometry.scale || 1) + ')',
                    // The height is scaled to avoid random scrollbars.
                    height: geometry.h * 0.999,
                    width: geometry.w,
                    zIndex: m.id,
                    position: 'absolute',
                    marginLeft: geometry.offset.x * (geometry.scale || 1),
                    marginTop: geometry.offset.y * (geometry.scale || 1)
                }).appendTo('.container');
            }
            break;
        }
        case Constants.Action.UPDATE: {
            const frame = $(Constants.SECTION_FRAME_ID + m.id);
            if (frame.length) {
                log.info('Updating section:', m.id, ', on client:', client, ', space:', space);
                cullSections(m.id, false);
                if (m.spaces) {
                    // If an iFrame exists, we may need to resize or remove it.
                    const geometry = (m.spaces[space] || [])[client] || {};
                    if (Object.keys(geometry).length !== 0 && geometry.h > 0 && geometry.w > 0) {
                        frame.css({
                            transformOrigin: 'top left',
                            transform: 'scale(' + (geometry.scale || 1) + ')',
                            // The height is scaled to avoid random scrollbars.
                            height: geometry.h * 0.999,
                            width: geometry.w,
                            zIndex: m.id,
                            position: 'absolute',
                            marginLeft: geometry.offset.x * (geometry.scale || 1),
                            marginTop: geometry.offset.y * (geometry.scale || 1)
                        });
                    } else {
                        log.debug('Removing iFrame with id:', Constants.SECTION_FRAME_ID.substring(1) + m.id);
                        frame.remove();
                    }
                } else if (m.app) {
                    const url = m.app.url + '/view.html?oveSectionViewId=' + id + '.' + m.id;
                    log.info('Setting iFrame source URL:', url);
                    frame.attr('src', url);
                    frame.css('opacity', m.app.opacity);
                } else if (frame.attr('src')) {
                    // An app may be un-deployed from a section without deleting the actual section.
                    frame.attr('src', null);
                    log.info('Removing iFrame source URL');
                }
            } else if (m.spaces) {
                const geometry = (m.spaces[space] || [])[client] || {};
                if (Object.keys(geometry).length !== 0 && geometry.h > 0 && geometry.w > 0) {
                    log.info('Updating section:', m.id, ', on client:', client, ', space:', space);
                    log.debug('Creating new iFrame with id:', Constants.SECTION_FRAME_ID.substring(1) + m.id);
                    $('<iframe>', {
                        id: Constants.SECTION_FRAME_ID.substring(1) + m.id,
                        allowtransparency: true,
                        frameborder: 0,
                        scrolling: 'no'
                    }).css({
                        transformOrigin: 'top left',
                        transform: 'scale(' + (geometry.scale || 1) + ')',
                        // The height is scaled to avoid random scrollbars.
                        height: geometry.h * 0.999,
                        width: geometry.w,
                        zIndex: m.id,
                        position: 'absolute',
                        marginLeft: geometry.offset.x * (geometry.scale || 1),
                        marginTop: geometry.offset.y * (geometry.scale || 1)
                    }).appendTo('.container');
                }
            }
            break;
        }
        case Constants.Action.DELETE:
            if (m.id !== undefined) {
                const frame = $(Constants.SECTION_FRAME_ID + m.id);
                if (frame.length) {
                    cullSections(m.id, false);
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
