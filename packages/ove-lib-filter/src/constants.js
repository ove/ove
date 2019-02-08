const Constants = { };

Constants.Parsing = {
    UNARY_POSTFIX_OPERATORS: [],
    UNARY_PREFIX_OPERATORS: ['not'],
    BINARY_OPERATORS_LEFT_ASSOCIATIVE: ['eq', 'ne', 'gt', 'ge', 'lt', 'le',
        'and', 'or',
        'add', 'sub', 'mul', 'div', 'mod'],
    BINARY_OPERATORS_RIGHT_ASSOCIATIVE: [],

    UNARY_FUNCTIONS: ['length', 'toupper', 'tolower', 'trim', // String functions
        'day', 'hour', 'minute', 'month', 'second', 'year', // Date functions
        'round', 'floor', 'ceiling' // math functions
    ],
    BINARY_FUNCTIONS: ['substringof', 'endswith', 'startswith', 'indexof', 'concat', 'isOf', 'substring_binary'],
    TERNARY_FUNCTIONS: ['replace', 'substring'],
    FUNCTION_ARGUMENT_SEPARATOR: ','
};

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
    NOT: 'not',
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
        CONCAT: 'concat',
        ROUND: 'round',
        FLOOR: 'floor',
        CEILING: 'ceiling'
    }
};

exports.Constants = Constants;
