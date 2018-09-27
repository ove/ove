//-- IMPORTANT: all code comments must be in this format. --//

OVE.Utils = new OVEUtils();
function OVEUtils () {
    var __self = this;
    //-----------------------------------------------------------//
    //--                  Utilities for JSON                   --//
    //-----------------------------------------------------------//
    this.JSON = {};
    this.JSON.equals = function (param1, param2) {
        return JSON.stringify(param1) === JSON.stringify(param2);
    };

    //-----------------------------------------------------------//
    //--                   Other Utilities                     --//
    //-----------------------------------------------------------//
    this.getQueryParam = function (name, defaultValue) {
        if (arguments.length > 1) {
            return new URLSearchParams(location.search.slice(1)).get(name) || defaultValue;
        }
        return new URLSearchParams(location.search.slice(1)).get(name);
    };

    //-- The difference between the two methods below is that the on-demand option does  --//
    //-- not wait for OVE to load.                                                       --//
    this.initControlOnDemand = function (defaultState, initMethod) {
        var state = window.ove.state.name || defaultState;
        //-- The default state URL is used here. --//
        $.ajax({ url: 'state/' + state, dataType: 'json' }).done(initMethod);
    };

    this.initControl = function (defaultState, initMethod) {
        $(document).on(OVE.Event.LOADED, function () {
            __self.initControlOnDemand(defaultState, initMethod);
        });
    };

    //-- The viewer is initialized in three steps:                                       --//
    //--     1. Initial setup before OVE is actually loaded.                             --//
    //--     2. Async loading of state and loading of content after OVE has been loaded. --//
    //--     3. Setup of canvas in parallel to the loading of state, which should happen --//
    //--        much faster, but we don't want to wait till that finishes to load state. --//
    this.initView = function (initMethod, loadContentMethod, setupCanvasMethod) {
        initMethod();
        $(document).on(OVE.Event.LOADED, function () {
            if (!window.ove.context.isInitialized) {
                window.ove.state.load().then(loadContentMethod);
            }
            if (arguments.length > 2) {
                setupCanvasMethod();
            }
        });
    };

    this.resizeController = function (contentDivName) {
        var l = window.ove.layout;
        //-- The maximum height is limited to the minimum of the two to avoid controller --//
        //-- becoming too large on a given screen.                                       --//
        var maxWidth = Math.min(document.documentElement.clientWidth, window.innerWidth);
        var maxHeight = Math.min(document.documentElement.clientHeight, window.innerHeight);
        var width, height;
        //-- The aspect ratio of the controller changes to suit the aspect ratio of the  --//
        //-- section/content.                                                            --//
        if (l.section.w * maxHeight >= maxWidth * l.section.h) {
            width = maxWidth;
            height = maxWidth * l.section.h / l.section.w;
        } else {
            height = maxHeight;
            width = maxHeight * l.section.w / l.section.h;
        }
        $(contentDivName).css({ width: width, height: height });
    };

    this.broadcastState = function (appId, message) {
        window.ove.socket.send(appId, message);
        window.ove.state.cache();
    };
}
