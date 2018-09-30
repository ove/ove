initView = function () {
    window.ove.context.isInitialized = false;
    log.debug('Application is initialized:', window.ove.context.isInitialized);
    OVE.Utils.setOnStateUpdate(loadVega);
};

beginInitialization = function () {
    log.debug('Starting viewer initialization');
    OVE.Utils.initView(initView, loadVega, function () {
        OVE.Utils.resizeController(Constants.CONTENT_DIV);
    });
};
