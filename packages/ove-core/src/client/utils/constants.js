//-- IMPORTANT: all code comments must be in this format. --//

//-----------------------------------------------------------//
//--                     Event Names                       --//
//-----------------------------------------------------------//
OVE.Event = {};
OVE.Event.LOADED = 'ove.loaded';

var Constants = {
    /**************************************************************
                                Viewer
    **************************************************************/
    SECTION_FRAME_ID: '#content-frame-section-',

    /**************************************************************
                                 Back-end
    **************************************************************/
    CLIENTS_JSON_FILENAME: 'Clients.json',
    HTTP_HEADER_CONTENT_TYPE: 'Content-Type',
    HTTP_CONTENT_TYPE_JSON: 'application/json',
    HTTP_CONTENT_TYPE_JS: 'application/javascript',
    HTTP_CONTENT_TYPE_CSS: 'text/css',
    WEBSOCKET_READY: 1,
    SECTION_UPDATE_DELAY: 150, // Unit: milliseconds

    /**************************************************************
                                 Common
    **************************************************************/
    SOCKET_REFRESH_DELAY: 5000, // Unit: milliseconds
    SOCKET_READY_DELAY: 100, // Unit: milliseconds
    APP_NAME: 'core'
};

/**************************************************************
                            Enums
**************************************************************/
Constants.Action = {
    CREATE: 'create',
    READ: 'read',
    UPDATE: 'update',
    DELETE: 'delete'
};

exports.Constants = Constants;
