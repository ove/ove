function OVEHTML5VideoPlayer () {
    this.initialize = function () {
        return new Promise(function (resolve, reject) {
            $('<video>', {
                id: 'video',
                muted: true,
                autoplay: false,
                controls: false
            }).css({ width: '100%', height: '100%' }).appendTo('#video_player');
            resolve('video player loaded');
        });
    };

    this.load = function (config) {
        $('#video')[0].src = config.url;
        setTimeout(function () {
            $('#video')[0].playbackRate = 1;
        }, 500);
    };

    this.ready = function () {
        this.stop();
        $('#video')[0].playbackRate = 1;
    };

    this.play = function (loop) {
        $('#video')[0].loop = loop;
        $('#video')[0].play();
    };

    this.pause = function () {
        $('#video')[0].pause();
    };

    this.stop = function () {
        this.pause();
        this.seekTo(0);
    };

    this.seekTo = function (time) {
        $('#video')[0].currentTime = time;
    };

    this.isVideoLoaded = function () {
        return $('#video')[0] != null && $('#video')[0].duration > 0;
    };

    this.getLoadedPercentage = function () {
        return $('#video')[0].seekable.end($('#video')[0].seekable.length - 1) * 100 / $('#video')[0].duration;
    };
}
