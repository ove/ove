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

    const OVEFrame = function (__self, __private) {
        let onMessage = __self.socket.on;

        window.addEventListener('message', function (m) {
            const data = m.data;
            //-- Apps receive the message if either it was sent to all sections or the specific section --//
            //-- of the app. Apps will not receive messages sent to other apps.                         --//
            if (data.appId === __private.appId && (!data.sectionId || data.sectionId === __private.sectionId)) {
                if (Constants.Logging.TRACE) {
                    log.trace('Reading message:', JSON.stringify(data));
                }
                onMessage(data.message);
            }
        });

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
                default:
                    log.warn('Unable to handle target:', target);
            }
        };
    };

    const OVESocket = function (__private) {
        //-- Default onMessage handler does nothing --//
        let onMessage = function () { return 0; };

        //-- Socket init code --//
        const getSocket = function (url) {
            __private.ws = new WebSocket(url);
            __private.ws.addEventListener('error', log.error);
            __private.ws.addEventListener('open', function () {
                log.debug('WebSocket connection made with:', url);
            });
            __private.ws.addEventListener('message', function (m) {
                const data = JSON.parse(m.data);
                //-- Apps receive the message if either it was sent to all sections or the specific section --//
                //-- of the app. Apps will not receive messages sent to other apps.                         --//
                if (data.appId === __private.appId && (!data.sectionId || data.sectionId === __private.sectionId)) {
                    if (Constants.Logging.TRACE) {
                        log.trace('Reading message:', JSON.stringify(data));
                    }
                    onMessage(data.message);
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
        this.send = function (message, appId) {
            //-- The identifier of the target application could be omitted if the message was sent to self. --//
            const targetAppId = (arguments.length > 1 && appId) ? appId : __private.appId;

            //-- We always wait for the socket to be ready before broadcast. The same code blocks messages  --//
            //-- when a socket is temporarily closed.                                                       --//
            new Promise(function (resolve) {
                const x = setInterval(function () {
                    if (__private.ws.readyState === WebSocket.OPEN) {
                        clearInterval(x);
                        resolve('socket open');
                    }
                }, Constants.SOCKET_READY_DELAY);
            }).then(function () {
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
    const setGeometry = function (__self, __private) {
        __self.geometry = {};
        const fetchSection = function (sectionId) {
            if (sectionId) {
                log.debug('Requesting details of section:', sectionId);
                fetch(getHostName(true) + '/sections/' + sectionId)
                    .then(function (r) { return r.text(); }).then(function (text) {
                        const section = JSON.parse(text);
                        __self.geometry.section = { w: section.w, h: section.h };
                        __self.state.name = OVE.Utils.getQueryParam('state',
                            (section.app && section.app.state) ? section.app.state : undefined);
                        //-- Always store section id as a string to avoid if-checks      --//
                        //-- failing on '0'                                              --//
                        if (section.id !== undefined) {
                            __private.sectionId = section.id.toString();
                            log.debug('Got details from section:', __private.sectionId);
                        }
                        //-- We wait for section information to be available before      --//
                        //-- announcing OVE loaded                                       --//
                        $(document).trigger(OVE.Event.LOADED);
                    });
            }
        };
        let id = OVE.Utils.getViewId();
        //-- oveViewId will not be provided by a controller --//
        if (!id) {
            let sectionId = OVE.Utils.getSectionId() || __private.proposedSectionId;
            if (!sectionId && sectionId !== 0) {
                log.warn('Section id not provided');
            }
            fetchSection(sectionId);
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
        if (!client && client !== 0) {
            log.warn('Client id not provided');
        }
        if (sectionId) {
            log.info('Running OVE for section:', sectionId, ', client:', client, ', space:', space);
        } else {
            log.info('Running OVE for client:', client, ', space:', space);
        }
        log.debug('OVE instance UUID:', __self.context.uuid);
        //-- call APIs /spaces or /spaces?oveSectionId={sectionId}  --//
        fetch(getHostName(true) + '/spaces' + (sectionId ? '?oveSectionId=' + sectionId : ''))
            .then(function (r) { return r.text(); }).then(function (text) {
                __self.geometry = (JSON.parse(text)[space] || [])[client] || {};
                fetchSection(sectionId);
            });
    };

    //-----------------------------------------------------------//
    //--            Shared State and Local Context             --//
    //-----------------------------------------------------------//
    const OVEState = function (__private) {
        //-- State can be cached/loaded at an app-level --//
        this.cache = function (url) {
            const endpoint = url || ('/instances/' + __private.sectionId + '/state');
            const currentState = JSON.stringify(this.current);
            log.debug('Sending request to URL:', endpoint, ', state:', currentState);
            $.ajax({ url: endpoint, type: 'POST', data: currentState, contentType: 'application/json' });

            //-- BACKWARDS-COMPATIBILITY: For <= v0.3.3 --//
            $.ajax({ url: ('/' + __private.sectionId + '/state'), type: 'POST', data: currentState, contentType: 'application/json' });
        };
        this.load = function (url) {
            let __self = this;
            return new Promise(function (resolve, reject) {
                const endpoint = url || ('/instances/' + __private.sectionId + '/state');
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

                //-- BACKWARDS-COMPATIBILITY: For <= v0.3.3 --//
                $.get(('/' + __private.sectionId + '/state')).done(onLoad);
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
        hostname: getHostName(true)
    };

    this.socket = new OVESocket(__private);
    this.frame = new OVEFrame(this, __private);
    this.state = new OVEState(__private);
    setGeometry(this, __private);
}

//-----------------------------------------------------------//
//--                   OVE Event Names                     --//
//-----------------------------------------------------------//
OVE.Event = {
    LOADED: 'ove.loaded'
};
