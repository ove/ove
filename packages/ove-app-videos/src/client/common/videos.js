$(function () {
    $(document).ready(function () {
        window.ove = new OVE();
        window.ove.context.isInitialized = false;
        window.ove.context.bufferStatus = { clients: [] };
        beginInitialization();
    });
});

initCommon = function () {
    let context = window.ove.context;
    window.ove.socket.on(function (appId, message) {
        if (appId == 'videos') {
            if (message.state) {
                handleStateChange(message.state);
            } else if (message.bufferStatus && context.isInitialized) {
                handleBufferStatusChange(message.bufferStatus);
            } else if (message.operation && context.isInitialized) {
                let op = message.operation;
                setTimeout(function () {
                    switch (op.name) {
                        case 'play':
                            context.player.play(op.loop);
                            break;
                        case 'pause':
                            context.player.pause();
                            break;
                        case 'stop':
                            context.player.stop();
                            break;
                        default:
                            context.player.seekTo(op.time);
                    }
                // run operation precisely at the same time
                }, op.executionTime - new Date().getTime());
            }
        }
    });
};

loadURL = function () {
    handleStateChange(null);
};

handleStateChange = function (state) {
    let context = window.ove.context;
    let current = state ? window.ove.state.current : {};
    if (!state) {
        state = window.ove.state.current;
    } else {
        window.ove.state.current = state;
    }
    if (current.url != state.url) {
        if (!context.isInitialized) {
            context.player = state.url.includes('youtube') ? new window.OVEYouTubePlayer() : new window.OVEHTML5VideoPlayer();
            context.player.initialize().then(function () {
                window.ove.context.isInitialized = true;
                $('#video_player').hide();
                requestRegistration();
                context.player.load(state);
                refresh();
            });
        } else {
            $('#video_player').hide();
            requestRegistration();
            context.player.load(state);
            refresh();
        }
    }
};

handleBufferStatusChange = function (status) {
    let context = window.ove.context;
    if (status.type.requestRegistration) {
        doRegistration();
    } else if (status.type.registration && !context.bufferStatus.clients.includes(status.clientId)) {
        context.bufferStatus.clients.push(status.clientId);
    } else if (status.type.update && context.bufferStatus.clients.includes(status.clientId)) {
        if (status.percentage >= 15) {
            context.bufferStatus.clients.splice(context.bufferStatus.clients.indexOf(status.clientId), 1);
            if (context.bufferStatus.clients.length == 0) {
                context.player.ready();
                $('#video_player').show();
                refresh();
            }
        }
    }
};
