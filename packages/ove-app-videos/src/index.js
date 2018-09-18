const { app } = require('@ove/ove-app-base')(__dirname, 'videos');
const server = require('http').createServer(app);

var ws;
setTimeout(function () {
    ws = new (require('ws'))('ws://' + process.env.OVE_HOST);
}, 3000);

app.get('/operation/:name(play|pause|stop|seekTo)', function (req, res, next) {
    let name = req.params.name;
    let sectionId = req.query.oveSectionId;
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
});

server.listen(process.env.PORT || 8080);
