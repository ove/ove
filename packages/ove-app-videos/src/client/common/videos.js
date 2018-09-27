$(function () {
    // This is what happens first. After OVE is loaded, either the viewer or controller
    // will be initialized. The viewer or controller has the freedom to call the initCommon
    // at any point. Application specific context variables are also initialized at this point.
    $(document).ready(function () {
        window.ove = new OVE();
        window.ove.context.isInitialized = false;
        window.ove.context.bufferStatus = { clients: [] };
        beginInitialization();
    });
});

// Initialization that is common to viewers and controllers.
initCommon = function () {
    const context = window.ove.context;
    window.ove.socket.on(function (appId, message) {
        if (appId === Constants.APP_NAME) {
            // we can receive a stat update before the application has been initialized.
            // this happens for controller-initiated flows.
            if (message.state) {
                handleStateChange(message.state);
            } else if (message.bufferStatus && context.isInitialized) {
                handleBufferStatusChange(message.bufferStatus);
            } else if (message.operation && context.isInitialized) {
                const op = message.operation;
                setTimeout(function () {
                    switch (op.name) {
                        case Constants.Operation.PLAY:
                            context.player.play(op.loop);
                            break;
                        case Constants.Operation.PAUSE:
                            context.player.pause();
                            break;
                        case Constants.Operation.STOP:
                            context.player.stop();
                            break;
                        case Constants.Operation.SEEK:
                            context.player.seekTo(op.time);
                            break;
                        default:
                            console.warn('Ignoring unknown operation: ' + op.name);
                    }
                // run operation precisely at the same time
                }, op.executionTime - new Date().getTime());
            }
        }
    });
};

loadURL = function () {
    // the current state would have been set when this method is called, but there
    // is no incoming state, as when we receive a message. Therefore, passing null.
    handleStateChange(null);
};

handleStateChange = function (state) {
    let current = {};
    if (!state) {
        // if incoming state is null, we don't need to care about current state.
        state = window.ove.state.current;
    } else {
        current = window.ove.state.current;
        window.ove.state.current = state;
    }

    if (current.url !== state.url) {
        let context = window.ove.context;
        // the way we load the player doesn't change even if the application was
        // not initialized - the only difference is the need to wait for the
        // initialization to complete.
        const loadPlayer = function () {
            $(Constants.CONTENT_DIV).hide();
            requestRegistration();
            context.player.load(state);
            refresh();
        };
        if (!context.isInitialized) {
            // the player is decided based on the URL.
            if (state.url.includes('youtube')) {
                context.player = new window.OVEYouTubePlayer();
            } else {
                context.player = new window.OVEHTML5VideoPlayer();
            }
            context.player.initialize().then(function () {
                window.ove.context.isInitialized = true;
                loadPlayer();
            });
        } else {
            loadPlayer();
        }
    }
};

handleBufferStatusChange = function (status) {
    // the handling of the buffer status updates operates in a model as noted below:
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
        // this code is executed when this instance of the application receives a
        // registration request. The controller and the viewer handles this differently.
        doRegistration();
    } else if (status.type.registration && !context.bufferStatus.clients.includes(status.clientId)) {
        // this code is executed when a response to a registration request has been received.
        context.bufferStatus.clients.push(status.clientId);
    } else if (status.type.update && context.bufferStatus.clients.includes(status.clientId)) {
        // this code is executed when a registered peer sends a buffer status update.
        if (status.percentage >= Constants.MIN_BUFFERED_PERCENTAGE) {
            context.bufferStatus.clients.splice(context.bufferStatus.clients.indexOf(status.clientId), 1);
            if (context.bufferStatus.clients.length === 0) {
                context.player.ready();
                $(Constants.CONTENT_DIV).show();
                refresh();
            }
        }
    }
};
