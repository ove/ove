initView = function () {
    window.ove.context.isInitialized = false;
    initCommon();
    setInterval(function () {
        try {
            let context = window.ove.context;
            let youtubePlayer = context.youtubePlayer;
            if (youtubePlayer != null && youtubePlayer.getDuration() > 0) {
                var status = {
                    type: { update: true },
                    clientId: context.uuid,
                    percentage: youtubePlayer.getVideoLoadedFraction() * 100
                };
                if (JSON.stringify(status) !== JSON.stringify(context.bufferStatus.self)) {
                    // avoid repeatedly broadcasting same status
                    handleBufferStatusChange(status);
                    window.ove.socket.send('videos', { bufferStatus: status });
                    context.bufferStatus.self = status;
                }
            }
        } catch (e) { } // random youtube errors
    }, 700);
};

refresh = function () {
    $('#youtube_player').css('transform', 'scale(' + (window.ove.context.scale + 0.001) + ')');
    setTimeout(function () {
        $('#youtube_player').css('transform', 'scale(' + window.ove.context.scale + ')');
    }, 1000);
};

requestRegistration = function () {
    let status = { type: { requestRegistration: true } };
    handleBufferStatusChange(status);
    window.ove.socket.send('videos', { bufferStatus: status });
};

doRegistration = function () {
    let context = window.ove.context;
    if (!context.bufferStatus.clients.includes(context.uuid)) {
        context.bufferStatus.clients.push(context.uuid);
    }
    window.ove.socket.send('videos', { bufferStatus: { type: { registration: true }, clientId: context.uuid } });
    context.bufferStatus.self = {};
};

beginInitialization = function () {
    initView();
    $(document).on('ove.loaded', function () {
        let context = window.ove.context;
        let l = window.ove.layout;
        context.scale = Math.min(l.section.w / l.w, l.section.h / l.h);
        $('#youtube_player').css({
            zoom: 1,
            transformOrigin: 100 * l.x / (l.section.w - l.section.w / context.scale) + '% ' + 100 * l.y / (l.section.h - l.section.h / context.scale) + '%',
            transform: 'scale(' + context.scale + ')',
            width: (l.section.w / context.scale) + 'px',
            height: (l.section.h / context.scale) + 'px'
        });
        window.ove.state.load().then(loadURL);
    });
};
