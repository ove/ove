$(function () {
    // This is what happens first. After OVE is loaded, either the viewer or controller
    // will be initialized. Application specific context variables are also initialized at this point.
    $(document).ready(function () {
        window.ove = new OVE();
        window.ove.context.isInitialized = false;
        window.ove.context.osd = undefined;
        beginInitialization();
    });
});

loadOSD = function (config) {
    // Returns a promise such that subsequent tasks can happen following this.
    return new Promise(function (resolve) {
        config.id = Constants.CONTENT_DIV.substring(1);
        config.prefixUrl = '/images/';
        config.animationTime = 0;
        window.ove.context.osd = window.OpenSeadragon(config);
        window.ove.context.osd.clearControls();
        resolve('OSD loaded');
    });
};
