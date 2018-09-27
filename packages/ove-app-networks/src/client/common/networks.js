$(function () {
    // This is what happens first. After OVE is loaded, either the viewer or controller
    // will be initialized. Application specific context variables are also initialized at this point.
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
            // We render on WebGL by default, but this can be overridden for a specific visualization.
            renderers: [{ type: (window.ove.state.current.renderer || 'webgl'), container: $(Constants.CONTENT_DIV)[0] }],
            settings: window.ove.state.current.settings || { autoRescale: false, clone: false }
        });
        context.isInitialized = true;
    }
    // sigma.js supports two content formats, GEXF (Gephi) and JSON. The format is chosen based
    // on the type of url specified in the state configuration.
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
