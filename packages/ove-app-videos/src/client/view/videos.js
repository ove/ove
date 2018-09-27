initView = function () {
    window.ove.context.isInitialized = false;
    initCommon();
    const broadcastBufferStatus = function () {
        try {
            const context = window.ove.context;
            // We are doing nothing if the player is not initialized or if
            // no video is loaded as yet.
            if (context.player && context.player.isVideoLoaded()) {
                // The status update includes a UUID that is unique to this peer
                // along with a loaded percentage. Updates are broadcasted as per
                // BUFFER_STATUS_BROADCAST_FREQUENCY.
                const status = {
                    type: { update: true },
                    clientId: context.uuid,
                    percentage: context.player.getLoadedPercentage()
                };
                // If the buffer status does not change compared to the last update
                // there is no point in broadcasting it - simply ignore and proceed.
                if (!OVE.Utils.JSON.equals(status, context.bufferStatus.self)) {
                    // The status change is handled locally as well.
                    handleBufferStatusChange(status);
                    window.ove.socket.send(Constants.APP_NAME, { bufferStatus: status });
                    context.bufferStatus.self = status;
                }
            }
        } catch (e) { } // Random player errors
    };
    setInterval(broadcastBufferStatus, Constants.BUFFER_STATUS_BROADCAST_FREQUENCY);
};

refresh = function () {
    // A refresh operation takes place when a player is loaded or when a video is
    // ready to be played. This ensures that proper CSS settings are applied.
    $(Constants.CONTENT_DIV).css('transform', 'scale(' + (window.ove.context.scale + 0.001) + ')');
    setTimeout(function () {
        $(Constants.CONTENT_DIV).css('transform', 'scale(' + window.ove.context.scale + ')');
    }, Constants.RESCALE_DURING_REFRESH_TIMEOUT);
};

requestRegistration = function () {
    // This is when a viewer triggers a registration request.
    const status = { type: { requestRegistration: true } };
    handleBufferStatusChange(status);
    window.ove.socket.send(Constants.APP_NAME, { bufferStatus: status });
};

doRegistration = function () {
    // Only viewers respond to registration requests. Controllers don't respond to this.
    const context = window.ove.context;
    if (!context.bufferStatus.clients.includes(context.uuid)) {
        context.bufferStatus.clients.push(context.uuid);
    }
    window.ove.socket.send(Constants.APP_NAME, { bufferStatus: { type: { registration: true }, clientId: context.uuid } });

    // The buffer status of this viewer will be reset such that the broadcastBufferStatus
    // function can then kick in.
    context.bufferStatus.self = {};
};

beginInitialization = function () {
    OVE.Utils.initView(initView, loadURL, function () {
        let context = window.ove.context;
        const l = window.ove.layout;
        // Appropriately scaling and positioning the player is necessary.
        context.scale = Math.min(l.section.w / l.w, l.section.h / l.h);
        $(Constants.CONTENT_DIV).css({
            zoom: 1,
            transformOrigin: 100 * l.x / (l.section.w - l.section.w / context.scale) + '% ' +
                             100 * l.y / (l.section.h - l.section.h / context.scale) + '%',
            transform: 'scale(' + context.scale + ')',
            width: (l.section.w / context.scale) + 'px',
            height: (l.section.h / context.scale) + 'px'
        });
    });
};
