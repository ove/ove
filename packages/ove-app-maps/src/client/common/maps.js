$(function () {
    $(document).ready(function () {
        window.ove = new OVE();
        window.ove.context.isInitialized = false;
        window.ove.context.layers = [];
        window.ove.context.map = undefined;
        beginInitialization();
    });
});

initCommon = function () {
    let context = window.ove.context;
    let fetchPromise = fetch('layers.json').then(r => r.text()).then(text => {
        $.each(JSON.parse(text), function (i, e) {
            if (e.type == 'ol.layer.Tile') {
                let TileConfig = {
                    visible: e.visible,
                    source: eval('new window.' + e.source.type + '(' + JSON.stringify(e.source.config) + ')') // jshint ignore:line
                };
                if (e.source.type == 'ol.source.BingMaps') {
                    TileConfig.preload = Infinity;
                }
                context.layers[i] = new window.ol.layer.Tile(TileConfig);
                if (e.source.type == 'ol.source.BingMaps') {
                    context.layers[i].bingMapsSource = { config: e.source.config };
                }
            } else if (e.type == 'ol.layer.Vector') {
                let TileConfig = {
                    visible: e.visible,
                    source: new window.ol.source.Vector({
                        url: e.source.config.url,
                        format: new window.ol.format.GeoJSON()
                    }),
                    style: new window.ol.style.Style({
                        fill: new window.ol.style.Fill(e.style.fill),
                        stroke: new window.ol.style.Stroke(e.style.stroke)
                    }),
                    opacity: e.opacity
                };
                context.layers[i] = new window.ol.layer.Vector(TileConfig);
            }
            context.layers[i].wms = e.wms;
        });
    });
    setTimeout(function () {
        // Give some time for the layers to load for the first time, and then keep checking.
        setInterval(function () {
            context.layers.forEach(function (e) {
                if (e.bingMapsSource && e.getSource().getState() != 'ready') {
                    e.setSource(eval('new window.ol.source.BingMaps(' + JSON.stringify(e.bingMapsSource.config) + ')')); // jshint ignore:line
                }
            });
        }, 1000);
    }, 3000);
    return fetchPromise;
};

initMap = function (view) {
    let context = window.ove.context;
    context.map = new window.ol.Map({
        target: 'map',
        controls: [],
        layers: context.layers,
        interactions: window.ol.interaction.defaults({
            pinchRotate: false,
            zoomDuration: 0
        }).extend([
            new window.ol.interaction.MouseWheelZoom({ duration: 0 }),
            new window.ol.interaction.PinchZoom({ duration: 0 }),
            new window.ol.interaction.DragZoom({ duration: 0 })
        ]),
        view: new window.ol.View(view)
    });
};
