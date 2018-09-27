initControl = function (data) {
    window.ove.context.isInitialized = false;
    window.ove.state.current = data;
    let url = OVE.Utils.getQueryParam('url');
    if (url) {
        window.ove.state.current.url = url;
        window.ove.state.current.launchDelay =
            parseInt(OVE.Utils.getQueryParam('launchDelay', 0));
    }
    window.ove.state.current.changeAt = new Date().getTime() + 350;
    window.ove.socket.send('html', window.ove.state.current);
    window.ove.state.cache();
    updateURL();
};

getCSS = function () {
    return { width: '100vw', height: '60vh' };
};

beginInitialization = function () {
    $(document).on(OVE.Event.LOADED, function () {
        let state = window.ove.state.name || 'Matrix';
        $.ajax({ url: 'state/' + state, dataType: 'json' }).done(function (data) {
            initControl(data);
        });
    });
};
