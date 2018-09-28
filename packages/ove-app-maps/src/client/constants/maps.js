const Constants = {
    /**************************************************************
                              Controller
    **************************************************************/
    DEFAULT_STATE_NAME: 'London',
    OL_MONITORED_EVENTS: ['change:resolution', 'change:zoom', 'change:center'],

    /**************************************************************
                                Common
    **************************************************************/
    OL_ZOOM_ANIMATION_DURATION: 0, // Unit: milliseconds. 0 means no animation.
    OL_LOAD_WAIT_TIME: 3000, // Unit: milliseconds
    BING_MAPS_RELOAD_INTERVAL: 1000, // Unit: milliseconds
    APP_NAME: 'maps'
};

exports.Constants = Constants;
