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
    return new Promise(function (resolve, reject) {
        let context = window.ove.context;
        config.id = 'contentDiv';
        config.prefixUrl = '/images/';
        config.animationTime = 0;
        context.osd = window.OpenSeadragon(config);
        context.osd.clearControls();
        resolve('OSD loaded');
    });
};
