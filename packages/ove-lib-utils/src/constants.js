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
    DEBUG: /__DEBUG__/g,
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

exports.Constants = Constants;
