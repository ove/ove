function OVEYouTubePlayer () {
    const VIDEO_READY_TIMEOUT = 500;
    const STARTING_TIME = 0;
    const STANDARD_RATE = 1;
    const YOUTUBE_PLAYER_LOADED_TEST_INTERVAL = 1000;
    const YOUTUBE_PLAYBACK_LOOP_TEST_INTERVAL = 100;

    let __private = {};

    this.initialize = function () {
        return new Promise(function (resolve) {
            // We retain a reference to the resolve method, because this promise would be
            // resolved later on. See window.onYouTubeIframeAPIReady below.
            __private.resolve = resolve;

            // This is the recommended way to load the YouTube embedded player.
            $('<script>', { src: 'https://www.youtube.com/iframe_api' }).insertBefore($('script:first'));
        });
    };

    this.load = function (config) {
        __private.player.loadVideoByUrl(config.url, 0, 'highres');
        $('#youtube_overlay').css('display', 'block');
        setTimeout(function () {
            // We force high resolution playback unless the playback quality was provided.
            // Please note that the video is initially loaded as high resolution, but setting
            // this once again is required.
            __private.player.setPlaybackQuality(config.playbackQuality || 'highres');

            // We initially load the video at the best rate available. This will
            // make it load much faster.
            let rate = STANDARD_RATE;
            __private.player.getAvailablePlaybackRates().forEach(function (r) {
                if (rate < r) {
                    rate = r;
                }
            });
            __private.player.setPlaybackRate(rate);
        }, VIDEO_READY_TIMEOUT);
    };

    this.ready = function () {
        this.stop();
        __private.player.setPlaybackRate(1);
    };

    this.play = function (loop) {
        __private.player.playVideo();
        if (loop) {
            let timeout = setInterval(function () {
                if (__private.player.getPlayerState() === 0) {
                    // If video has reached the end, loop it.
                    __private.player.playVideo();
                }
            }, YOUTUBE_PLAYBACK_LOOP_TEST_INTERVAL);
            if (__private.loop) {
                // The original timer is cleared only after the newer timer has
                // been set, to ensure playback is synchronized across browsers.
                clearInterval(__private.loop);
            }
            __private.loop = timeout;
        } else if (__private.loop) {
            // If a timer is already set, it would no longer be required.
            clearInterval(__private.loop);
            __private.loop = undefined;
        }
    };

    this.pause = function () {
        __private.player.pauseVideo();
    };

    this.seekTo = function (time) {
        __private.player.seekTo(time, true);
    };

    this.stop = function () {
        this.pause();
        this.seekTo(STARTING_TIME);
    };

    this.isVideoLoaded = function () {
        return __private.player && __private.player.getDuration() > 0;
    };

    this.getLoadedPercentage = function () {
        return __private.player.getVideoLoadedFraction() * 100;
    };

    this.getLoadedDuration = function () {
        return __private.player.getDuration() * this.getLoadedPercentage() / 100;
    };

    // This is a callback provided by YouTube to instantiate their Player.
    window.onYouTubeIframeAPIReady = function () {
        __private.player = new window.YT.Player('video_player', {
            height: '100%',
            width: '100%',
            videoId: '',
            playerVars: { 'autoplay': 0, 'controls': 0, 'rel': 0, 'showinfo': 0, 'loop': 1 },
            events: {
                'onReady': function (event) { event.target.mute(); },
                'onStateChange': function (event) { }
            }
        });
        const playerLoaded = function () {
            if (!__private.player.loadVideoByUrl) {
                setTimeout(playerLoaded, YOUTUBE_PLAYER_LOADED_TEST_INTERVAL);
            } else {
                // The YouTube API takes time to load the player
                __private.resolve('youtube player loaded');
            }
        };
        playerLoaded();
    };
}
