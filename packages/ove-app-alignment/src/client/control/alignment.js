function initPage (data) {
    let context = window.ove.context;
    context.isInitialized = false;

    let l = window.ove.layout;
    let maxWidth = Math.min(document.documentElement.clientWidth, window.innerWidth);
    let maxHeight = Math.min(document.documentElement.clientHeight, window.innerHeight);
    let width, height;
    if (l.section.w * maxHeight >= maxWidth * l.section.h) {
        width = maxWidth;
        height = maxWidth * l.section.h / l.section.w;
    } else {
        height = maxHeight;
        width = maxHeight * l.section.w / l.section.h;
    }
    $('#alignmentArea').css({ width: width, height: height });


    window.ove.state.current = data;
    drawView();
    window.ove.socket.send('alignment', window.ove.state.current);
    window.ove.state.cache();
}

function drawView () {
    let context = window.ove.context;
    drawMonitors();
    context.isInitialized = true; // no initialisation to do
}

function clearSelection () {
    d3.selectAll('.monitor').classed('selected', false); // clear highlighted rectangles
    d3.select('.selection').attr('width', 0); // clear rectangular brush
}


function drawMonitors () {
    d3.json(buildClientsURL())
        .then(function (clients) {
            let svg = d3.select('#monitorGrid');
            svg.node().innerHTML = '';

            const id = new URLSearchParams(location.search.slice(1)).get('oveClientId');
            let layout = clients[id];
            layout = layout.map(function (d, i) {
                d.clientId = i;
                d.horizontalShift = 0;
                d.verticalShift = 0;
                return d;
            });

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
            if ( (width - margin)/xMax > (height - margin)/yMax ){
               scale = d3.scaleLinear().range([margin, height - margin]).domain([0, yMax]);
               svg.attr('width', scale(xMax) + margin)
                    .attr('height', height + margin);

            } else {
                scale = d3.scaleLinear().range([margin, width - margin]).domain([0, xMax]);
                svg.attr('width', width + margin)
                    .attr('height', scale(yMax) + margin);
            }
            


            d3.brush()
                .on('brush end', brushed);

            svg.append('g')
                .attr('class', 'brush')
                .call(d3.brush().on('brush', brushed));

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
                .classed('indexMonitor', function(d){ return d.clientId === 0; });

            rects.on('click', function () {
                d3.select('.selection').attr('width', 0); // clear rectangular brush

                // Toggle whether rectangle has class 'selected' (and hence is highlighted)
                const monitor = d3.select(this);
                if (!document.getElementById("locked-monitor").checked || monitor.datum().clientId !== 0) {
                    monitor.classed('selected', !monitor.classed('selected'));
                }
            });

            broadcastMessage();

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

            function brushed () {
                const s = d3.event.selection;

                rects.classed('selected', function (d) {
                    return scale(d.x) >= s[0][0] &&
                        scale(d.x + d.w) <= s[1][0] &&
                        scale(d.y) >= s[0][1] &&
                        scale(d.y + d.h) <= s[1][1] &&
                        ( !document.getElementById("locked-monitor").checked || d.clientId !== 0);
                });
            }
        });
}

function setIndexMonitorHighlighting() {
    d3.selectAll('.monitor')
        .classed('indexMonitor', function (d) {
            return document.getElementById('locked-monitor').checked && d.clientId === 0;
        });

    // unselect index monitor if necessary
    if (monitorsLocked) {
        d3.selectAll('.monitor')
            .filter(function (d) {
                return d.clientId === 0
            })
            .classed("selected", false);
    }

}


function broadcastMessage() {
    const patternType = document.getElementById('pattern-type').value;
    const monitorData = d3.selectAll('.monitor').data();
    window.ove.socket.send('alignment', { monitors: monitorData, patternType: patternType });
}

function exportJSON () {
    d3.select('#clients-json').text(exportOffsets());
}

function exportOffsets () {
    let x = [];
    d3.selectAll('.monitor').each(function (d) {
        x.push(d);
    });

    let id = new URLSearchParams(location.search.slice(1)).get('oveClientId');

    let newLayout = {};
    newLayout[id] = d3.selectAll('.monitor')
        .data()
        .map(function (d) {
            return { w: d.w, h: d.h, x: d.x + d.horizontalShift, y: d.y + d.verticalShift };
        });

    // Shift screens so no screens have negative x or y coordinates
    const xOffset = d3.min(newLayout[id].map(function(d){ return d.x; }));
    newLayout[id].map(function(d){ d.x -= xOffset; });

    const yOffset = d3.min(newLayout[id].map(function(d){ return d.y; }));
    newLayout[id].map(function(d){ d.y -= yOffset; });

    const spaceWidth = d3.max(newLayout[id].map(function(d){ return d.x + d.w }));
    const spaceHeight = d3.max(newLayout[id].map(function(d){ return d.y + d.h }));
    d3.select("#space-size").text("Dimensions of space are w: " + spaceWidth + ", h: " + spaceHeight);

    const layoutJSON = JSON.stringify(newLayout);
    return layoutJSON.substr(1, layoutJSON.length - 2);
}
