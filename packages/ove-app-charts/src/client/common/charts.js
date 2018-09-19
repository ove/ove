$(function () {
    $(document).ready(function () {
        window.ove = new OVE();
        window.ove.context.isInitialized = false;
        beginInitialization();
    });
});

loadVega = function () {
    let context = window.ove.context;
    if (!context.isInitialized) {
        // no initialization to do
        context.isInitialized = true;
    }

    if (window.ove.state.current.specURL) {
        let spec = window.ove.state.current.specURL;
        vegaEmbed('#vegaArea', spec, window.ove.state.current.options)
            .then(function (result) { })
            .catch(console.error);
    } else if (window.ove.state.current.spec) {
        let spec = JSON.parse(window.ove.state.current.spec);
        vegaEmbed('#vegaArea', spec, window.ove.state.current.options)
            .then(function (result) { })
            .catch(console.error);
    }
};
