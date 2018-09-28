$(function () {
    // This is what happens first. After OVE is loaded, either the viewer or controller
    // will be initialized.
    $(document).ready(function () {
        window.ove = new OVE();
        window.ove.context.isInitialized = false;
        beginInitialization();
    });
});

loadVega = function () {
    if (!window.ove.context.isInitialized) {
        // No initialization to do
        window.ove.context.isInitialized = true;
    }

    if (window.ove.state.current.specURL) {
        let spec = window.ove.state.current.specURL;
        // TODO: test if window.vegaEmbed works and also whether the .then() can be removed.
        // also check if the repeated initialization makes sense or whether the block below
        // needs to be within the initialization block above.
        vegaEmbed(Constants.CONTENT_DIV, spec, window.ove.state.current.options)
            .then(function (result) { })
            .catch(console.error);
    } else if (window.ove.state.current.spec) {
        let spec = JSON.parse(window.ove.state.current.spec);
        vegaEmbed(Constants.CONTENT_DIV, spec, window.ove.state.current.options)
            .then(function (result) { })
            .catch(console.error);
    }
};
