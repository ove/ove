initView = function () {
    window.ove.context.isInitialized = false;
    window.ove.socket.on(function (appId, message) {
        if (appId == 'html') {
            window.ove.state.current = message;
            updateURL();
        }
    });
};

getCSS = function () {
    let l = window.ove.layout;
    return {
        transform: 'translate(-' + l.x + 'px,-' + l.y + 'px)',
        width: l.section.w + 'px',
        height: l.section.h + 'px'
    };
};

initScenario = function () {
    initView();
    $(document).on('ove.loaded', function () {
        if (!window.ove.context.isInitialized) {
            window.ove.state.load().then(updateURL);
        }
    });
};
