$(function () {
    $(document).ready(function () {
        window.ove = new OVE();
        window.ove.context.isInitialized = false;
        window.ove.context.sigma = undefined;
        beginInitialization();
    });
});

loadSigma = function () {
    let context = window.ove.context;
    if (!context.isInitialized) {
        context.sigma = new sigma({
            renderers: [{ type: (window.ove.state.current.renderer || 'webgl'), container: $('#graphArea')[0] }],
            settings: window.ove.state.current.settings || { autoRescale: false, clone: false }
        });
        context.isInitialized = true;
    }
    if (window.ove.state.current.jsonURL) {
        sigma.parsers.json(window.ove.state.current.jsonURL, context.sigma, function (sigma) {
            sigma.refresh();
        });
    } else if (window.ove.state.current.gexfURL) {
        sigma.parsers.gexf(window.ove.state.current.gexfURL, context.sigma, function (sigma) {
            sigma.refresh();
        });
    }
};
