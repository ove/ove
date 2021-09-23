/*
 * ove.js v@VERSION
 * https://github.com/ove/ove
 *
 * Copyright (c) @AUTHOR
 * Released under @LICENSE License
 */
//-- IMPORTANT: all code comments must be in this format. --//
function OVE (appId, hostname, sectionId) {
    // @CONSTANTS

    const log = OVE.Utils.Logger('OVE');
    this.app = appId;

    //-- Hostname is detected using the URL at which the OVE.js script is loaded. It can be read --//
    //-- with or without the scheme (useful for opening WebSockets).                             --//
    const getHostName = function (withScheme) {
        if (__private.hostname) {
            return (withScheme ? '//' : '') + __private.hostname;
        }
        let scripts = document.getElementsByTagName('script');
        for (let i = 0; i < scripts.length; i++) {
            if (scripts[i].src.indexOf('ove.js') > 0) {
                return scripts[i].src.substring(
                    withScheme ? 0 : scripts[i].src.indexOf('//') + 2,
                    scripts[i].src.lastIndexOf('/'));
            }
        }
    };

    //-----------------------------------------------------------//
    //--                  Messaging Functions                  --//
    //-----------------------------------------------------------//

    const OVEClock = function (__private) {
        //-- SDK functions --//
        this.getTime = function () {
            return new Date().getTime() - (__private.clockDiff || 0);
        };
    };

    const OVEFrame = function (__self, __private) {
        let onMessage = __self.socket.on;

        const syncClock = function (__self, __private) {
            if (window.parent !== window) {
                window.parent.postMessage({
                    appId: Constants.APP_NAME,
                    sync: { id: __self.context.uuid }
                }, '*');
            }
        };

        window.addEventListener('message', function (m) {
            const data = m.data;
            //-- The clock sync request is the one with the highest priority and the server should make --//
            //-- no further checks before responding. Matching code is used in client and server sides. --//
            if (data.sync) {
                log.trace('Responded to sync request');
                let clockDiff = {};
                clockDiff[data.sync.id] = __private.clockDiff;
                for (let i = 0; i < window.frames.length; i++) {
                    window.frames[i].postMessage({
                        appId: Constants.APP_NAME,
                        clockDiff: clockDiff
                    }, '*');
                }
                return;
            } else if (data.clockDiff) {
                if (data.clockDiff[__self.context.uuid] !== undefined) {
                    __private.syncResults = new Array(Constants.CLOCK_SYNC_ATTEMPTS);
                    __private.clockReSync = function (__self, __private) {
                        setTimeout(function () {
                            syncClock(__self, __private);
                        }, Constants.CLOCK_SYNC_INTERVAL);
                    };
                    let diff = data.clockDiff[__self.context.uuid];
                    __private.clockDiff = (__private.clockDiff || 0) + diff;
                    log.debug('Got a clock difference of:', diff);
                    if (diff) {
                        //-- Prevent sync over sockets --//
                        __private.clockReSync(__self, __private);
                    }
                }
                return;
            }

            //-- Apps receive the message if either it was sent to all sections or the specific section --//
            //-- of the app. Apps will not receive messages sent to other apps.                         --//
            if (data.appId === __private.appId && (!data.sectionId || data.sectionId === __private.sectionId)) {
                if (Constants.Logging.TRACE) {
                    log.trace('Reading message:', JSON.stringify(data));
                }
                onMessage(data.message);
            }
        });
        syncClock(__self, __private);

        //-- SDK functions --//
        this.on = function (func) {
            onMessage = func;
        };
        this.send = function (target, message, appId) {
            //-- The identifier of the target application could be omitted if the message was sent to self. --//
            const targetAppId = (arguments.length > 2 && appId) ? appId : __private.appId;

            const postMessage = function (frame, message, appId) {
                const data = { appId: appId, message: message };
                log.trace('Sending message:', data);
                frame.postMessage(data, '*');
            };

            //-- BACKWARDS-COMPATIBILITY: For <= v0.4.1 --//
            if (!Constants.Frame.PARENT) {
                Constants.Frame.PARENT = 'parent';
            }
            switch (target) {
                case Constants.Frame.PEER:
                    if (window.parent !== window) {
                        for (let i = 0; i < window.parent.frames.length; i++) {
                            postMessage(window.parent.frames[i], message, targetAppId);
                        }
                    }
                    break;
                case Constants.Frame.CHILD:
                    for (let i = 0; i < window.frames.length; i++) {
                        postMessage(window.frames[i], message, appId);
                    }
                    break;
                case Constants.Frame.PARENT:
                    if (window.parent !== window) {
                        postMessage(window.parent, message, targetAppId);
                    }
                    break;
                default:
                    log.warn('Unable to handle target:', target);
            }
        };
    };

    const sendWhenReady = function (callback) {
        //-- We always wait for the socket to be ready before broadcast. The same code blocks messages  --//
        //-- when a socket is temporarily closed.                                                       --//
        new Promise(function (resolve) {
            const x = setInterval(function () {
                if (__private.ws.readyState === WebSocket.OPEN) {
                    clearInterval(x);
                    resolve('socket open');
                }
            }, Constants.SOCKET_READY_DELAY);
        }).then(callback);
    };

    const OVESocket = function (__self, __private) {
        //-- Default onMessage handler does nothing --//
        let onMessage = function () { return 0; };

        const syncClock = function (__self, __private) {
            if (!__private.syncResults) {
                __private.syncResults = [];
            }
            if (__private.syncResults.length < Constants.CLOCK_SYNC_ATTEMPTS) {
                const clockSyncRequest = function () {
                    sendWhenReady(function () {
                        __private.ws.send(JSON.stringify({
                            appId: Constants.APP_NAME,
                            sync: { id: __self.context.uuid }
                        }));
                    });
                };
                //-- We trigger a clock-sync 5 times within a 2 minute period. --//
                for (let i = 0; i < Constants.CLOCK_SYNC_ATTEMPTS; i++) {
                    //-- If we lost socket connection in between syncs, we may have already  --//
                    //-- made some sync requests.                                            --//
                    if (__private.syncResults.length + i < Constants.CLOCK_SYNC_ATTEMPTS) {
                        setTimeout(clockSyncRequest, Math.random() *
                            (Constants.CLOCK_SYNC_INTERVAL / Constants.CLOCK_SYNC_ATTEMPTS) | 0);
                    }
                }
            }
        };

        __private.clockReSync = function (__self, __private) {
            __private.syncResults = [];
            syncClock(__self, __private);
        };

        //-- Socket init code --//
        const getSocket = function (url) {
            __private.ws = new WebSocket(url);
            __private.ws.addEventListener('error', log.error);
            __private.ws.addEventListener('open', function () {
                if (__private.appId !== Constants.APP_NAME) {
                    sendWhenReady(function () {
                        __private.ws.send(JSON.stringify({
                            appId: __private.appId,
                            registration: { sectionId: (__private.sectionId || '-1') }
                        }));
                    });
                } else {
                    let id = OVE.Utils.getViewId();
                    if (id) {
                        if (id.lastIndexOf('.') !== -1) {
                            id = id.substring(0, id.lastIndexOf('.'));
                        }
                        const client = id.substring(id.lastIndexOf('-') + 1);
                        const space = id.substring(0, id.lastIndexOf('-'));
                        if (space && client) {
                            sendWhenReady(function () {
                                __private.ws.send(JSON.stringify({
                                    appId: __private.appId,
                                    registration: { client: client, space: space }
                                }));
                            });
                        }
                    }
                }
                syncClock(__self, __private);
                log.debug('WebSocket connection made with:', url);
            });
            __private.ws.addEventListener('message', function (m) {
                const data = JSON.parse(m.data);
                //-- The clock sync request is the one with the highest priority and the server should make --//
                //-- no further checks before responding. Matching code is used in client and server sides. --//
                if (data.sync) {
                    if (!data.sync.t2) {
                        try {
                            __private.ws.send(JSON.stringify({
                                appId: data.appId,
                                sync: {
                                    id: data.sync.id,
                                    serverDiff: data.sync.serverDiff,
                                    t1: new Date().getTime()
                                }
                            }));
                        } catch (e) {
                            if (__private.ws.readyState === WebSocket.OPEN) {
                                log.error('Error sending message:', e.message);
                            }
                            //-- ignore all other errors, since there is no value in recording them.        --//
                        }
                    } else {
                        //-- We must construct the sync result similar to the server, to avoid differences. --//
                        let syncResult = {
                            appId: data.appId,
                            sync: {
                                id: data.sync.id,
                                serverDiff: data.sync.serverDiff,
                                t3: new Date().getTime(),
                                t2: data.sync.t2,
                                t1: data.sync.t1
                            }
                        };
                        //-- Always broadcast a difference as an integer --//
                        let diff = ((syncResult.sync.t1 + syncResult.sync.t3) / 2 -
                            syncResult.sync.t2 - syncResult.sync.serverDiff) | 0;
                        if (__private.clockDiff) {
                            diff -= __private.clockDiff;
                        }
                        __private.syncResults.push({ id: data.sync.id, diff: diff });
                        log.trace('Clock skew detection attempt:', __private.syncResults.length, 'difference:', diff);
                        if (__private.syncResults.length === Constants.CLOCK_SYNC_ATTEMPTS) {
                            sendWhenReady(function () {
                                __private.ws.send(JSON.stringify({
                                    appId: __private.appId,
                                    syncResults: __private.syncResults
                                }));
                            });
                        }
                    }
                    log.trace('Responded to sync request');
                    return;
                } else if (data.clockDiff) {
                    let diff = data.clockDiff[__self.context.uuid];
                    __private.clockDiff = (__private.clockDiff || 0) + diff;
                    log.debug('Got a clock difference of:', diff);
                    if (diff) {
                        __private.clockReSync(__self, __private);
                    }
                    return;
                } else if (data.clockReSync) {
                    __private.clockReSync(__self, __private);
                    return;
                }

                //-- Apps receive the message if either it was sent to all sections or the specific section --//
                //-- of the app. Apps will not receive messages sent to other apps.                         --//
                if (!data.sectionId || Number(data.sectionId) === Number(__private.sectionId)) {
                    if (Constants.Logging.TRACE) {
                        log.trace('Reading message:', JSON.stringify(data));
                    }
                    if (data.operation === Constants.Operation.REFRESH && __private.appId !== Constants.APP_NAME) {
                        if (__private.stateRefresh) {
                            log.debug('Refreshing state');
                            __self.state.load().then(__private.stateRefresh);
                        } else {
                            log.warn('Unable to refresh application state');
                        }
                    } else if (data.appId === __private.appId) {
                        onMessage(data.message);
                    }
                }
            });
            __private.ws.addEventListener('close', function () {
                log.warn('Lost websocket connection attempting to reconnect');
                //-- If the socket is closed, we try to refresh it. This fixes frozen pages after a restart --//
                setTimeout(function () { getSocket(url); }, Constants.SOCKET_REFRESH_DELAY);
            });
        };
        getSocket('ws://' + getHostName(false) + '/');

        //-- SDK functions --//
        this.on = function (func) {
            onMessage = func;
        };

        this.addEventListener = (func) => {
            __private.ws.addEventListener('message', message => {
                if (!message || !message.data) return;
                const data = JSON.parse(message.data);
                if (data.appId !== appId || (data.sectionId && Number(data.sectionId) !== Number(OVE.Utils.getSectionId())) || !data.message) return;
                func(data.message);
            });
        };

        this.send = function (message, appId) {
            //-- The identifier of the target application could be omitted if the message was sent to self. --//
            const targetAppId = (arguments.length > 1 && appId) ? appId : __private.appId;
            message.controllerId = __self.context.uuid;

            if (__private.sectionId) {
                fetch(`${__self.context.hostname}/connections/sections/event/${__private.sectionId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ appId: targetAppId, sectionId: __private.sectionId, message: message })
                }).then(res => log.debug('Sent connection event and received status: ', res.status));
            }

            sendWhenReady(function () {
                //-- The same code works for the OVE Core viewer (which has no sectionId) and OVE Core Apps --//
                let data;
                if (__private.sectionId) {
                    data = JSON.stringify({ appId: targetAppId, sectionId: __private.sectionId, message: message });
                } else {
                    data = JSON.stringify({ appId: targetAppId, message: message });
                }
                log.trace('Sending message:', data);
                __private.ws.send(data);
            });
        };
    };

    //-----------------------------------------------------------//
    //--                  Geometry Variables                   --//
    //-----------------------------------------------------------//
    const setGeometry = async function (__self, __private) {
        __self.geometry = {};
        const fetchSection = async function (sectionId) {
            if (!sectionId) return;
            log.debug('Requesting details of section:', sectionId);
            const raw = await (await fetch(getHostName(true) + '/sections/' + sectionId)).text();
            const section = JSON.parse(raw);
            __self.geometry.section = { w: section.w, h: section.h };
            __self.state.name = OVE.Utils.getQueryParam('state', (section.app && section.app.state) ? section.app.state : undefined);
            //-- Always store section id as a string to avoid if-checks      --//
            //-- failing on '0'                                              --//
            if (section.id !== undefined) {
                __private.sectionId = section.id.toString();
                sendWhenReady(function () {
                    __private.ws.send(JSON.stringify({
                        appId: __private.appId,
                        registration: { sectionId: __private.sectionId }
                    }));
                });
                log.debug('Got details from section:', __private.sectionId);
            }
            //-- We wait for section information to be available before      --//
            //-- announcing OVE loaded                                       --//
            $(document).trigger(OVE.Event.LOADED);
        };
        let id = OVE.Utils.getViewId();
        //-- oveViewId will not be provided by a controller --//
        if (!id) {
            let sectionId = OVE.Utils.getSectionId() || __private.proposedSectionId;
            if (!sectionId && sectionId !== 0) {
                log.warn('Section id not provided');
            }
            await fetchSection(sectionId);
            return;
        }
        let sectionId = id.substring(id.lastIndexOf('.') + 1);
        id = id.substring(0, id.lastIndexOf('.'));
        if (!id && sectionId) {
            //-- sectionId has not been provided as a part of oveViewId  --//
            //-- oveViewId has the format "{space}-{client}.{sectionId}" --//
            //-- the ".{sectionId}" portion is optional and can be omitted --//
            id = sectionId;
            sectionId = OVE.Utils.getSectionId();
        }
        const client = id.substring(id.lastIndexOf('-') + 1);
        const space = id.substring(0, id.lastIndexOf('-'));
        if (!space) {
            log.warn('Name of space not provided');
        }
        if (!client && Number(client) !== 0) {
            log.warn('Client id not provided');
        }
        if (sectionId) {
            log.info('Running OVE for section:', sectionId, ', client:', client, ', space:', space);
        } else {
            log.info('Running OVE for client:', client, ', space:', space);
        }
        log.debug('OVE instance UUID:', __self.context.uuid);
        //-- call APIs /spaces or /spaces?oveSectionId={sectionId}  --//
        const raw = await fetch(getHostName(true) + '/spaces' + (sectionId ? '?oveSectionId=' + sectionId : ''));
        const text = await raw.text();
        __self.geometry = (JSON.parse(text)[space] || [])[client] || {};
        await fetchSection(sectionId);
    };

    //-----------------------------------------------------------//
    //--            Shared State and Local Context             --//
    //-----------------------------------------------------------//
    const OVEState = function (__self, __private) {
        //-- Default onRefresh handler does nothing --//
        __private.stateRefresh = function () { return 0; };

        //-- This function will be invoked if the state changes --//
        this.onRefresh = function (func) {
            __private.stateRefresh = func;
        };

        //-- State can be cached/loaded at an app-level --//
        this.cache = function (url) {
            const endpoint = url || ('instances/' + __private.sectionId + '/state');
            const currentState = JSON.stringify(this.current);
            log.debug('Sending request to URL:', endpoint, ', state:', currentState);
            $.ajax({ url: endpoint, type: 'POST', data: currentState, contentType: 'application/json' });
            $.ajax({ url: `${__self.context.hostname}/connections/sections/cache/${__private.sectionId}`, type: 'POST', data: currentState, contentType: 'application/json' });
        };
        this.load = function (url) {
            let __self = this;
            return new Promise(function (resolve, reject) {
                const endpoint = url || ('instances/' + __private.sectionId + '/state');
                const onLoad = function (state) {
                    if (state) {
                        __self.current = state;
                        log.debug('Got response from URL:', endpoint, ', state:', state);
                        OVE.Utils.logThenResolve(log.debug, resolve, 'state loaded');
                    } else {
                        //-- Rejection is handled similar to a resolution, since this is expected --//
                        OVE.Utils.logThenResolve(log.debug, reject,
                            'state not pre-loaded, please load using controller');
                    }
                };
                $.get(endpoint).done(onLoad);
            });
        };
        this.current = {};
        this.name = undefined;
    };

    //-- holds private data within OVE library --//
    let __private = { appId: appId, hostname: hostname };

    //-- sectionId can be provided into OVE but will only be used if it cannot be determined      --//
    //-- using the oveViewId and oveSectionId query parameters.                                 --//
    if (sectionId || sectionId === 0) {
        __private.proposedSectionId = sectionId.toString();
    }

    this.context = {
        //-- A version 4 UUID is available for each OVE instance. This to support intra/inter-app --//
        //-- messaging and debugging.                                                             --//
        uuid: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            let r = Math.random() * 16 | 0;
            let v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        }),
        hostname: getHostName(true),
        updateFlag: false
    };

    this.socket = new OVESocket(this, __private);
    this.frame = new OVEFrame(this, __private);
    this.state = new OVEState(this, __private);
    this.clock = new OVEClock(__private);
    setGeometry(this, __private).then(log.debug('Geometry set'));
}

//-----------------------------------------------------------//
//--                   OVE Event Names                     --//
//-----------------------------------------------------------//
OVE.Event = {
    LOADED: 'ove.loaded'
};
