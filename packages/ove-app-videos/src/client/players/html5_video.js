function OVEHTML5VideoPlayer () {
    const log = OVE.Utils.Logger('HTML5VideoPlayer', Constants.LOG_LEVEL);
    const getPlayer = function () {
        return $('#video')[0];
    };

    this.initialize = function () {
        return new Promise(function (resolve) {
            $('<video>', {
                id: 'video',
                muted: true,
                autoplay: false,
                controls: false
            }).css({ width: '100%', height: '100%' }).appendTo(Constants.CONTENT_DIV);
            OVE.Utils.logThenResolve(log.debug, resolve, 'video player loaded');
        });
    };

    this.load = function (config) {
        log.debug('Loading video at URL:', config.url);
        getPlayer().src = config.url;
        setTimeout(function () {
            // Wait for the player to be ready.
            getPlayer().playbackRate = Constants.STANDARD_RATE;
        }, Constants.VIDEO_READY_TIMEOUT);
    };

    // The ready function is similar to the stop function in this case.
    this.ready = this.stop;

    this.play = function (loop) {
        log.debug('Playing video', 'loop:', loop);
        getPlayer().loop = loop;
        getPlayer().play();
    };

    this.pause = function () {
        log.debug('Pausing video');
        getPlayer().pause();
    };

    this.seekTo = function (time) {
        log.debug('Seeking to time:', time);
        getPlayer().currentTime = time;
    };

    this.stop = function () {
        log.debug('Stopping video or preparing video for playback');
        // Stopping a video is the same as pausing it and moving the time slider
        // to the beginning.
        this.pause();
        this.seekTo(Constants.STARTING_TIME);
    };

    this.isVideoLoaded = function () {
        return getPlayer() && getPlayer().duration > 0;
    };

    this.getLoadedPercentage = function () {
        return getPlayer().seekable.end(getPlayer().seekable.length - 1) * 100 / getPlayer().duration;
    };

    this.getLoadedDuration = function () {
        return getPlayer().duration * this.getLoadedPercentage() / 100;
    };
}
