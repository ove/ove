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

Constants.Logging = {
    // Enabling TRACE on the server will rapidly fill-up disk-space
    TRACE_SERVER: (process && process.env && process.env.TRACE_SERVER) || false,
    // Enabling TRACE on the browser will crowd the logs and may also have a slight impact performance
    TRACE_BROWSER: (process && process.env && process.env.TRACE_BROWSER) || false,
    // Enabling DEBUG on the server/browser will increase log volume (not recommended for production systems)
    DEBUG: (process && process.env && (process.env.DEBUG ||
        process.env.TRACE_SERVER || process.env.TRACE_SERVER)) || true,

    INFO: (process && process.env && (process.env.INFO || process.env.DEBUG ||
        process.env.TRACE_SERVER || process.env.TRACE_SERVER)) || true,
    WARN: (process && process.env && (process.env.WARN || process.env.INFO || process.env.DEBUG ||
        process.env.TRACE_SERVER || process.env.TRACE_SERVER)) || true,
    ERROR: (process && process.env && (process.env.ERROR ||
        process.env.WARN || process.env.INFO || process.env.DEBUG ||
        process.env.TRACE_SERVER || process.env.TRACE_SERVER)) || true
};

Constants.RegExp.Annotation = {
    NAME: /@NAME/g,
    VERSION: /@VERSION/g,
    LICENSE: /@LICENSE/g,
    AUTHOR: /@AUTHOR/g
};

exports.Constants = Constants;
