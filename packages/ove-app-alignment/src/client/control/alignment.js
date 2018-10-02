initPage = function (data) {
    let context = window.ove.context;
    context.isInitialized = false;
    log.debug('Application is initialized:', context.isInitialized);

    OVE.Utils.resizeController(Constants.CONTENT_DIV);

    log.debug('Restoring state:', data);
    window.ove.state.current = data;
    drawView();
    log.debug('Broadcasting state');
    OVE.Utils.broadcastState();
};

function drawView () {
    let context = window.ove.context;
    drawMonitors();
    context.isInitialized = true;
    log.debug('Application is initialized:', context.isInitialized);
}

function clearSelection () {
    log.debug('Selection cleared:');
    d3.selectAll('.monitor').classed('selected', false); // clear highlighted rectangles
    d3.select('.selection').attr('width', 0); // clear rectangular brush
}

function drawMonitors () {
    log.debug('Drawing Monitors');

    // This function draws a rectangle representing each monitor, and defines the associated interactivity
    d3.json(buildClientsURL())
        .then(function (clients) {
            log.debug('Loaded Clients.json');

            // Ensure the monitorGrid SVG is empty
            let svg = d3.select('#monitorGrid');
            svg.node().innerHTML = '';

            // Use the contents of Clients.json to construct a list recording the id and position of each monitor,
            // and the horizontal and vertical shifts applied to it.
            const id = OVE.Utils.getQueryParam('oveClientId');
            let layout = clients[id];
            layout = layout.map(function (d, i) {
                d.clientId = i;
                d.horizontalShift = 0;
                d.verticalShift = 0;
                return d;
            });

            // Pick a scale which will scale the bounding-box of the monitors to fit inside the browser window
            const margin = 50;
            const width = window.innerWidth - 2 * margin;
            const height = window.innerHeight - 2 * margin;

            const xMax = d3.max(layout.map(function (m) {
                return m.x + m.w;
            }));
            const yMax = d3.max(layout.map(function (m) {
                return m.y + m.h;
            }));

            let scale;
            if ((width - margin) / xMax > (height - margin) / yMax) {
                scale = d3.scaleLinear().range([margin, height - margin]).domain([0, yMax]);
                svg.attr('width', scale(xMax) + margin)
                    .attr('height', height + margin);
            } else {
                scale = d3.scaleLinear().range([margin, width - margin]).domain([0, xMax]);
                svg.attr('width', width + margin)
                    .attr('height', scale(yMax) + margin);
            }

            // create a D3 brush, to enable the selection of monitors
            d3.brush().on('brush end', brushed);
            svg.append('g').attr('class', 'brush').call(d3.brush().on('brush', brushed));

            // Draw a rectangle for each monitor; apply class indexMonitor to monitor with clientId of 0
            let rects = svg.selectAll('.monitor')
                .data(layout)
                .enter()
                .append('rect')
                .attr('x', function (d) {
                    return scale(d.x);
                })
                .attr('y', function (d) {
                    return scale(d.y);
                })
                .attr('width', function (d) {
                    return scale(d.x + d.w) - scale(d.x);
                })
                .attr('height', function (d) {
                    return scale(d.y + d.h) - scale(d.y);
                })
                .classed('monitor', true)
                .classed('indexMonitor', function (d) { return d.clientId === 0; });

            // Register a callback that will fire when user clicks on a rectangle
            rects.on('click', function () {
                d3.select('.selection').attr('width', 0); // clear rectangular brush

                // Toggle whether rectangle has class 'selected' (and hence is highlighted)
                const monitor = d3.select(this);
                if (!document.getElementById('locked-monitor').checked || monitor.datum().clientId !== 0) {
                    monitor.classed('selected', !monitor.classed('selected'));
                }
            });

            // Broadcast an initial message, so that the viewers draw their alignment patterns
            broadcastMessage();

            // When an arrow key is pressed, adjust shifts for monitors accordingly,
            // and broadcast a message listing new offsets.
            // When escape key is pressed, clear selection of monitors.
            document.addEventListener('keydown', function (event) {
                // Note that keys move the pattern, not the screen

                const selectedMonitors = d3.selectAll('.selected');

                const key = { 27: 'escape', 37: 'left', 38: 'up', 39: 'right', 40: 'down' };

                if (key[event.keyCode] === 'escape') {
                    clearSelection();
                }

                if (key[event.keyCode] === 'left') {
                    selectedMonitors.each(function (d) {
                        d.horizontalShift++;
                        return d;
                    });
                }

                if (key[event.keyCode] === 'right') {
                    selectedMonitors.each(function (d) {
                        d.horizontalShift--;
                        return d;
                    });
                }

                if (key[event.keyCode] === 'up') {
                    selectedMonitors.each(function (d) {
                        d.verticalShift++;
                        return d;
                    });
                }

                if (key[event.keyCode] === 'down') {
                    selectedMonitors.each(function (d) {
                        d.verticalShift--;
                        return d;
                    });
                }

                broadcastMessage();
            });

            // When the user clicks and drags to brush a rectangular region,
            // select any rectangles that are completely enclosed
            // (except the index monitor, if the checkbox locking its position is checked)
            function brushed () {
                const s = d3.event.selection;

                rects.classed('selected', function (d) {
                    return scale(d.x) >= s[0][0] &&
                        scale(d.x + d.w) <= s[1][0] &&
                        scale(d.y) >= s[0][1] &&
                        scale(d.y + d.h) <= s[1][1] &&
                        (!document.getElementById('locked-monitor').checked || d.clientId !== 0);
                });
            }
        });
}

// This function makes any adjustments required when locked-monitor is checked/unchecked
setIndexMonitorHighlighting = function () {
    let monitorsLocked = document.getElementById('locked-monitor').checked;

    // unselect index monitor if the checkbox to lock it is checked
    if (monitorsLocked) {
        d3.selectAll('.indexMonitor')
            .classed('selected', false);
    }

    // The rectangle representing the index monitor should have the .indexMonitor class applied
    // (and hence be styled differently), if and only if the checkbox to lock it is checked
    d3.selectAll('.monitor')
        .classed('indexMonitor', function (d) {
            return monitorsLocked && d.clientId === 0;
        });
};

function broadcastMessage () {
    const patternType = document.getElementById('pattern-type').value;
    const monitorData = d3.selectAll('.monitor').data();
    window.ove.socket.send({ monitors: monitorData, patternType: patternType });
}

displayJSON = function () {
    // Construct array listing the position of each screen after applying shift
    let id = OVE.Utils.getQueryParam('oveClientId');
    let newLayout = {};
    newLayout[id] = d3.selectAll('.monitor')
        .data()
        .map(function (d) {
            return { w: d.w, h: d.h, x: d.x + d.horizontalShift, y: d.y + d.verticalShift };
        });

    // Shift screens so no screens have negative x or y coordinates
    const xOffset = d3.min(newLayout[id].map(function (d) { return d.x; }));
    newLayout[id].map(function (d) { d.x -= xOffset; });

    const yOffset = d3.min(newLayout[id].map(function (d) { return d.y; }));
    newLayout[id].map(function (d) { d.y -= yOffset; });

    // Display new space dimensions (this will have increased in scrreens have been shifted outwards)
    const spaceWidth = d3.max(newLayout[id].map(function (d) { return d.x + d.w; }));
    const spaceHeight = d3.max(newLayout[id].map(function (d) { return d.y + d.h; }));
    d3.select('#space-size').text('Dimensions of space are w: ' + spaceWidth + ', h: ' + spaceHeight);

    // Display JSON serialization of layout (with initial '{' and final '}' removed)
    const layoutJSON = JSON.stringify(newLayout);

    d3.select('#clients-json')
        .text(layoutJSON.substr(1, layoutJSON.length - 2));
};
