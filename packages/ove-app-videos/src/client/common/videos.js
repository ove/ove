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
    if (!context.isInitialized) {
        $('<script>', { src: 'https://www.youtube.com/iframe_api' }).insertBefore($('script:first'));
    }
    window.ove.socket.on(function (appId, message) {
        if (appId == 'videos' && context.isInitialized) {
            if (message.state) {
                handleStateChange(message.state);
            } else if (message.bufferStatus) {
                handleBufferStatusChange(message.bufferStatus);
            } else if (message.operation) {
                let op = message.operation;
                setTimeout(function () {
                    switch (op.name) {
                        case 'play':
                            context.youtubePlayer.playVideo();
                            if (op.loop) {
                                let timeout = setInterval(function () {
                                    if (context.youtubePlayer.getPlayerState() == 0) {
                                        // if video has reached the end, loop it.
                                        context.youtubePlayer.playVideo();
                                    }
                                }, 100);
                                if (context.loop) {
                                    // the original timer is cleared only after the newer timer has
                                    // been set, to ensure playback is synchronised across browsers.
                                    clearInterval(context.loop);
                                }
                                context.loop = timeout;
                            } else if (context.loop) {
                                clearInterval(context.loop);
                                context.loop = undefined;
                            }
                            break;
                        case 'pause':
                            context.youtubePlayer.pauseVideo();
                            break;
                        case 'stop':
                            context.youtubePlayer.pauseVideo();
                            context.youtubePlayer.seekTo(op.time, true);
                            break;
                        default:
                            context.youtubePlayer.seekTo(op.time, true);
                    }
                // run operation precisely at the same time
                }, op.executionTime - new Date().getTime());
            }
        }
    });
};

loadURL = function () {
    if (window.ove.context.isInitialized) {
        handleStateChange(null);
    } else {
        $(document).on('videos.initialized', function () {
            handleStateChange(null);
        });
    }
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
        $('#youtube_player').hide();
        requestRegistration();
        context.youtubePlayer.loadVideoByUrl(state.url, 0, 'highres');
        $('#youtube_overlay').css('display', 'block');
        setTimeout(function () {
            context.youtubePlayer.setPlaybackQuality(state.playbackQuality || 'highres');
            let rate = 1;
            context.youtubePlayer.getAvailablePlaybackRates().forEach(function (r) {
                if (rate < r) {
                    rate = r;
                }
            });
            context.youtubePlayer.setPlaybackRate(rate);
        }, 500);
        refresh();
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
                context.youtubePlayer.pauseVideo();
                context.youtubePlayer.seekTo(0, true);
                context.youtubePlayer.setPlaybackRate(1);
                $('#youtube_player').show();
                refresh();
            }
        }
    }
};

onYouTubeIframeAPIReady = function () {
    window.ove.context.youtubePlayer = new YT.Player('youtube_player', {
        height: '100%',
        width: '100%',
        videoId: '',
        playerVars: { 'autoplay': 0, 'controls': 0, 'rel': 0, 'showinfo': 0, 'loop': 1 },
        events: {
            'onReady': function (event) { event.target.mute(); },
            'onStateChange': function (event) { }
        }
    });
    var playerLoaded = function () {
        if (!window.ove.context.youtubePlayer.loadVideoByUrl) {
            setTimeout(playerLoaded, 1000);
        } else {
            // The YouTube API takes time to load the player
            window.ove.context.isInitialized = true;
            $(document).trigger('videos.initialized');
        }
    };
    playerLoaded();
};
