//-- IMPORTANT: all code comments must be in this format. --//

OVE.Utils = new OVEUtils();
function OVEUtils () {
    // @CONSTANTS

    let __self = this;
    let __private = {};

    //-- It may be required to change the default OVE instance used by OVE.Utils --//
    //-- This function cannot be used unless it has been overridden.             --//
    __private.getOVEInstance = function () {
        return __self.__getOVEInstance ? __self.__getOVEInstance() : window.ove;
    };

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
    //-- Instance of logger for the use of OVE.Utils           --//
    const log = this.Logger('OVEUtils');

    function OVELogger (name, logLevel) {
        //-- https://github.com/uxitten/polyfill/blob/master/string.polyfill.js --//
        //-- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart --//
        if (!String.prototype.padStart) {
            String.prototype.padStart = function padStart (targetLength, padString) {
                targetLength = targetLength >> 0;
                padString = String(typeof padString !== 'undefined' ? padString : ' ');
                if (this.length >= targetLength) {
                    return String(this);
                } else {
                    targetLength = targetLength - this.length;
                    if (targetLength > padString.length) {
                        padString += padString.repeat(targetLength / padString.length);
                    }
                    return padString.slice(0, targetLength) + String(this);
                }
            };
        }
        //-- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padEnd --//
        if (!String.prototype.padEnd) {
            String.prototype.padEnd = function padEnd (targetLength, padString) {
                targetLength = targetLength >> 0;
                padString = String((typeof padString !== 'undefined' ? padString : ' '));
                if (this.length > targetLength) {
                    return String(this);
                } else {
                    targetLength = targetLength - this.length;
                    if (targetLength > padString.length) {
                        padString += padString.repeat(targetLength / padString.length);
                    }
                    return String(this) + padString.slice(0, targetLength);
                }
            };
        }

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

        //-- Internal Utility function to build log messages.   --//
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
        if (__private.getOVEInstance().context.updateFlag) return;
        if (arguments.length > 0 && message) {
            //-- Sometimes, state is not the only message that is broadcast and will   --//
            //-- therefore the application may want to broadcast it in a specific format.--//
            fetch(__private.getOVEInstance().context.hostname + '/connections/event/' + __self.getSectionId(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appId: __private.getOVEInstance().app, sectionId: __self.getSectionId(), message: message })
            }).then(res => log.debug('Sent connection event and received status: ', res.status));
            message.controllerId = __private.getOVEInstance().context.uuid;
            __private.getOVEInstance().socket.send(message);
        } else {
            const m = __private.getOVEInstance().state.current;
            fetch(__private.getOVEInstance().context.hostname + '/connections/event/' + __self.getSectionId(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appId: __private.getOVEInstance().app, sectionId: __self.getSectionId(), message: m })
            }).then(res => log.debug('Sent connection event and received status: ', res.status));
            m.controllerId = __private.getOVEInstance().context.uuid;
            __private.getOVEInstance().socket.send(m);
        }
        __private.getOVEInstance().state.cache();
    };

    this.setOnStateUpdate = function (callback) {
        __private.getOVEInstance().socket.on(function (message) {
            let m = message;
            if (m.sectionId) {
                if (m.sectionId !== __self.getSectionId()) return;
                m = m.message;
            }
            if (m.operation) return;
            if (m.controllerId !== __private.getOVEInstance().context.uuid) {
                const copy = {};
                Object.keys(m).filter(key => key !== 'controllerId').forEach(key => { copy[key] = m[key]; });
                __private.getOVEInstance().state.current = copy;
                callback();
            }
        });
    };

    this.setOnStateUpdateController = function (callback) {
        __private.getOVEInstance().socket.on(function (message) {
            let m = message;
            if (m.sectionId) {
                if (m.sectionId !== __self.getSectionId()) return;
                m = m.message;
            }
            if (m.operation) return;
            if (m.controllerId !== __private.getOVEInstance().context.uuid) {
                const copy = {};
                Object.keys(m).filter(key => key !== 'controllerId').forEach(key => { copy[key] = m[key]; });
                __private.getOVEInstance().state.current = copy;
                callback();
            }
        });
    };

    //-----------------------------------------------------------//
    //--                     Initialization                    --//
    //-----------------------------------------------------------//

    //-- The main difference between the two methods below is that the on-demand option  --//
    //-- does not wait for OVE to load.                                                  --//
    this.initControlOnDemand = function (defaultState, initMethod) {
        const state = __private.getOVEInstance().state.name || defaultState;
        log.debug('Initializing controller with state:', state);
        $(window).resize(function () {
            location.reload();
        });
        //-- The default state URL is used here. --//
        $.ajax({ url: 'states/' + state, dataType: 'json' }).done(initMethod).catch(log.error);
    };

    this.initControl = function (defaultState, initMethod) {
        $(document).on(OVE.Event.LOADED, function () {
            log.debug('Invoking OVE.Event.Loaded handler');
            __private.getOVEInstance().state.load().then(function () {
                const current = __private.getOVEInstance().state.current;
                if (current) {
                    log.debug('Initializing controller with state:', current);
                    $(window).resize(function () {
                        location.reload();
                    });
                    initMethod(current);
                } else {
                    log.debug('Missing state information - loading default state');
                    __self.initControlOnDemand(defaultState, initMethod);
                }
            }).catch(function () {
                log.debug('State load failed - loading default state');
                //-- If the promise is rejected, that means no current state is existing.--//
                __self.initControlOnDemand(defaultState, initMethod);
            });
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
            if (!__private.getOVEInstance().context.isInitialized) {
                __private.getOVEInstance().state.onRefresh(loadContentMethod);
                //-- Ignore promise rejection, as it is expected if no state exists.     --//
                __private.getOVEInstance().state.load().then(loadContentMethod).catch(function (_err) { });
            }
            if (shouldSetupSection) {
                log.debug('Running post-initialization section setup operation');
                setupSectionMethod();
            }
        });
    };

    //-----------------------------------------------------------//
    //--                   Geometry Related                    --//
    //-----------------------------------------------------------//
    this.getSpace = function () {
        const viewId = OVE.Utils.getViewId();
        const space = !viewId ? __private.space : viewId.substring(0, viewId.lastIndexOf('-'));
        if (!space) {
            log.warn('Name of space not provided');
        }
        return space;
    };

    $(document).on(OVE.Event.LOADED, function () {
        const sectionId = __self.getSectionId();
        if (__private.getOVEInstance() && __private.getOVEInstance().geometry && !__self.getSpace() && sectionId !== undefined) {
            fetch(__private.getOVEInstance().context.hostname + '/spaces?oveSectionId=' + sectionId)
                .then(function (r) { return r.text(); }).then(function (text) {
                    const spaces = Object.keys(JSON.parse(text));
                    if (spaces.length > 0) {
                        __private.space = spaces[0];
                        //-- Try to load geometry if it was not loaded before --//
                        if (!__private.getOVEInstance().geometry.space) {
                            loadGeometry();
                        }
                    }
                });
        }
    });

    this.getClient = function () {
        const viewId = OVE.Utils.getViewId();
        let client;
        if (!viewId) {
            client = null;
        } else {
            const parts = viewId.split('-');
            client = +parts[parts.length - 1];
        }
        if (!client && client !== 0) {
            log.warn('Client id not provided');
        }
        return client;
    };

    this.getSectionId = function () {
        let id = OVE.Utils.getViewId();
        //-- oveViewId will not be provided by a controller --//
        if (!id) {
            return OVE.Utils.getQueryParam('oveSectionId');
        }
        const sectionId = id.substring(id.lastIndexOf('.') + 1);
        id = id.substring(0, id.lastIndexOf('.'));
        if (!id && sectionId) {
            //-- sectionId has not been provided as a part of oveViewId  --//
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

    const loadGeometry = function () {
        if (__private.getOVEInstance() && __private.getOVEInstance().geometry && __self.getSpace()) {
            const sectionId = __self.getSectionId();
            const hostname = __private.getOVEInstance().context.hostname;
            fetch(hostname + '/spaces').then(function (r) { return r.text(); }).then(function (text) {
                const allClients = JSON.parse(text)[__self.getSpace()] || [];
                if (allClients.length > 0) {
                    //-- The space dimensions are calculated in this utility to avoid  --//
                    //-- duplication of code/effort in ove.js. The dimensions of the   --//
                    //-- space is calculated using the clients that are furthest from  --//
                    //-- the top-left of the space along the x and y axes.             --//
                    __private.getOVEInstance().geometry.space = { w: Number.MIN_VALUE, h: Number.MIN_VALUE };
                    allClients.forEach(function (e) {
                        __private.getOVEInstance().geometry.space.w = Math.max(e.x + e.w, __private.getOVEInstance().geometry.space.w);
                        __private.getOVEInstance().geometry.space.h = Math.max(e.y + e.h, __private.getOVEInstance().geometry.space.h);
                    });
                    if (sectionId !== undefined) {
                        fetch(hostname + '/spaces?oveSectionId=' + sectionId)
                            .then(function (r) { return r.text(); }).then(function (text) {
                                const sectionClients = JSON.parse(text)[__self.getSpace()] || [];
                                const section = { x: Number.MAX_VALUE, y: Number.MAX_VALUE };
                                //-- The x and y of the section is obtained by picking --//
                                //-- the clients within a section that is the nearest  --//
                                //-- to the top-left of the space along the x and y    --//
                                //-- axes.                                             --//
                                sectionClients.forEach(function (e, i) {
                                    if (!__self.JSON.equals(e, {}) && allClients[i]) {
                                        section.x = Math.min(allClients[i].x - e.x + e.offset.x, section.x);
                                        section.y = Math.min(allClients[i].y - e.y + e.offset.y, section.y);
                                    }
                                });
                                if (section.x !== Number.MAX_VALUE && section.y !== Number.MAX_VALUE) {
                                    __private.section = section;
                                }
                            });
                    }
                }
            });
        }
    };
    $(document).on(OVE.Event.LOADED, loadGeometry);

    this.Coordinates.transform = function (vector, inputType, outputType) {
        if (!__private.section) {
            log.error('Unable to transform coordinates, geometry information not available');
            return undefined;
        }
        const section = __private.section;
        const g = __private.getOVEInstance().geometry;
        if ((inputType === OVE.Utils.Coordinates.SCREEN || outputType === OVE.Utils.Coordinates.SCREEN) &&
            (g.x === undefined || g.y === undefined || !g.offset)) {
            log.error('Unable to transform coordinates, screen geometry information not available');
            return undefined;
        }
        if ((inputType === OVE.Utils.Coordinates.SPACE || outputType === OVE.Utils.Coordinates.SPACE) &&
            section === undefined) {
            log.error('Unable to transform coordinates, section geometry information not available');
            return undefined;
        }

        //-- No conversions along the z-axis as yet --//
        const Conversions = {};
        if (g.x !== undefined && g.y !== undefined && g.offset) {
            Conversions.SCREEN_TO_SECTION = [g.x - g.offset.x, g.y - g.offset.y, 0];
            Conversions.SECTION_TO_SCREEN = [g.offset.x - g.x, g.offset.y - g.y, 0];
            if (section !== undefined) {
                Conversions.SCREEN_TO_SPACE = [g.x - g.offset.x + section.x, g.y - g.offset.y + section.y, 0];
                Conversions.SPACE_TO_SCREEN = [g.offset.x - g.x - section.x, g.offset.y - g.y - section.y, 0];
            }
        }
        if (section !== undefined) {
            Conversions.SECTION_TO_SPACE = [section.x, section.y, 0];
            Conversions.SPACE_TO_SECTION = [-section.x, -section.y, 0];
        }

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

    //-- This is a common operation used by a majority of OVE applications --//
    this.getURLQueryParam = function () {
        return OVE.Utils.getQueryParam('url');
    };

    this.getViewId = function () {
        //-- All app-viewers will define a oveSectionViewId and all OVE core viewer will --//
        //-- define a oveViewId.                                                         --//
        //-- BACKWARDS-COMPATIBILITY: For < v0.2.0 --//
        return OVE.Utils.getQueryParam('oveSectionViewId') || OVE.Utils.getQueryParam('oveViewId') || OVE.Utils.getQueryParam('oveClientId');
    };

    this.resizeController = function (contentDivName) {
        const g = __private.getOVEInstance().geometry;
        //-- The element with id contentDivName is scaled to fit inside both the client  --//
        //-- and window, whilst maintaining the aspect ratio of the section/content.     --//
        const maxWidth = Math.min(document.documentElement.clientWidth, window.innerWidth);
        const maxHeight = Math.min(document.documentElement.clientHeight, window.innerHeight);
        let width, height;
        if (g.section.w * maxHeight >= maxWidth * g.section.h) {
            width = maxWidth;
            height = maxWidth * g.section.h / g.section.w;
        } else {
            height = maxHeight;
            width = maxHeight * g.section.w / g.section.h;
        }
        log.debug('Resizing controller with height:', height, ', width:', width);
        $(contentDivName).css({ width: width, height: height });
    };

    this.resizeViewer = function (contentDivName) {
        const g = __private.getOVEInstance().geometry;
        //-- The element with id contentDivName is resized to the size of the            --//
        //-- corresponding section (which may span multiple clients), and then           --//
        //-- translated based on the client's coordinates.                               --//
        const css = {
            transform: 'translate(-' + g.x + 'px,-' + g.y + 'px)',
            width: g.section.w + 'px',
            height: g.section.h + 'px'
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
