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
    OVE.Utils.initView(initView, loadVega, function () {
        const l = window.ove.layout;
        $('#vegaArea').css({
            transform: 'translate(-' + l.x + 'px,-' + l.y + 'px)',
            width: l.section.w + 'px',
            height: l.section.h + 'px'
        });
    });
};
