//-- IMPORTANT: all code comments must be in this format. --//

OVE.Utils = new OVEUtils();
function OVEUtils () {
    let __self = this;
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
    //-- Instance of logger for the use of OVE.Utils            --//
    const log = this.Logger('OVEUtils');

    function OVELogger (name) {
        //-- Constants for log labels corresponding to levels.  --//
        const LogPrefix = {
            TRACE: 'TRACE',
            DEBUG: 'DEBUG',
            INFO: 'INFO',
            WARN: 'WARN',
            ERROR: 'ERROR',
            FATAL: 'FATAL'
        };

        const UNKNOWN_APP_ID = '__UNKNOWN__';
        const APP_ID_WIDTH = 16;
        const LOG_PREFIX_WIDTH = 9;

        //-- The logger name is stored for later use.           --//
        let __private = { name: name };

        //-- Internal Utility function to get log labels' CSS   --//
        const getLogLabelCSS = function (logLevel) {
            const getCSSString = function (background, color) {
                return 'font-weight: 500; background: ' + background + '; color: ' + color;
            };
            switch (logLevel) {
                case LogPrefix.TRACE:
                    return getCSSString('#808080', '#FFFAF0');
                case LogPrefix.DEBUG:
                    return getCSSString('#1E90FF', '#F8F8FF');
                case LogPrefix.INFO:
                    return getCSSString('#2E8B57', '#FFFAFA');
                case LogPrefix.WARN:
                    return getCSSString('#DAA520', '#FFFFF0');
                case LogPrefix.ERROR:
                    return getCSSString('#B22222', '#FFFAF0');
                case LogPrefix.FATAL:
                    return getCSSString('#FF0000', '#FFFFFF');
                default:
                    return '';
            }
        };

        //-- Internal Utility function to get logger arguments. --//
        const getArgsToLog = function (logLevel, args) {
            const time = (function (d) {
                const locale = window.navigator.userLanguage || window.navigator.language;
                return d.toLocaleString(locale, { hour12: true }).replace(/([ ]?[aApP][mM])/,
                    '.' + (d.getMilliseconds() + '').padStart(3, '0') + ' $&');
            }(new Date()));
            //-- Each logger can have its own name. If this is  --//
            //-- not provided, it will default to Unknown.      --//
            const loggerName = __private.name || UNKNOWN_APP_ID;
            return [('%c[' + logLevel + ']').padStart(LOG_PREFIX_WIDTH), getLogLabelCSS(logLevel), time, '-',
                loggerName.padEnd(APP_ID_WIDTH), ':'].concat(Object.values(args));
        };

        //-- All log functions accept any number of arguments   --//
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

    //-- Debug logs related to State Updates are produced by OVE core and therefore not  --//
    //-- produced in here.                                                               --//
    this.broadcastState = function (message) {
        if (arguments.length > 0) {
            //-- Sometimes, state is not the only message that is broadcasted and will   --//
            //-- therefore the application may want to broadcast it in a specific format.--//
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
        const state = window.ove.state.name || defaultState;
        log.info('Initializing controller with state:', state);
        //-- The default state URL is used here. --//
        $.ajax({ url: 'state/' + state, dataType: 'json' }).done(initMethod).catch(log.error);
    };

    this.initControl = function (defaultState, initMethod) {
        $(document).on(OVE.Event.LOADED, function () {
            log.debug('Invoking OVE.Event.Loaded handler');
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
        const shouldSetupCanvas = arguments.length > 2;
        $(document).on(OVE.Event.LOADED, function () {
            log.debug('Invoking OVE.Event.Loaded handler');
            if (!window.ove.context.isInitialized) {
                //-- Ignore promise rejection, as it is expected if no state exists.     --//
                window.ove.state.load().then(loadContentMethod).catch(function (_err) { });
            }
            if (shouldSetupCanvas) {
                log.debug('Running post-initialization canvas setup operation');
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
        const l = window.ove.layout;
        //-- The maximum height is limited to the minimum of the two to avoid controller --//
        //-- becoming too large on a given screen.                                       --//
        const maxWidth = Math.min(document.documentElement.clientWidth, window.innerWidth);
        const maxHeight = Math.min(document.documentElement.clientHeight, window.innerHeight);
        let width, height;
        //-- The aspect ratio of the controller changes to suit the aspect ratio of the  --//
        //-- section/content.                                                            --//
        if (l.section.w * maxHeight >= maxWidth * l.section.h) {
            width = maxWidth;
            height = maxWidth * l.section.h / l.section.w;
        } else {
            height = maxHeight;
            width = maxHeight * l.section.w / l.section.h;
        }
        log.debug('Resizing controller with height:', height, ', width:', width);
        $(contentDivName).css({ width: width, height: height });
    };

    this.resizeViewer = function (contentDivName) {
        const l = window.ove.layout;
        // The view is plotted across the entire canvas and then
        // moved into place based on the client's coordinates.
        const css = {
            transform: 'translate(-' + l.x + 'px,-' + l.y + 'px)',
            width: l.section.w + 'px',
            height: l.section.h + 'px'
        };
        log.debug('Resizing viewer with height:', css.height, ', width:', css.width);
        log.debug('Performing CSS transform on viewer', css.transform);
        $(contentDivName).css(css);
    };

    //-- Log methods need to be something like log.debug or log.info.                    --//
    this.logThenResolve = function (logMethod, resolve, message) {
        logMethod(message);
        resolve(message);
    };

    this.logThenReject = function (logMethod, reject, message, exception) {
        logMethod(message, exception);
        reject(message);
    };
}
