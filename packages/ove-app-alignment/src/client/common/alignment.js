const log = OVE.Utils.Logger(Constants.APP_NAME, Constants.LOG_LEVEL);

$(function () {
    $(document).on(OVE.Event.LOADED, function () {
        log.debug('Invoking OVE.Event.Loaded handler');
        initPage({});
    });

    $(document).ready(function () {
        log.debug('Starting application');
        window.ove = new OVE(Constants.APP_NAME);
        log.debug('Completed loading OVE');
        window.ove.context.isInitialized = false;
    });
});

buildClientsURL = function () {
    let serverURL = '';
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
        if (scripts[i].src.indexOf('ove.js') > 0) {
            serverURL = scripts[i].src.substr(0, scripts[i].src.lastIndexOf('/') + 1);
        }
    }
    return serverURL + 'clients';
};
