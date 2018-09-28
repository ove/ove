/*
 * ove.js v@VERSION
 * https://github.com/dsi-icl/ove
 *
 * Copyright (c) @AUTHOR
 * Released under @LICENSE License
 */
//-- IMPORTANT: all code comments must be in this format. --//
function OVE () {
    // @CONSTANTS

    //-- Hostname is detected using the URL at which the OVE.js script is loaded. It can be read --//
    //-- with or without the scheme (useful for opening WebSockets).                             --//
    var getHostName = function (withScheme) {
        var scripts = document.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; i++) {
            if (scripts[i].src.indexOf('ove.js') > 0) {
                return scripts[i].src.substr(
                    withScheme ? 0 : scripts[i].src.indexOf('//') + 2,
                    scripts[i].src.lastIndexOf('/') - (withScheme ? 0 : scripts[i].src.indexOf('//') + 2));
            }
        }
    };

    //-----------------------------------------------------------//
    //--                 Messaging Functions                   --//
    //-----------------------------------------------------------//
    var OVESocket = function (__private) {
        //-- Default onMessage handler does nothing --//
        var onMessage = function () { return 0; };

        //-- Socket init code --//
        var getSocket = function (url) {
            __private.ws = new WebSocket(url);
            __private.ws.addEventListener('error', console.error);
            __private.ws.addEventListener('open', function () {
                if (DEBUG) {
                    console.log('websocket connection made with ' + url);
                }
            });
            __private.ws.addEventListener('message', function (m) {
                var data = JSON.parse(m.data);
                if (DEBUG) {
                    //-- We want to print the time corresponding to the local timezone based on the locale  --//
                    console.log(JSON.stringify(Object.assign({ time: new Date().toLocaleString() }, data)));
                }
                //-- Apps receive the message if either it was sent to all sections or the specific section --//
                //-- of the app.                                                                            --//
                if (data.appId && (!data.sectionId || data.sectionId === __private.sectionId)) {
                    onMessage(data.appId, data.message);
                }
            });
            __private.ws.addEventListener('close', function () {
                if (DEBUG) {
                    console.warn('lost websocket connection attempting to reconnect');
                }
                //-- If the socket is closed, we try to refresh it. This fixes frozen pages after a restart --//
                setTimeout(function () { getSocket(url); }, Constants.SOCKET_REFRESH_DELAY);
            });
        };
        getSocket('ws://' + getHostName(false) + '/');

        //-- SDK functions --//
        this.on = function (func) {
            onMessage = func;
        };
        this.send = function (appId, message) {
            //-- We always wait for the socket to be ready before broadcast. The same code blocks messages  --//
            //-- when a socket is temporarily closed.                                                       --//
            new Promise(function (resolve) {
                var x = setInterval(function () {
                    if (__private.ws.readyState === WebSocket.OPEN) {
                        clearInterval(x);
                        resolve('socket open');
                    }
                }, Constants.SOCKET_READY_DELAY);
            }).then(function () {
                //-- The same code works for the OVE core viewer (which has no sectionId) and OVE core apps --//
                if (__private.sectionId) {
                    __private.ws.send(JSON.stringify({ appId: appId, sectionId: __private.sectionId, message: message }));
                } else {
                    __private.ws.send(JSON.stringify({ appId: appId, message: message }));
                }
            });
        };
    };

    //-----------------------------------------------------------//
    //--                   Layout Variables                    --//
    //-----------------------------------------------------------//
    var setLayout = function (__self, __private) {
        __self.layout = {};
        var fetchSection = function (sectionId) {
            if (sectionId) {
                if (DEBUG) {
                    console.log('requesting details of section: ' + sectionId);
                }
                fetch(getHostName(true) + '/section/' + sectionId)
                    .then(function (r) { return r.text(); }).then(function (text) {
                        var section = JSON.parse(text);
                        __self.layout.section = { w: section.w, h: section.h };
                        __self.state.name = OVE.Utils.getQueryParam('state', section.state);
                        __private.sectionId = section.id;
                        if (DEBUG) {
                            console.log('got details from section: ' + section.id);
                        }
                        //-- We wait for section information to be available before announcing OVE loaded   --//
                        $(document).trigger(OVE.Event.LOADED);
                    });
            }
        };
        var id = OVE.Utils.getQueryParam('oveClientId');
        //-- clientId will not be provided by a controller --//
        if (!id) {
            fetchSection(OVE.Utils.getQueryParam('oveSectionId'));
            return;
        }
        var sectionId = id.substr(id.lastIndexOf('.') + 1);
        id = id.substr(0, id.lastIndexOf('.'));
        if (!id && sectionId) {
            //-- sectionId has not been provided as a part of oveClientId  --//
            //-- oveClientId has the format "{space}-{client}.{sectionId}" --//
            //-- the ".{sectionId}" portion is optional and can be omitted --//
            id = sectionId;
            sectionId = OVE.Utils.getQueryParam('oveSectionId');
        }
        var client = id.substr(id.lastIndexOf('-') + 1);
        var space = id.substr(0, id.lastIndexOf('-'));

        //-- call APIs /clients or /client/{sectionId}  --//
        fetch(getHostName(true) + '/client' + (sectionId ? '/' + sectionId : 's'))
            .then(function (r) { return r.text(); }).then(function (text) {
                __self.layout = (JSON.parse(text)[space] || [])[client] || {};
                fetchSection(sectionId);
            });
    };

    //-----------------------------------------------------------//
    //--            Shared State and Local Context             --//
    //-----------------------------------------------------------//
    var OVEState = function (__private) {
        //-- State can be cached/loaded at an app-level --//
        this.cache = function (url) {
            $.ajax({ url: url || (__private.sectionId + '/state'), type: 'POST', data: JSON.stringify(this.current), contentType: 'application/json' });
        };
        this.load = function (url) {
            var __self = this;
            return new Promise(function (resolve) {
                $.get(url || (__private.sectionId + '/state')).done(function (state) {
                    if (state) {
                        __self.current = state;
                    }
                    resolve('state loaded');
                });
            });
        };
        this.current = {};
        this.name = undefined;
    };

    this.context = {
        //-- A version 4 UUID is available for each OVE instance. This to support intra/inter-app --//
        //-- messaging and debugging.                                                             --//
        uuid: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0;
            var v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        })
    };

    //-- holds private data within OVE library --//
    var __private = {};
    this.socket = new OVESocket(__private);
    this.state = new OVEState(__private);
    setLayout(this, __private);
}

//-----------------------------------------------------------//
//--                   OVE Event Names                     --//
//-----------------------------------------------------------//
OVE.Event = {
    LOADED: 'ove.loaded'
};
