// requires howler 
// API doc @ https://github.com/goldfire/howler.js/
function OVEHowler () {
    const log = OVE.Utils.Logger('Howler');
    
    this.player =  null;
    this.initialize = function () {

        return new Promise(function (resolve, reject) {
            // we don't need any html but if we did here is where to add it 
            OVE.Utils.logThenResolve(log.debug, resolve, 'audio player loaded');
        });
    };

    this.load = function (config) {
        log.debug('Loading audio at URL:', config.url);
        // todo set up volume from state 
        // todo set up xyz positionality 
        this.player = new Howl( {
                src: [config.url]
            });
        
    };

    this.ready = function () {
        this.stop();
    };

    this.play = function (loop, volume) {
        log.debug('Playing audio', 'loop:', loop, 'volume:',volume);
        this.player.loop(loop);
        if (volume != undefined) {
            this.player.volume(volume);
        }
        this.player.play();
    };

    this.pause = function () {
        log.debug('Pausing audio');
        this.player.pause();
    };

    this.mute = function () {
        log.debug('muting audio');
        this.player.mute(true);
    };

    this.unmute = function () {
        log.debug('unmuting audio');
        this.player.mute(false);
    };

    this.setVolume = function(volume) {
        log.debug('setting volume to');
        this.player.volume(volume);
    };

    this.volUp = function() {
        log.debug('increasing volume');
        let newVol = this.player.volume*Constants.VOLUMEUP_MULTIPLIER;
        this.player.volume( newVol > 1 ? 1 : newVol);
    };

    this.volDown = function() {
        log.debug('decreasing volume');
        let newVol = this.player.volume*Constants.VOLUMEDOWN_MULTIPLIER;
        this.player.volume( newVol <0 ? 0 : newVol);
    };

    this.setPosition = function(x,y,z) {
        log.debug('setting audio position to x:',x,' y:',y,' z:',z);
        this.player.stereo(x);
    };

    this.stop = function () {
        log.debug('stopping audio');
        this.player.stop();// also seeks to zero
    };

    this.seekTo = function (time) {
        log.debug('seeking to time: ',time);
        this.player.seek(time);
    };

    this.isAudioLoaded = function () {
        return this.player.state() === 'loaded';
    };

    this.getLoadedPercentage = function () {
        return this.isAudioLoaded ? 100 : 0 ;
    };

    this.getLoadedDuration = function () {
        return getPlayer().duration * this.getLoadedPercentage() / 100;
    };
}
