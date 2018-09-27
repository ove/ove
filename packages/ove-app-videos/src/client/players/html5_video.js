function OVEHTML5VideoPlayer () {
    let getPlayer = function () {
        return $('#video')[0];
    };

    this.initialize = function () {
        return new Promise(function (resolve, reject) {
            $('<video>', {
                id: 'video',
                muted: true,
                autoplay: false,
                controls: false
            }).css({ width: '100%', height: '100%' }).appendTo(Constants.VIDEO_PLAYER_DIV);
            resolve('video player loaded');
        });
    };

    this.load = function (config) {
        getPlayer().src = config.url;
        setTimeout(function () {
            // Wait for the player to be ready.
            getPlayer().playbackRate = Constants.STANDARD_RATE;
        }, Constants.VIDEO_READY_TIMEOUT);
    };

    // The ready function is similar to the stop function in this case.
    this.ready = this.stop;

    this.play = function (loop) {
        getPlayer().loop = loop;
        getPlayer().play();
    };

    this.pause = function () {
        getPlayer().pause();
    };

    this.seekTo = function (time) {
        getPlayer().currentTime = time;
    };

    this.stop = function () {
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
}
