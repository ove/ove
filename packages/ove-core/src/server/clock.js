module.exports = function (server, log, Constants) {
    /**************************************************************
                         Clock Synchronisation
    **************************************************************/
    /* istanbul ignore next */
    // It is not worth the effort to test the following code block, which will cause an
    // internal representation to be exposed in an unwanted way.
    setTimeout(function () {
        setInterval(function () {
            server.wss.clients.forEach(function (c) {
                if (c.readyState === Constants.WEBSOCKET_READY) {
                    c.safeSend(JSON.stringify({ appId: Constants.APP_NAME, clockReSync: true }));
                }
            });
        }, Constants.CLOCK_RE_SYNC_INTERVAL);
    // Always run this after a timeout to avoid this causing a server crash
    }, Constants.CLOCK_RE_SYNC_INTERVAL);
    return function () {
        let diffs = [];
        let clients = [];
        Object.keys(server.clockSyncResults).forEach(function (c) {
            // We only worry about the current set of results
            while (server.clockSyncResults[c].length > Constants.CLOCK_SYNC_ATTEMPTS) {
                server.clockSyncResults[c].shift();
            }
            if (server.clockSyncResults[c].length === Constants.CLOCK_SYNC_ATTEMPTS) {
                server.clockSyncResults[c].forEach(function (e) {
                    diffs.push(e);
                });
                clients.push(c);
            }
        });

        // The algorithm that we use is based on the Berkeley Algorithm. Since OVE uses a
        // client-server architecture, the master is always the server. Also, unlike in the
        // Berkeley Algorithm the clients originate the clock-test request via a 'sync' message,
        // and perform the calculation of the clock differences on their own. They make five
        // calculations and post the results to the server. We do the clock synchronisation over
        // WebSockets, and since the connections may drop in between, the client keeps track of
        // these observations without the server having to know which socket made each request.
        // Once the server has enough observations it runs the following code to determine the
        // differences and synchronise all clocks including its own. When we computes averages
        // we only consider values between the first and third quartiles. If a client's clock is
        // not in sync, the server broadcasts a 'clockDiff' message.
        // For more information on the Berkeley Algorithm, see https://doi.org/10.1109/32.29484.
        if (clients.length !== 0) {
            let q1 = diffs.length * 0.25 - 1;
            if (q1 === Math.floor(q1)) {
                q1++;
            } else {
                q1 = Math.ceil(q1);
            }
            let q3 = diffs.length * 0.75 - 1;
            if (q3 === Math.floor(q3)) {
                q3--;
            } else {
                q3 = Math.floor(q3);
            }
            diffs.sort(function (a, b) { return a - b; });
            server.clockDiff = diffs.slice(q1, q3 + 1).reduce(
                function (a, b) { return a + b; }, 0) / (q3 - q1) | 0;
            log.trace('Calculated overall difference:', server.clockDiff);

            let clockDiff = {};
            clients.forEach(function (c) {
                // Always broadcast a difference as an integer
                let cDiff = server.clockSyncResults[c].reduce(
                    function (a, b) { return a + b; }, 0) /
                    server.clockSyncResults[c].length - server.clockDiff | 0;
                delete server.clockSyncResults[c];
                if (cDiff !== 0) {
                    clockDiff[c] = cDiff;
                }
            });
            log.trace('Calculated client specific differences:', clockDiff);

            if (Object.keys(clockDiff).length > 0) {
                server.wss.clients.forEach(function (c) {
                    if (c.readyState === Constants.WEBSOCKET_READY) {
                        c.safeSend(JSON.stringify({ appId: Constants.APP_NAME, clockDiff: clockDiff }));
                    }
                });
            }
        }
    };
};
