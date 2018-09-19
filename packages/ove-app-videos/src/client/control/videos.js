initControl = function (data) {
    window.ove.context.isInitialized = false;
    initCommon();
    window.ove.state.current = data;
    let url = new URLSearchParams(location.search.slice(1)).get('url');
    if (url) {
        window.ove.state.current.url = url;
    }
    loadURL();
};

refresh = function () { }; // view-only operation

requestRegistration = function () {
    window.ove.socket.send('videos', { bufferStatus: { type: { requestRegistration: true } } });
    window.ove.socket.send('videos', { state: window.ove.state.current });
    window.ove.state.cache();
};

doRegistration = function () { }; // view-only operation

beginInitialization = function () {
    $(document).on('ove.loaded', function () {
        let state = window.ove.state.name || 'DSIIntro';
        $.ajax({ url: 'state/' + state, dataType: 'json' }).done(function (data) {
            initControl(data);
        });
    });
};
