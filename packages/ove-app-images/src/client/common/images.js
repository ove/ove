const log = OVE.Utils.Logger(Constants.APP_NAME);

$(function () {
    // This is what happens first. After OVE is loaded, either the viewer or controller
    // will be initialized. Application specific context variables are also initialized at this point.
    $(document).ready(function () {
        log.debug('Starting application');
        window.ove = new OVE(Constants.APP_NAME);
        log.debug('Completed loading OVE');
        window.ove.context.isInitialized = false;
        window.ove.context.osd = undefined;
        beginInitialization();
    });
});

loadOSD = function (config) {
    // Returns a promise such that subsequent tasks can happen following this.
    return new Promise(function (resolve, reject) {
        config.id = Constants.CONTENT_DIV.substring(1);
        config.prefixUrl = '/images/';
        config.animationTime = 0;
        try {
            log.info('Loading OpenSeadragon with config:', config);
            window.ove.context.osd = window.OpenSeadragon(config);
            log.debug('Clearing controls');
            window.ove.context.osd.clearControls();
            resolve('OSD loaded');
        } catch (e) {
            OVE.Utils.logThenReject(log.error, reject, 'OSD failed to load', e);
        }
    });
};
