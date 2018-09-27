initView = function () {
    window.ove.context.isInitialized = false;
    window.ove.socket.on(function (appId, message) {
        if (appId === Constants.APP_NAME) {
            window.ove.state.current = message;
            loadSigma();
        }
    });
};

beginInitialization = function () {
    initView();
    $(document).on(OVE.Event.LOADED, function () {
        if (!window.ove.context.isInitialized) {
            window.ove.state.load().then(loadSigma);
        }
        const l = window.ove.layout;
        // The network is plotted across the entire canvas and then
        // moved into place based on the client's coordinates.
        $(Constants.CONTENT_DIV).css({
            transform: 'translate(-' + l.x + 'px,-' + l.y + 'px)',
            width: l.section.w + 'px',
            height: l.section.h + 'px'
        });
    });
};
