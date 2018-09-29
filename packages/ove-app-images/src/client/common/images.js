$(function () {
    // This is what happens first. After OVE is loaded, either the viewer or controller
    // will be initialized. Application specific context variables are also initialized at this point.
    $(document).ready(function () {
        window.ove = new OVE(Constants.APP_NAME);
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
            window.ove.context.osd = window.OpenSeadragon(config);
            window.ove.context.osd.clearControls();
            resolve('OSD loaded');
        } catch (e) {
            console.error(e);
            reject(new Error('OSD failed to load'));
        }
    });
};
