const Constants = { };

Constants.Evaluation = {
    PROPERTY: 'property',
    LITERAL: 'literal',
    FUNCTION_CALL: 'functionCall'.toLowerCase(),
    EQUALS: 'eq',
    NOT_EQUALS: 'ne',
    LESS_THAN: 'lt',
    GREATER_THAN: 'gt',
    LESS_THAN_OR_EQUALS: 'le',
    GREATER_THAN_OR_EQUALS: 'ge',
    AND: 'and',
    OR: 'or',
    ADD: 'add',
    SUBTRACT: 'sub',
    MULTIPLY: 'mul',
    DIVIDE: 'div',
    MODULO: 'mod',

    // The OData specification requires lower-case function names.
    Function: {
        SUBSTRING: 'substring',
        SUBSTRING_OF: 'substringOf'.toLowerCase(),
        ENDS_WITH: 'endsWith'.toLowerCase(),
        STARTS_WITH: 'startsWith'.toLowerCase(),
        LENGTH: 'length',
        INDEX_OF: 'indexOf'.toLowerCase(),
        REPLACE: 'replace',
        TO_LOWER: 'toLower'.toLowerCase(),
        TO_UPPER: 'toUpper'.toLowerCase(),
        TRIM: 'trim',
        CONCAT: 'concat'
    }
};

exports.Constants = Constants;
