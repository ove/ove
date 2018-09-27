function OVEYouTubePlayer () {
    const VIDEO_READY_TIMEOUT = 500;
    const STARTING_TIME = 0;
    const STANDARD_RATE = 1;
    const YOUTUBE_PLAYER_LOADED_TEST_INTERVAL = 1000;
    const YOUTUBE_PLAYBACK_LOOP_TEST_INTERVAL = 100;

    let _private = {};

    this.initialize = function () {
        return new Promise(function (resolve) {
            // We retain a reference to the resolve method, because this promise would be
            // resolved later on. See window.onYouTubeIframeAPIReady below.
            _private.resolve = resolve;

            // This is the recommended way to load the YouTube embedded player.
            $('<script>', { src: 'https://www.youtube.com/iframe_api' }).insertBefore($('script:first'));
        });
    };

    this.load = function (config) {
        _private.player.loadVideoByUrl(config.url, 0, 'highres');
        $('#youtube_overlay').css('display', 'block');
        setTimeout(function () {
            // We force high resolution playback unless the playback quality was provided.
            // Please note that the video is initially loaded as high resolution, but setting
            // this once again is required.
            _private.player.setPlaybackQuality(config.playbackQuality || 'highres');

            // We initially load the video at the best rate available. This will
            // make it load much faster.
            let rate = STANDARD_RATE;
            _private.player.getAvailablePlaybackRates().forEach(function (r) {
                if (rate < r) {
                    rate = r;
                }
            });
            _private.player.setPlaybackRate(rate);
        }, VIDEO_READY_TIMEOUT);
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
                    // If video has reached the end, loop it.
                    _private.player.playVideo();
                }
            }, YOUTUBE_PLAYBACK_LOOP_TEST_INTERVAL);
            if (_private.loop) {
                // The original timer is cleared only after the newer timer has
                // been set, to ensure playback is synchronized across browsers.
                clearInterval(_private.loop);
            }
            _private.loop = timeout;
        } else if (_private.loop) {
            // If a timer is already set, it would no longer be required.
            clearInterval(_private.loop);
            _private.loop = undefined;
        }
    };

    this.pause = function () {
        _private.player.pauseVideo();
    };

    this.seekTo = function (time) {
        _private.player.seekTo(time, true);
    };

    this.stop = function () {
        this.pause();
        this.seekTo(STARTING_TIME);
    };

    this.isVideoLoaded = function () {
        return _private.player && _private.player.getDuration() > 0;
    };

    this.getLoadedPercentage = function () {
        return _private.player.getVideoLoadedFraction() * 100;
    };

    // This is a callback provided by YouTube to instantiate their Player.
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
        let playerLoaded = function () {
            if (!_private.player.loadVideoByUrl) {
                setTimeout(playerLoaded, YOUTUBE_PLAYER_LOADED_TEST_INTERVAL);
            } else {
                // The YouTube API takes time to load the player
                _private.resolve('youtube player loaded');
            }
        };
        playerLoaded();
    };
}
