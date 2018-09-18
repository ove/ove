$(function () {
    $(document).ready(function () {
        window.ove = new OVE();
        window.ove.context.isInitialized = false;
        window.ove.context.osd = undefined;
        initScenario();
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
