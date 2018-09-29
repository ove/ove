const log = OVE.Utils.Logger(Constants.APP_NAME);

$(function () {
    // This is what happens first. After OVE is loaded, either the viewer or controller
    // will be initialized.
    $(document).ready(function () {
        log.debug('Starting application');
        window.ove = new OVE(Constants.APP_NAME);
        log.debug('Completed loading OVE');
        window.ove.context.isInitialized = false;
        beginInitialization();
    });
});

loadVega = function () {
    if (!window.ove.context.isInitialized) {
        // No initialization to do
        window.ove.context.isInitialized = true;
        log.debug('Application is initialized:', window.ove.context.isInitialized);
    }

    const state = window.ove.state.current;
    // Vega specification can either be inline or provided at some URL.
    if (state.specURL) {
        log.info('Loading Vega spec at url:', state.specURL, ', with options:', state.options);
        window.vegaEmbed(Constants.CONTENT_DIV, state.specURL, state.options).catch(log.error);
    } else if (state.spec) {
        log.info('Loading inline Vega spec with options:', state.options);
        window.vegaEmbed(Constants.CONTENT_DIV, JSON.parse(state.spec), state.options).catch(log.error);
    }
};
