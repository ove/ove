function initPage () {
    window.ove.context.isInitialized = false;
    drawView();

    window.ove.socket.on(function (appId, message) {
        if (appId === 'alignment' && message.hasOwnProperty('monitors')) {
            const svgEmpty = !document.getElementById('grid-group').innerHTML;
            const patternChanged = (message.patternType && message.patternType !== window.ove.state.current.patternType);

            if (svgEmpty || patternChanged) {
                const maxX = d3.max(message.monitors.map(d => d.x));
                const maxY = d3.max(message.monitors.map(d => d.y));

                let drawingFunctions = {'Grid': createGrid, 'Diagonal': createDiagonal, 'Triangles': createTriangles};
                drawingFunctions[message.patternType](maxX, maxY);
            }


            window.ove.state.current = message;

            shiftGrid(message);
        }
    });
}

beginInitialization = function () {
    initView();
    $(document).on(OVE.Event.LOADED, function () {
        if (!window.ove.context.isInitialized) {
            window.ove.state.load().then(drawView);
        }
    });
};

function drawView () {
    let context = window.ove.context;
    if (!context.isInitialized) {
        // no initialization to do

        createGrid();

        context.isInitialized = true;
    }
}

function shiftGrid (message) {
    const data = message.monitors[getClientId()];
    const xShift = (data.x + data.horizontalShift);
    const yShift = (data.y + data.verticalShift);

    d3.select('#grid-group').style('transform', 'translate(' + (-xShift) + 'px, ' + (-yShift) + 'px)');
}

function resizeSVG () {
    d3.select('#monitorsView').style('display', 'none');
    d3.select('#gridView').style('width', '100%').style('height', '100%').style('display', 'block');

    d3.select('#grid')
        .attr('width', window.innerWidth)
        .attr('height', window.innerHeight);

    d3.select('#grid-group').node().innerHTML = '';
}

function createGrid (maxX, maxY) {
    resizeSVG();

    const gridSpacing = 100;

    let rows = [];
    for (let i = 0; i < 2 * (maxY / gridSpacing); i++) {
        rows.push(i * gridSpacing);
    }

    let cols = [];
    for (let j = 0; j < 2 * (maxX / gridSpacing); j++) {
        cols.push(j * gridSpacing);
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
    resizeSVG();

    const gridSpacing = 100;
    const size = Math.max(maxX, maxY);

    let lines = [];
    for (let i = -2 * (size / gridSpacing); i < 2 * (size / gridSpacing); i++) {
        lines.push(i * gridSpacing);
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
        .style('stroke-width', function(d,i){ return (i % 3) === 0 ? '4px' : '1px';})
        .style('stroke', function (d, i) {
            return color(i % 10);
        });
}

function createTriangles () {
    resizeSVG();

    const l = 100;

    // get clients.JSON
    d3.json(buildClientsURL())
        .then(function (clients) {

            const id = getSpaceId();

            let rightMiddlePoints  = clients[id].map(function(d){ return {cx: d.x + d.w,   cy: d.y + d.h/2, l: d.h/2 } });
            let bottomMiddlePoints = clients[id].map(function(d){ return {cx: d.x + d.w/2, cy: d.y + d.h, l: d.h/2  } });
            let allPoints = rightMiddlePoints.concat(bottomMiddlePoints);

            d3.select('#grid-group')
              .selectAll('.triangles')
              .data(allPoints)
              .enter()
              .append('polygon')
              .attr('points', function(d){
                  return (d.cx - d.l/2) + "," + (d.cy + d.l/2) + " " + (d.cx- d.l/2) + "," + (d.cy - d.l/2) + " " + (d.cx + d.l/2) + "," + (d.cy + d.l/2);
              })
              .classed('triangles', true);
        });

}
