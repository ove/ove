initView = function () {
    window.ove.context.isInitialized = false;
    window.ove.socket.on(function (appId, message) {
        if (appId === Constants.APP_NAME) {
            window.ove.state.current = message;
            updateURL();
        }
    });
};

getCSS = function () {
    const l = window.ove.layout;
    // The webpage is plotted across the entire canvas and then
    // moved into place based on the client's coordinates.
    return {
        transform: 'translate(-' + l.x + 'px,-' + l.y + 'px)',
        width: l.section.w + 'px',
        height: l.section.h + 'px'
    };
};

beginInitialization = function () {
    OVE.Utils.initView(initView, updateURL);
};
