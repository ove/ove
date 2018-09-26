function OVEYouTubePlayer () {
    let _private = {};

    this.initialize = function () {
        return new Promise(function (resolve, reject) {
            _private.resolve = resolve;
            $('<script>', { src: 'https://www.youtube.com/iframe_api' }).insertBefore($('script:first'));
        });
    };

    this.load = function (config) {
        _private.player.loadVideoByUrl(config.url, 0, 'highres');
        $('#youtube_overlay').css('display', 'block');
        setTimeout(function () {
            _private.player.setPlaybackQuality(config.playbackQuality || 'highres');
            let rate = 1;
            _private.player.getAvailablePlaybackRates().forEach(function (r) {
                if (rate < r) {
                    rate = r;
                }
            });
            _private.player.setPlaybackRate(rate);
        }, 500);
    };

    this.ready = function () {
        this.stop();
        _private.player.setPlaybackRate(1);
    };

    this.play = function (loop) {
        _private.player.playVideo();
        if (loop) {
            let timeout = setInterval(function () {
                if (_private.player.getPlayerState() == 0) {
                    // if video has reached the end, loop it.
                    _private.player.playVideo();
                }
            }, 100);
            if (_private.loop) {
                // the original timer is cleared only after the newer timer has
                // been set, to ensure playback is synchronised across browsers.
                clearInterval(_private.loop);
            }
            _private.loop = timeout;
        } else if (_private.loop) {
            clearInterval(_private.loop);
            _private.loop = undefined;
        }
    };

    this.pause = function () {
        _private.player.pauseVideo();
    };

    this.stop = function () {
        this.pause();
        this.seekTo(0);
    };

    this.seekTo = function (time) {
        _private.player.seekTo(time, true);
    };

    this.isVideoLoaded = function () {
        return _private.player != null && _private.player.getDuration() > 0;
    };

    this.getLoadedPercentage = function () {
        return _private.player.getVideoLoadedFraction() * 100;
    };

    window.onYouTubeIframeAPIReady = function () {
        _private.player = new window.YT.Player('video_player', {
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
            if (!_private.player.loadVideoByUrl) {
                setTimeout(playerLoaded, 1000);
            } else {
                // The YouTube API takes time to load the player
                _private.resolve('youtube player loaded');
            }
        };
        playerLoaded();
    };
}
