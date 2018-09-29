//-- IMPORTANT: all code comments must be in this format. --//

OVE.Utils = new OVEUtils();
function OVEUtils () {
    var __self = this;
    //-----------------------------------------------------------//
    //--                   Utilities for JSON                  --//
    //-----------------------------------------------------------//
    this.JSON = {};
    this.JSON.equals = function (param1, param2) {
        return JSON.stringify(param1) === JSON.stringify(param2);
    };

    //-----------------------------------------------------------//
    //--                   Logging Functions                   --//
    //-----------------------------------------------------------//
    this.Logger = function (name) {
        return new OVELogger(name);
    };

    function OVELogger (name) {
        //-- Constants named as var because of ES5 compliance   --//
        var LogPrefix = {
            TRACE: 'TRACE',
            INFO: ' INFO', //-- Additional space for alignment  --//
            DEBUG: 'DEBUG',
            WARN: ' WARN', //-- Additional space for alignment  --//
            ERROR: 'ERROR',
            FATAL: 'FATAL'
        };
        var UNKNOWN_APP_ID = '__UNKNOWN__';
        var APP_ID_WIDTH = 16;

        //-- The logger name is stored for later use.           --//
        var __private = { name: name };

        //-- Internal Utility function to get logger arguments. --//
        var getArgsToLog = function (logLevel, args) {
            var time = (function (d) {
                var locale = window.navigator.userLanguage || window.navigator.language;
                return d.toLocaleString(locale, { hour12: true }).replace(/([ ]?[aApP][mM])/,
                    '.' + (d.getMilliseconds() + '').padStart(3, '0') + ' $&');
            }(new Date()));
            //-- Each logger can have its own name. If this is  --//
            //-- not provided, ove.context.appId is used. All   --//
            //-- logs in OVE core always use ove.context.appId. --//
            var loggerName = __private.name || (window.ove ? window.ove.context.appId : UNKNOWN_APP_ID);
            return ['[' + logLevel + ']', time, '-',
                loggerName.padEnd(APP_ID_WIDTH), ':'].concat(Object.values(args));
        };

        //-- All log functions accept any number of arguments --//
        this.trace = function () {
            if (__DEBUG__) {
                console.log.apply(console, getArgsToLog(LogPrefix.TRACE, arguments));
            }
        };

        this.debug = function () {
            if (__DEBUG__) {
                console.log.apply(console, getArgsToLog(LogPrefix.DEBUG, arguments));
            }
        };

        this.info = function () {
            console.log.apply(console, getArgsToLog(LogPrefix.INFO, arguments));
        };

        this.warn = function () {
            console.warn.apply(console, getArgsToLog(LogPrefix.WARN, arguments));
        };

        this.error = function () {
            console.error.apply(console, getArgsToLog(LogPrefix.ERROR, arguments));
        };

        this.fatal = function () {
            console.error.apply(console, getArgsToLog(LogPrefix.FATAL, arguments));
        };
    }

    //-----------------------------------------------------------//
    //--                     State Updates                     --//
    //-----------------------------------------------------------//
    this.broadcastState = function (message) {
        if (arguments.length > 0) {
            window.ove.socket.send(message);
        } else {
            window.ove.socket.send(window.ove.state.current);
        }
        window.ove.state.cache();
    };

    this.setOnStateUpdate = function (callback) {
        window.ove.socket.on(function (message) {
            window.ove.state.current = message;
            callback();
        });
    };

    //-----------------------------------------------------------//
    //--                     Initialization                    --//
    //-----------------------------------------------------------//

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
        var shouldSetupCanvas = arguments.length > 2;
        $(document).on(OVE.Event.LOADED, function () {
            if (!window.ove.context.isInitialized) {
                //-- Ignore promise rejection, as it is expected if no state exists.     --//
                window.ove.state.load().then(loadContentMethod).catch(function (_err) { });
            }
            if (shouldSetupCanvas) {
                setupCanvasMethod();
            }
        });
    };

    //-----------------------------------------------------------//
    //--                    Other Utilities                    --//
    //-----------------------------------------------------------//
    this.getQueryParam = function (name, defaultValue) {
        if (arguments.length > 1) {
            return new URLSearchParams(location.search.slice(1)).get(name) || defaultValue;
        }
        return new URLSearchParams(location.search.slice(1)).get(name);
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

    //-- Log method needs to be something like logger.debug or logger.info.              --//
    this.logThenResolve = function (logMethod, resolve, message) {
        logMethod(message);
        resolve(message);
    };
}
