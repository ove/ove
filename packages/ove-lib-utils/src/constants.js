/**************************************************************
                  OVE System-wide Constants
**************************************************************/
const Constants = {
    /**************************************************************
                        Web Content Constants
    **************************************************************/
    HTTP_HEADER_CONTENT_TYPE: 'Content-Type',
    HTTP_CONTENT_TYPE_JSON: 'application/json',
    HTTP_CONTENT_TYPE_JS: 'application/javascript',
    HTTP_CONTENT_TYPE_CSS: 'text/css',

    /**************************************************************
                          Logging Constants
    **************************************************************/
    LOG_UNKNOWN_APP_ID: '__UNKNOWN__',
    LOG_APP_ID_WIDTH: 16,
    LOG_LEVEL: +(process.env.LOG_LEVEL || 5), // Level (from 0 - 6): 5 == TRACE

    /**************************************************************
                           Other Constants
    **************************************************************/
    SWAGGER_API_DOCS_CONTEXT: '/api-docs',
    UTF8: 'utf8'

};

/**************************************************************
                     Regular Expressions
**************************************************************/
Constants.RegExp = {
    OVE_TYPE: /__OVETYPE__/g,
    OVE_HOST: /__OVEHOST__/g,
    ES5_COMMENT_PATTERN: /\/\/--(.*?)--\/\//g // Pattern: //-- {comment} --//
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

Constants.RegExp.Annotation = {
    NAME: /@NAME/g,
    VERSION: /@VERSION/g,
    LICENSE: /@LICENSE/g,
    AUTHOR: /@AUTHOR/g
};

Constants.Frame = {
    PEER: 'peer',
    CHILD: 'child'
};

/**************************************************************
                        Logging Levels
**************************************************************/
// Definition of log-levels for the use of utils.
Constants.LogLevel = [
    {
        name: 'FATAL',
        consoleLogger: 'error',
        label: { bgColor: '#FF0000', color: '#FFFFFF' }
    },
    {
        name: 'ERROR',
        consoleLogger: 'error',
        label: { bgColor: '#B22222', color: '#FFFAF0' }
    },
    {
        name: 'WARN',
        consoleLogger: 'warn',
        label: { bgColor: '#DAA520', color: '#FFFFF0' }
    },
    {
        name: 'INFO',
        consoleLogger: 'log',
        label: { bgColor: '#2E8B57', color: '#FFFAFA' }
    },
    {
        name: 'DEBUG',
        consoleLogger: 'log',
        label: { bgColor: '#1E90FF', color: '#F8F8FF' }
    },
    {
        name: 'TRACE',
        consoleLogger: 'log',
        label: { bgColor: '#808080', color: '#FFFAF0' }
    }
];

// Constants to be used by applications to determine whether a specific log-level is enabled.
Constants.Logging = (function () {
    const levels = {};
    Constants.LogLevel.forEach(function (level, i) {
        levels[level.name] = Constants.LOG_LEVEL >= i;
    });
    // Special log-level for trace logging on the server (because this may generate massive log files on disk).
    levels.TRACE_SERVER = Constants.LOG_LEVEL >= 6;
    return levels;
})();

exports.Constants = Constants;
