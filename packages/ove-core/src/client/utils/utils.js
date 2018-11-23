//-- IMPORTANT: all code comments must be in this format. --//

OVE.Utils = new OVEUtils();
function OVEUtils () {
    // @CONSTANTS

    let __self = this;
    let __private = {};
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
        const viewId = OVE.Utils.getQueryParam('oveViewId');
        if (!viewId) {
            return null;
        }
        return viewId.substring(0, viewId.lastIndexOf('-'));
    };

    this.getClient = function () {
        const viewId = OVE.Utils.getQueryParam('oveViewId');
        if (!viewId) {
            return null;
        }
        const parts = viewId.split('-');
        return +parts[parts.length - 1];
    };

    this.getSectionId = function () {
        let id = OVE.Utils.getQueryParam('oveViewId');
        //-- oveViewId will not be provided by a controller --//
        if (!id) {
            return OVE.Utils.getQueryParam('oveSectionId');
        }
        const sectionId = id.substring(id.lastIndexOf('.') + 1);
        id = id.substring(0, id.lastIndexOf('.'));
        if (!id && sectionId) {
            //-- sectionId has not been provided as a part of oveViewId  --//
            //-- oveViewId has the format "{space}-{client}.{sectionId}" --//
            //-- the ".{sectionId}" portion is optional and can be omitted --//
            return OVE.Utils.getQueryParam('oveSectionId');
        } else {
            return sectionId;
        }
    };

    //-----------------------------------------------------------//
    //--                  Coordinates Related                  --//
    //-----------------------------------------------------------//
    this.Coordinates = {
        SCREEN: 'SCREEN',
        SECTION: 'SECTION',
        SPACE: 'SPACE'
    };

    $(document).on(OVE.Event.LOADED, function () {
        const sectionId = __self.getSectionId();
        const hostname = window.ove.context.hostname;
        if (window.ove.layout && __self.getSpace()) {
            fetch(hostname + '/clients').then(function (r) { return r.text(); }).then(function (text) {
                const allClients = JSON.parse(text)[__self.getSpace()] || [];
                if (allClients.length > 0) {
                    //-- The space dimensions are calculated in this utility to avoid  --//
                    //-- duplication of code/effort in ove.js. The dimensions of the   --//
                    //-- space is calculated using the clients that are furthest from  --//
                    //-- the top-left of the space along the x and y axes.             --//
                    window.ove.layout.space = { w: Number.MIN_VALUE, h: Number.MIN_VALUE };
                    allClients.forEach(function (e) {
                        window.ove.layout.space.w = Math.max(e.x + e.w, window.ove.layout.space.w);
                        window.ove.layout.space.h = Math.max(e.y + e.h, window.ove.layout.space.h);
                    });
                    if (sectionId !== undefined && window.ove.layout.offset) {
                        fetch(hostname + '/client/' + sectionId)
                            .then(function (r) { return r.text(); }).then(function (text) {
                                const sectionClients = JSON.parse(text)[__self.getSpace()] || [];
                                const section = { x: Number.MAX_VALUE, y: Number.MAX_VALUE };
                                //-- The x and y of the section is obtained by picking --//
                                //-- the clients within a section that is the nearest  --//
                                //-- to the top-left of the space along the x and y    --//
                                //-- axes.                                             --//
                                sectionClients.forEach(function (e, i) {
                                    if (!__self.JSON.equals(e, {}) && allClients[i]) {
                                        section.x = Math.min(allClients[i].x + window.ove.layout.offset.x, section.x);
                                        section.y = Math.min(allClients[i].y + window.ove.layout.offset.y, section.y);
                                    }
                                });
                                if (section.x !== Number.MAX_VALUE && section.y !== Number.MAX_VALUE) {
                                    __private.section = {
                                        x: section.x + window.ove.layout.offset.x,
                                        y: section.y + window.ove.layout.offset.y
                                    };
                                }
                            });
                    }
                }
            });
        }
    });

    this.Coordinates.transform = function (vector, inputType, outputType) {
        if (!__private.section) {
            log.error('Unable to transform coordinates, geometry information not available');
            return undefined;
        }
        const section = __private.section;
        const layout = window.ove.layout;
        if ((inputType === OVE.Utils.Coordinates.SCREEN || outputType === OVE.Utils.Coordinates.SCREEN) &&
            (layout.x === undefined || layout.y === undefined || !layout.offset)) {
            log.error('Unable to transform coordinates, screen geometry information not available');
            return undefined;
        }
        if ((inputType === OVE.Utils.Coordinates.SPACE || outputType === OVE.Utils.Coordinates.SPACE) &&
            section === undefined) {
            log.error('Unable to transform coordinates, section geometry information not available');
            return undefined;
        }

        //-- No conversions along the z-axis as yet --//
        const Conversions = {
            SCREEN_TO_SECTION: [layout.x - layout.offset.x, layout.y - layout.offset.y, 0],
            SECTION_TO_SCREEN: [layout.offset.x - layout.x, layout.offset.y - layout.y, 0],
            SECTION_TO_SPACE: [section.x, section.y, 0],
            SPACE_TO_SECTION: [-section.x, -section.y, 0],
            SCREEN_TO_SPACE: [layout.x - layout.offset.x + section.x, layout.y - layout.offset.y + section.y, 0],
            SPACE_TO_SCREEN: [layout.offset.x - layout.x - section.x, layout.offset.y - layout.y - section.y, 0]
        };

        //-- Logic to run the corresponding conversion --//
        const conversion = Conversions[inputType + '_TO_' + outputType];
        if (!conversion) {
            log.error('Unable to convert', vector, 'from:', inputType, 'to:', outputType);
            return undefined;
        }
        let output = [];
        vector.forEach(function (e, i) {
            output.push(e + conversion[i]);
        });
        return output;
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
