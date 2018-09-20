const { app } = require('@ove/ove-app-base')(__dirname, 'videos');
const server = require('http').createServer(app);

var ws;
setTimeout(function () {
    ws = new (require('ws'))('ws://' + process.env.OVE_HOST);
    ws.on('message', function (msg) {
        let m = JSON.parse(msg);
        if (m.appId == 'videos' && m.message.bufferStatus) {
            let status = m.message.bufferStatus;
            if (status.type.registration) {
                if (!bufferStatus[m.sectionId] || JSON.stringify(bufferStatus[m.sectionId]) === JSON.stringify({})) {
                    bufferStatus[m.sectionId] = { clients: [] };
                    bufferStatus[m.sectionId].clients.push(status.clientId);
                } else if (!bufferStatus[m.sectionId].clients.includes(status.clientId)) {
                    bufferStatus[m.sectionId].clients.push(status.clientId);
                }
            } else if (status.type.update && bufferStatus[m.sectionId] &&
                JSON.stringify(bufferStatus[m.sectionId]) !== JSON.stringify({}) &&
                bufferStatus[m.sectionId].clients.includes(status.clientId)) {
                if (status.percentage >= 15) {
                    bufferStatus[m.sectionId].clients.splice(bufferStatus[m.sectionId].clients.indexOf(status.clientId), 1);
                    if (bufferStatus[m.sectionId].clients.length == 0) {
                        delete bufferStatus[m.sectionId];
                        bufferStatus[m.sectionId] = {};
                    }
                }
            }
        }
    });
}, 3000);

var bufferStatus = [];
app.get('/operation/:name(play|pause|stop|seekTo|bufferStatus)', function (req, res, next) {
    let name = req.params.name;
    let sectionId = req.query.oveSectionId;
    if (name == 'bufferStatus') {
        let isComplete = true;
        if (sectionId) {
            isComplete = !bufferStatus[sectionId] || JSON.stringify(bufferStatus[sectionId]) === JSON.stringify({});
        } else {
            bufferStatus.some(function (e) {
                if (e && JSON.stringify(e) !== JSON.stringify({})) {
                    isComplete = false;
                    return true;
                }
            });
        }
        res.status(200).set('Content-Type', 'application/json').send(
            JSON.stringify({ status: (isComplete ? 'complete' : 'buffering') }));
    } else {
        let message = { operation: { name: name, executionTime: (new Date().getTime() + 350) } };
        if (name == 'seekTo') {
            message.operation.time = req.query.time;
        }
        if (sectionId) {
            ws.send(JSON.stringify({ appId: 'videos', sectionId: sectionId, message: message }));
        } else {
            ws.send(JSON.stringify({ appId: 'videos', message: message }));
        }
        res.status(200).set('Content-Type', 'application/json').send(JSON.stringify({}));
    }
});

server.listen(process.env.PORT || 8080);
