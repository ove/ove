initView = function () {
    window.ove.context.isInitialized = false;
    log.debug('Application is initialized:', window.ove.context.isInitialized);
    OVE.Utils.setOnStateUpdate(loadSigma);
};

beginInitialization = function () {
    log.debug('Starting viewer initialization');
    OVE.Utils.initView(initView, loadSigma, function () {
        OVE.Utils.resizeController(Constants.CONTENT_DIV);
    });
};
