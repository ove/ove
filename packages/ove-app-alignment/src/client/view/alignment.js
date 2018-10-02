initPage = function () {
    window.ove.context.isInitialized = false;
    log.debug('Application is initialized:', window.ove.context.isInitialized);

    window.ove.socket.on(function (message) {
        if (message.hasOwnProperty('monitors')) {
            log.debug('Received message:', message);

            const svgEmpty = !document.getElementById('grid-group').innerHTML;
            const patternChanged = (message.patternType && message.patternType !== window.ove.state.current.patternType);

            if (svgEmpty || patternChanged) {
                const maxX = d3.max(message.monitors.map(d => d.x));
                const maxY = d3.max(message.monitors.map(d => d.y));

                let drawingFunctions = { 'Grid': createGrid, 'Diagonal': createDiagonal, 'Triangles': createTriangles };
                drawingFunctions[message.patternType](maxX, maxY);
            }

            window.ove.state.current = message;

            shiftGrid(message);
        }
    });
};

function shiftGrid (message) {
    // Set the shift of the pattern by the amount specified for this monitor by message
    const data = message.monitors[OVE.Utils.getClient()];
    const xShift = (data.x + data.horizontalShift);
    const yShift = (data.y + data.verticalShift);

    log.debug('Shifting grid by amount:', '(', xShift, ',', yShift, ')');

    d3.select('#grid-group').style('transform', 'translate(' + (-xShift) + 'px, ' + (-yShift) + 'px)');
}

function resizeSVG () {
    // hide the monitorsView element (used by the control page only)
    log.debug('Resizing SVG');

    d3.select('#monitorsView').style('display', 'none');

    d3.select('#gridView').style('width', '100%').style('height', '100%').style('display', 'block');

    // Set the size of the SVG to fill the available space
    d3.select('#grid')
        .attr('width', window.innerWidth)
        .attr('height', window.innerHeight);

    // remove any previously drawn pattern
    d3.select('#grid-group').node().innerHTML = '';
}

function createGrid (maxX, maxY) {
    // Fill the screen with a grid composed of vertical and horizontal lines
    resizeSVG();
    log.debug('Drawing grid');

    let rows = [];
    for (let i = 0; i < 2 * (maxY / Constants.GRID_SPACING); i++) {
        rows.push(i * Constants.GRID_SPACING);
    }

    let cols = [];
    for (let j = 0; j < 2 * (maxX / Constants.GRID_SPACING); j++) {
        cols.push(j * Constants.GRID_SPACING);
    }

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    d3.select('#grid-group')
        .selectAll('.rows')
        .data(rows)
        .enter()
        .append('line')
        .attr('x1', -maxX)
        .attr('x2', maxX)
        .attr('y1', function (d) {
            return d;
        })
        .attr('y2', function (d) {
            return d;
        })
        .style('stroke-width', '1px')
        .style('stroke', function (d, i) {
            return color(i % 10);
        });

    d3.select('#grid-group')
        .selectAll('.cols')
        .data(cols)
        .enter()
        .append('line')
        .attr('x1', function (d) {
            return d;
        })
        .attr('x2', function (d) {
            return d;
        })
        .attr('y1', -2 * maxY)
        .attr('y2', 2 * maxY)
        .style('stroke-width', '1px')
        .style('stroke', function (d, i) {
            return color(i % 10);
        });
}

function createDiagonal (maxX, maxY) {
    // Fill the screen with parallel diagonal lines
    resizeSVG();

    log.debug('Drawing diagonal lines');

    const size = Math.max(maxX, maxY);

    let lines = [];
    for (let i = -2 * (size / Constants.GRID_SPACING); i < 2 * (size / Constants.GRID_SPACING); i++) {
        lines.push(i * Constants.GRID_SPACING);
    }

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    d3.select('#grid-group')
        .selectAll('.lines')
        .data(lines)
        .enter()
        .append('line')
        .attr('x1', -size)
        .attr('x2', +size)
        .attr('y1', function (d) {
            return d + size;
        })
        .attr('y2', function (d) {
            return d - size;
        })
        .style('stroke-width', function (_d, i) { return (i % 3) === 0 ? '4px' : '1px'; })
        .style('stroke', function (_d, i) {
            return color(i % 10);
        });
}

function createTriangles () {
    resizeSVG();

    log.debug('Drawing triangles');

    // We need to load Clients.JSON, as we want to position right-angled triangles so that they cross each screen's edge
    d3.json(buildClientsURL()).then(function (clients) {
        const id = OVE.Utils.getSpace();

        // Construct list of points at the midpoint of the right edge of each screen
        // l is a parameter that sets the size of triangle that will be drawn on each edge
        let rightMiddlePoints = clients[id].map(function (d) {
            return { cx: d.x + d.w, cy: d.y + d.h / 2, l: d.h / 2 };
        });

        // Construct list of points at the midpoint of the bottom edge of each screen
        let bottomMiddlePoints = clients[id].map(function (d) {
            return { cx: d.x + d.w / 2, cy: d.y + d.h, l: d.h / 2 };
        });
        let allPoints = rightMiddlePoints.concat(bottomMiddlePoints);

        d3.select('#grid-group')
            .selectAll('.triangles')
            .data(allPoints)
            .enter()
            .append('polygon')
            .attr('points', function (d) {
                const vertex1 = (d.cx - d.l / 2) + ',' + (d.cy + d.l / 2);
                const vertex2 = (d.cx - d.l / 2) + ',' + (d.cy - d.l / 2);
                const vertex3 = (d.cx + d.l / 2) + ',' + (d.cy + d.l / 2);
                return vertex1 + ' ' + vertex2 + ' ' + vertex3;
            })
            .classed('triangles', true);
    });
}
