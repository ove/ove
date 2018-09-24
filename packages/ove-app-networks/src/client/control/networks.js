initControl = function (data) {
    let context = window.ove.context;
    context.isInitialized = false;

    let l = window.ove.layout;
    let maxWidth = Math.min(document.documentElement.clientWidth, window.innerWidth);
    let maxHeight = Math.min(document.documentElement.clientHeight, window.innerHeight);
    // multiplying by 1.0 for float division
    let width, height;
    if (l.section.w * maxHeight >= maxWidth * l.section.h) {
        width = maxWidth;
        height = maxWidth * 1.0 * l.section.h / l.section.w;
    } else {
        height = maxHeight;
        width = maxHeight * 1.0 * l.section.w / l.section.h;
    }
    $('#graphArea').css({ width: width, height: height });
    window.ove.state.current = data;
    loadSigma();
    window.ove.socket.send('networks', window.ove.state.current);
    window.ove.state.cache();
};

beginInitialization = function () {
    $(document).on('ove.loaded', function () {
        let state = window.ove.state.name || 'SigmaSample';
        $.ajax({ url: 'state/' + state, dataType: 'json' }).done(function (data) {
            initControl(data);
        });
    });
};
