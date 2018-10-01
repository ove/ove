initView = function () {
    window.ove.context.isInitialized = false;
    log.debug('Application is initialized:', window.ove.context.isInitialized);
    OVE.Utils.setOnStateUpdate(updateURL);
};

getCSS = function () {
    const l = window.ove.layout;
    // The webpage is plotted across the entire section and then
    // moved into place based on the client's coordinates.
    const css = {
        transform: 'translate(-' + l.x + 'px,-' + l.y + 'px)',
        width: l.section.w + 'px',
        height: l.section.h + 'px'
    };
    log.debug('Resizing viewer with height:', css.height, ', width:', css.width);
    log.debug('Performing CSS transform on viewer', css.transform);
    return css;
};

beginInitialization = function () {
    log.debug('Starting viewer initialization');
    OVE.Utils.initView(initView, updateURL);
};
