//-- IMPORTANT: all code comments must be in this format. --//

OVE.Utils = new OVEUtils();
function OVEUtils () {
    // @CONSTANTS

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
    this.Logger = function (name, logLevel) {
        return new OVELogger(name, logLevel);
    };
    //-- Instance of logger for the use of OVE.Utils            --//
    const log = this.Logger('OVEUtils');

    function OVELogger (name, logLevel) {
        //-- Constants for log labels corresponding to levels.  --//
        const LOG_PREFIX_WIDTH = 9;

        //-- The logger name is stored for later use.           --//
        //-- The log level is either what is specified in the   --//
        //-- constructor or available as a constant.            --//
        let __private = { name: name, logLevel: (logLevel !== undefined ? logLevel : Constants.LOG_LEVEL) };

        //-- Internal Utility function to get log labels' CSS   --//
        const getLogLabel = function (logLevel) {
            return 'font-weight: 500; background: ' + logLevel.label.bgColor + '; color: ' + logLevel.label.color;
        };

        //-- Internal Utility function to build log messages. --//
        const buildLogMessage = function (logLevel, args) {
            const time = (function (d) {
                const locale = window.navigator.userLanguage || window.navigator.language;
                return d.toLocaleString(locale, { hour12: true }).replace(/([ ]?[aApP][mM])/,
                    '.' + (d.getMilliseconds() + '').padStart(3, '0') + ' $&');
            }(new Date()));
            //-- Each logger can have its own name. If this is  --//
            //-- not provided, it will default to Unknown.      --//
            const loggerName = __private.name || Constants.LOG_UNKNOWN_APP_ID;
            return [('%c[' + logLevel.name + ']').padStart(LOG_PREFIX_WIDTH), getLogLabel(logLevel), time, '-',
                loggerName.padEnd(Constants.LOG_APP_ID_WIDTH), ':'].concat(Object.values(args));
        };

        //-- Expose a function for each log-level               --//
        (function (__self) {
            Constants.LogLevel.forEach(function (level, i) {
                __self[level.name.toLowerCase()] = function () {
                    if (__private.logLevel >= i) {
                        //-- All log functions accept any number--//
                        //-- of arguments                       --//
                        console[level.consoleLogger].apply(console, buildLogMessage(level, arguments));
                    }
                };
            });
        })(this);
    }

    //-----------------------------------------------------------//
    //--                     State Updates                     --//
    //-----------------------------------------------------------//

    //-- Debug logs related to State Updates are produced by OVE Core and therefore not  --//
    //-- produced in here.                                                               --//
    this.broadcastState = function (message) {
        if (arguments.length > 0 && message) {
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
    //--     3. Setup of section in parallel to the loading of state which should happen --//
    //--        much faster, but we don't want to wait till that finishes to load state. --//
    this.initView = function (initMethod, loadContentMethod, setupSectionMethod) {
        initMethod();
        const shouldSetupSection = arguments.length > 2 && setupSectionMethod;
        $(document).on(OVE.Event.LOADED, function () {
            log.debug('Invoking OVE.Event.Loaded handler');
            if (!window.ove.context.isInitialized) {
                //-- Ignore promise rejection, as it is expected if no state exists.     --//
                window.ove.state.load().then(loadContentMethod).catch(function (_err) { });
            }
            if (shouldSetupSection) {
                log.debug('Running post-initialization section setup operation');
                setupSectionMethod();
            }
        });
    };

    //-----------------------------------------------------------//
    //--                     Layout Related                    --//
    //-----------------------------------------------------------//
    this.getSpace = function () {
        const clientId = this.getQueryParam('oveClientId');
        return clientId.substr(0, clientId.lastIndexOf('-'));
    };

    this.getClient = function () {
        const clientId = this.getQueryParam('oveClientId');
        const parts = clientId.split('-');
        return +parts[parts.length - 1];
    };

    //-----------------------------------------------------------//
    //--                    Other Utilities                    --//
    //-----------------------------------------------------------//
    this.getQueryParam = function (name, defaultValue) {
        if (arguments.length > 1 && defaultValue) {
            return new URLSearchParams(location.search.slice(1)).get(name) || defaultValue;
        }
        return new URLSearchParams(location.search.slice(1)).get(name);
    };

    this.resizeController = function (contentDivName) {
        const l = window.ove.layout;
        //-- The element with id contentDivName is scaled to fit inside both the client  --//
        //-- and window, whilst maintaining the aspect ratio of the section/content.     --//
        const maxWidth = Math.min(document.documentElement.clientWidth, window.innerWidth);
        const maxHeight = Math.min(document.documentElement.clientHeight, window.innerHeight);
        let width, height;
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
        //-- The element with id contentDivName is resized to the size of the            --//
        //-- corresponding section (which may span multiple clients), and then           --//
        //-- translated based on the client's coordinates.                               --//
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
