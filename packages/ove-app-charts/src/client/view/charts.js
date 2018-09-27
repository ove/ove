initView = function () {
    window.ove.context.isInitialized = false;
    window.ove.socket.on(function (appId, message) {
        if (appId === 'charts') {
            window.ove.state.current = message;
            loadVega();
        }
    });
};

beginInitialization = function () {
    initView();
    $(document).on(OVE.Event.LOADED, function () {
        if (!window.ove.context.isInitialized) {
            window.ove.state.load().then(loadVega);
        }
        let l = window.ove.layout;
        $('#vegaArea').css({
            transform: 'translate(-' + l.x + 'px,-' + l.y + 'px)',
            width: l.section.w + 'px',
            height: l.section.h + 'px'
        });
    });
};
