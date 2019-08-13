//-- IMPORTANT: all code comments must be in this format. --//

const Constants = {
    //-----------------------------------------------------------//
    //--                        Viewer                         --//
    //-----------------------------------------------------------//
    SECTION_FRAME_ID: '#content-frame-section-',
    BROWSER_RESIZE_WAIT: 5000,
    BROWSER_IDLE_WAIT: 15000,

    //-----------------------------------------------------------//
    //--                        Server                         --//
    //-----------------------------------------------------------//
    SPACES_JSON_FILENAME: 'Spaces.json',
    WEBSOCKET_READY: 1,
    SECTION_UPDATE_DELAY: 150, //-- Unit: milliseconds --//
    CLOCK_RE_SYNC_DURATION: 3600000, //-- Unit: milliseconds --//

    //-----------------------------------------------------------//
    //--                        Common                         --//
    //-----------------------------------------------------------//
    SOCKET_REFRESH_DELAY: 5000, //-- Unit: milliseconds --//
    SOCKET_READY_DELAY: 100, //-- Unit: milliseconds --//
    CLOCK_SYNC_ATTEMPTS: 5,
    CLOCK_SYNC_INTERVAL: 120000, //-- Unit: milliseconds --//
    APP_NAME: 'core'
};

//-----------------------------------------------------------//
//--                         Enums                         --//
//-----------------------------------------------------------//
Constants.Operation = {
    REFRESH: 'refresh'
};

exports.Constants = Constants;
