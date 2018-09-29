const log = OVE.Utils.Logger(Constants.APP_NAME);

$(function () {
    // This is what happens first. After OVE is loaded, either the viewer or controller
    // will be initialized. Application specific context variables are also initialized at this point.
    $(document).ready(function () {
        log.debug('Starting application');
        window.ove = new OVE(Constants.APP_NAME);
        log.debug('Completed loading OVE');
        window.ove.context.isInitialized = false;
        window.ove.context.sigma = undefined;
        beginInitialization();
    });
});

loadSigma = function () {
    let context = window.ove.context;
    if (!context.isInitialized) {
        // We render on WebGL by default, but this can be overridden for a specific visualization.
        const renderer = window.ove.state.current.renderer || 'webgl';
        const settings = window.ove.state.current.settings || { autoRescale: false, clone: false };
        log.debug('Creating Sigma instance with renderer:', renderer, ', settings:', settings);
        context.sigma = new sigma({
            renderers: [{ type: renderer, container: $(Constants.CONTENT_DIV)[0] }],
            settings: settings
        });
        context.isInitialized = true;
        log.debug('Application is initialized:', context.isInitialized);
    }

    // sigma.js supports two content formats, GEXF (Gephi) and JSON. The format is chosen based
    // on the type of url specified in the state configuration.
    if (window.ove.state.current.jsonURL) {
        log.info('Loading content of format:', 'JSON', ', URL:', window.ove.state.current.jsonURL);
        sigma.parsers.json(window.ove.state.current.jsonURL, context.sigma, function (sigma) {
            log.debug('Refreshing Sigma');
            sigma.refresh();
        });
    } else if (window.ove.state.current.gexfURL) {
        log.info('Loading content of format:', 'GEXF', ', URL:', window.ove.state.current.jsonURL);
        sigma.parsers.gexf(window.ove.state.current.gexfURL, context.sigma, function (sigma) {
            log.debug('Refreshing Sigma');
            sigma.refresh();
        });
    }
};
