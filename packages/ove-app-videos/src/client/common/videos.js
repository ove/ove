const log = OVE.Utils.Logger(Constants.APP_NAME);

$(function () {
    // This is what happens first. After OVE is loaded, either the viewer or controller
    // will be initialized. The viewer or controller has the freedom to call the initCommon
    // at any point. Application specific context variables are also initialized at this point.
    $(document).ready(function () {
        log.debug('Starting application');
        window.ove = new OVE(Constants.APP_NAME);
        log.debug('Completed loading OVE');
        window.ove.context.isInitialized = false;
        window.ove.context.bufferStatus = { clients: [] };
        beginInitialization();
    });
});

// Initialization that is common to viewers and controllers.
initCommon = function () {
    const context = window.ove.context;
    window.ove.socket.on(function (message) {
        // We can receive a stat update before the application has been initialized.
        // this happens for controller-initiated flows.
        if (message.state) {
            log.debug('Got state change request: ', message.state);
            handleStateChange(message.state);
        } else if (message.bufferStatus && context.isInitialized) {
            log.debug('Got buffer status change request: ', message.bufferStatus);
            handleBufferStatusChange(message.bufferStatus);
        } else if (message.operation && context.isInitialized) {
            log.debug('Got invoke operation request: ', message.operation);
            const op = message.operation;

            setTimeout(function () {
                switch (op.name) {
                    case Constants.Operation.PLAY:
                        log.info('Starting video playback ' + (op.loop ? 'with' : 'without') + ' loop');
                        context.player.play(op.loop);
                        break;
                    case Constants.Operation.PAUSE:
                        log.info('Pausing video playback');
                        context.player.pause();
                        break;
                    case Constants.Operation.STOP:
                        log.info('Stopping video playback');
                        context.player.stop();
                        break;
                    case Constants.Operation.SEEK:
                        log.info('Seeking to time:', op.time);
                        context.player.seekTo(op.time);
                        break;
                    default:
                        log.warn('Ignoring unknown operation:', op.name);
                }
            // Run operation precisely at the same time
            }, op.executionTime - new Date().getTime());
        }
    });
};

loadURL = function () {
    // The current state would have been set when this method is called, but there
    // is no incoming state, as when we receive a message. Therefore, passing null.
    handleStateChange(null);
};

handleStateChange = function (state) {
    let current = {};
    if (!state) {
        // If incoming state is null, we don't need to care about current state.
        log.debug('Handling first state change - current state does not exist');
        state = window.ove.state.current;
    } else {
        log.debug('Handling state change');
        current = window.ove.state.current;
        window.ove.state.current = state;
    }

    if (current.url !== state.url) {
        log.info('Got new video URL:', state.url);
        let context = window.ove.context;

        // The way we load the player doesn't change even if the application was
        // not initialized - the only difference is the need to wait for the
        // initialization to complete.
        const loadPlayer = function () {
            log.debug('Hiding video player');
            $(Constants.CONTENT_DIV).hide();

            requestRegistration();
            log.debug('Reloading video player with new state:', state);
            context.player.load(state);
            refresh();
        };

        if (!context.isInitialized) {
            // The player is decided based on the URL.
            if (state.url.includes('youtube')) {
                log.info('Starting YouTube video player');
                context.player = new window.OVEYouTubePlayer();
            } else {
                log.info('Starting HTML5 video player');
                context.player = new window.OVEHTML5VideoPlayer();
            }
            context.player.initialize().then(function () {
                context.isInitialized = true;
                log.debug('Application is initialized:', context.isInitialized);
                loadPlayer();
            });
        } else {
            loadPlayer();
        }
    }
};

handleBufferStatusChange = function (status) {
    // The handling of the buffer status updates operates in a model as noted below:
    //   1. One or more peers in a group receives a new video URL
    //   2. They then send a request for registration to all peers belonging to the same
    //      section.
    //   3. When one or more peers respond, their responses will then be received as
    //      registration responses. If a peer does not respond, the rest of the system
    //      will not wait. If a peer is late to respond, they may join the group later on,
    //      but this will not stop a video that is already playing.
    //   4. After the above steps are completed peers start broadcasting their buffer statuses.
    //   5. If at least 15% of a video is buffered across all peers synchronized playback
    //      can begin and the video will be displayed.
    const context = window.ove.context;
    if (status.type.requestRegistration) {
        // This code is executed when this instance of the application receives a
        // registration request. The controller and the viewer handles this differently.
        log.debug('Got request for registration');
        doRegistration();
    } else if (status.type.registration && !context.bufferStatus.clients.includes(status.clientId)) {
        log.debug('Got response to registration request. Adding client to status update queue:', status.clientId);

        // This code is executed when a response to a registration request has been received.
        context.bufferStatus.clients.push(status.clientId);
    } else if (status.type.update && context.bufferStatus.clients.includes(status.clientId)) {
        // This code is executed when a registered peer sends a buffer status update.
        log.debug('Got buffer status update from client:', status.clientId,
            ', percentage:', status.percentage, ', duration:', status.duration);

        if (status.percentage >= Constants.MIN_BUFFERED_PERCENTAGE ||
            status.duration >= Constants.MIN_BUFFERED_DURATION) {
            // Clients are dequeued from the status update queue when they have buffered a sufficient
            // percentage or duration of the video.
            log.debug('Removing client from status update queue:', status.clientId);
            context.bufferStatus.clients.splice(context.bufferStatus.clients.indexOf(status.clientId), 1);

            if (context.bufferStatus.clients.length === 0) {
                log.info('Video buffering complete');
                context.player.ready();

                log.debug('Displaying video player');
                $(Constants.CONTENT_DIV).show();
                refresh();
            }
        }
    }
};
