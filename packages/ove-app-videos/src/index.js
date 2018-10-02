const { Constants } = require('./client/constants/videos');
const HttpStatus = require('http-status-codes');
const { app, log, Utils } = require('@ove/ove-lib-appbase')(__dirname, Constants.APP_NAME);
const server = require('http').createServer(app);

var ws;
var bufferStatus = [];
setTimeout(function () {
    log.debug('Establishing WebSocket connection with:', 'ws://' + process.env.OVE_HOST);
    ws = new (require('ws'))('ws://' + process.env.OVE_HOST);
    ws.on('message', function (msg) {
        let m = JSON.parse(msg);
        if (m.appId === Constants.APP_NAME && m.message.bufferStatus) {
            // The handling of the buffer status updates operates in a model as noted below. This
            // same as the model followed by browser-based viewers and controllers.
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
            let status = m.message.bufferStatus;
            let bufferIsEmpty = Utils.isNullOrEmpty(bufferStatus[m.sectionId]);
            if (status.type.registration) {
                if (bufferIsEmpty) {
                    bufferStatus[m.sectionId] = { clients: [] };
                    bufferStatus[m.sectionId].clients.push(status.clientId);
                } else if (!bufferStatus[m.sectionId].clients.includes(status.clientId)) {
                    bufferStatus[m.sectionId].clients.push(status.clientId);
                }
            } else if (status.type.update && !bufferIsEmpty &&
                bufferStatus[m.sectionId].clients.includes(status.clientId)) {
                if (status.percentage >= Constants.MIN_BUFFERED_PERCENTAGE ||
                    status.duration >= Constants.MIN_BUFFERED_DURATION) {
                    bufferStatus[m.sectionId].clients.splice(bufferStatus[m.sectionId].clients.indexOf(status.clientId), 1);
                    if (bufferStatus[m.sectionId].clients.length === 0) {
                        delete bufferStatus[m.sectionId];
                        bufferStatus[m.sectionId] = {};
                    }
                }
            }
        }
    });
}, Constants.SOCKET_READY_WAIT_TIME);

let operationsList = Constants.Operation.PLAY + '|' + Constants.Operation.PAUSE + '|' +
    Constants.Operation.STOP + '|' + Constants.Operation.SEEK + '|' + Constants.Operation.BUFFER_STATUS;
app.get('/operation/:name(' + operationsList + ')', function (req, res) {
    let name = req.params.name;
    let sectionId = req.query.oveSectionId;
    if (sectionId) {
        log.info('Performing operation:', name, ', on section:', sectionId);
    } else {
        log.info('Performing operation:', name);
    }
    // If this is a buffer status check and depending on whether a sectionId is provided, below
    // code checks whether buffering is in progress.
    if (name === Constants.Operation.BUFFER_STATUS) {
        let isComplete = true;
        if (sectionId) {
            isComplete = Utils.isNullOrEmpty(bufferStatus[sectionId]);
        } else {
            bufferStatus.some(function (s) {
                if (s && JSON.stringify(s) !== Utils.JSON.EMPTY) {
                    isComplete = false;
                    return true;
                }
            });
        }
        res.status(HttpStatus.OK).set(Constants.HTTP_HEADER_CONTENT_TYPE, Constants.HTTP_CONTENT_TYPE_JSON).send(
            JSON.stringify({ status: (isComplete ? Constants.BufferStatus.COMPLETE : Constants.BufferStatus.BUFFERING) }));
    } else {
        // Play and SeekTo commands receive additional query parameters.
        let message = { operation: { name: name, executionTime: (new Date().getTime() + Constants.OPERATION_SYNC_DELAY) } };
        if (name === Constants.Operation.SEEK) {
            // We assume that the seek time is properly set instead of enforcing any strict type checks.
            message.operation.time = req.query.time;
        } else if (name === Constants.Operation.PLAY) {
            // Checks whether the loop parameter is defined and it equals to true.
            // The typeof check is better than an equals check since undefined can
            // be overridden.
            message.operation.loop = (typeof req.query.loop !== 'undefined' &&
                JSON.parse(String(req.query.loop).toLowerCase()));
        }
        // If the section id is not set the message will be available to all the sections.
        if (sectionId) {
            ws.send(JSON.stringify({ appId: Constants.APP_NAME, sectionId: sectionId, message: message }));
        } else {
            ws.send(JSON.stringify({ appId: Constants.APP_NAME, message: message }));
        }
        res.status(HttpStatus.OK).set(Constants.HTTP_HEADER_CONTENT_TYPE,
            Constants.HTTP_CONTENT_TYPE_JSON).send(Utils.JSON.EMPTY);
    }
});

const port = process.env.PORT || 8080;
server.listen(port);
log.info(Constants.APP_NAME, 'application started, port:', port);
