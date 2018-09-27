//-- IMPORTANT: all code comments must be in this format. --//

OVE.Utils = new OVEUtils();
function OVEUtils () {
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
        if (typeof defaultValue !== 'undefined') {
            return new URLSearchParams(location.search.slice(1)).get(name) || defaultValue;
        }
        return new URLSearchParams(location.search.slice(1)).get(name);
    };

    this.initControl = function (defaultState, initMethod) {
        $(document).on(OVE.Event.LOADED, function () {
            var state = window.ove.state.name || defaultState;
            // The default state URL is used here.
            $.ajax({ url: 'state/' + state, dataType: 'json' }).done(initMethod);
        });
    };

    this.resizeController = function (contentDivName) {
        var l = window.ove.layout;
        // The maximum height is limited to the minimum of the two to avoid controller
        // becoming too large on a given screen.
        var maxWidth = Math.min(document.documentElement.clientWidth, window.innerWidth);
        var maxHeight = Math.min(document.documentElement.clientHeight, window.innerHeight);
        var width, height;
        // The aspect ratio of the controller changes to suit the aspect ratio of
        // the section/content.
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
