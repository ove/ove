initView = function () {
    window.ove.context.isInitialized = false;
    log.debug('Application is initialized:', window.ove.context.isInitialized);
    initCommon();
    const broadcastBufferStatus = function () {
        try {
            const context = window.ove.context;
            // We are doing nothing if the player is not initialized or if
            // no video is loaded as yet.
            if (context.player && context.player.isAudioLoaded()) {
                // The status update includes a UUID that is unique to this peer
                // along with a loaded percentage. Updates are broadcasted as per
                // BUFFER_STATUS_BROADCAST_FREQUENCY.
                const status = {
                    type: { update: true },
                    clientId: context.uuid,
                    percentage: context.player.getLoadedPercentage(),
                    duration: context.player.getLoadedDuration()
                };
                // If the buffer status does not change compared to the last update
                // there is no point in broadcasting it - simply ignore and proceed.
                if (!OVE.Utils.JSON.equals(status, context.bufferStatus.self)) {
                    log.debug('Broadcasting and updating buffer status:', status);

                    // The status change is handled locally as well.
                    handleBufferStatusChange(status);
                    window.ove.socket.send({ bufferStatus: status });
                    context.bufferStatus.self = status;
                }
            }
        } catch (e) { } // Random player errors
    };
    setInterval(broadcastBufferStatus, Constants.BUFFER_STATUS_BROADCAST_FREQUENCY);
};

refresh = function () {
    log.debug('Refreshing viewer');

    // A refresh operation takes place when a player is loaded or when a video is
    // ready to be played. This ensures that proper CSS settings are applied.
    $(Constants.CONTENT_DIV).css('transform', 'scale(' + (window.ove.context.scale + 0.001) + ')');
    setTimeout(function () {
        $(Constants.CONTENT_DIV).css('transform', 'scale(' + window.ove.context.scale + ')');
    }, Constants.RESCALE_DURING_REFRESH_TIMEOUT);
};

requestRegistration = function () {
    log.debug('Requesting registration');

    // This is when a viewer triggers a registration request.
    const status = { type: { requestRegistration: true } };
    handleBufferStatusChange(status);
    window.ove.socket.send({ bufferStatus: status });
};

doRegistration = function () {
    const context = window.ove.context;

    // Only viewers respond to registration requests. Controllers don't respond to this.
    const status = { type: { registration: true }, clientId: context.uuid };
    handleBufferStatusChange(status);
    window.ove.socket.send({ bufferStatus: status });

    // The buffer status of this viewer will be reset such that the broadcastBufferStatus
    // function can then kick in.
    log.debug('Resetting buffer status of viewer');
    context.bufferStatus.self = {};
};

beginInitialization = function () {
    log.debug('Starting viewer initialization');
    OVE.Utils.initView(initView, loadURL, function () {
        let context = window.ove.context;
        const l = window.ove.layout;
        // Appropriately scaling and positioning the player is necessary.
        context.scale = Math.min(l.section.w / l.w, l.section.h / l.h);
        let width = (l.section.w / context.scale) + 'px';
        let height = (l.section.h / context.scale) + 'px';
        log.debug('Scaling viewer:', context.scale, ', height:', height, ', width:', width);
        $(Constants.CONTENT_DIV).css({
            zoom: 1,
            transformOrigin: 100 * l.x / (l.section.w - l.section.w / context.scale) + '% ' +
                             100 * l.y / (l.section.h - l.section.h / context.scale) + '%',
            transform: 'scale(' + context.scale + ')',
            width: width,
            height: height
        });
    });
};
