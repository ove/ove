// BNF grammar https://docs.oasis-open.org/odata/odata/v4.01/cs01/abnf/odata-abnf-construction-rules.txt
// Note that there is mandatory whitespace around operators, and that the subtraction operator is 'sub', so there is not ambiguity about whether '-' is a unary or binary operator

// Semantics: https://docs.oasis-open.org/odata/odata/v4.01/cs01/part2-url-conventions/odata-v4.01-cs01-part2-url-conventions.html#_Toc505773218

const { Constants } = require('./constants');
let C = Constants.Parsing;

C.UNARY_OPERATORS = C.UNARY_PREFIX_OPERATORS.concat(C.UNARY_POSTFIX_OPERATORS);
C.BINARY_OPERATORS = C.BINARY_OPERATORS_LEFT_ASSOCIATIVE.concat(C.BINARY_OPERATORS_RIGHT_ASSOCIATIVE); // make manually ordered to set precedence: earlier is higher precedence
C.OPERATORS = C.BINARY_OPERATORS.concat(C.UNARY_OPERATORS);

C.FUNCTIONS = C.UNARY_FUNCTIONS.concat(C.BINARY_FUNCTIONS).concat(C.TERNARY_FUNCTIONS);

C.ALL_OPERATIONS = C.FUNCTIONS.concat(C.OPERATORS);

function constructAST (tokens) {
    // This uses the standard postfix evaluation algorithm
    let stack = [];
    let token;

    let args, result;
    for (let i = 0; i < tokens.length; i++) {
        token = tokens[i];

        // operators is any operator or function
        if (C.ALL_OPERATIONS.includes(token)) {
            args = [stack.pop()];

            if (C.BINARY_OPERATORS.includes(token) || C.BINARY_FUNCTIONS.includes(token)) {
                args.push(stack.pop());
            }

            if (C.TERNARY_FUNCTIONS.includes(token) || C.TERNARY_FUNCTIONS.includes(token)) {
                args.push(stack.pop());
                args.push(stack.pop());
            }

            if (token === 'substring_binary') { token = 'substring'; }

            result = evaluate(token, args);
            stack.push(result);
            // console.log('Pushed to stack to get:', JSON.stringify(stack));
        } else {
            stack.push(((typeof token) === 'object' ? token.value : token));
        }
    }
    result = stack.pop();

    return result;
}

function evaluate (operation, args) {
    // console.log('Evaluating ' + JSON.stringify(operation) + ' with ' + JSON.stringify(args));
    args = args.map(n => evaluateLeafNode(n));

    args.map(d => ((typeof d) === 'object' ? d.value : d));

    if (C.FUNCTIONS.includes(operation)) {
        return {
            type: 'functioncall',
            func: operation,
            'args': args.reverse()
        };
    }

    if (args.length === 1) {
        return {
            type: operation,
            left: args[0]
        };
    } else {
        return {
            type: operation,
            left: args[1],
            right: args[0]
        };
    }
}

function evaluateLeafNode (node) {
    if (typeof node !== 'string') {
        return node;
    }
    if (isNaN(node) && node[0] !== "'" && node[0] !== '"') {
        node = { type: 'property', name: node };
    } else {
        if (node[0] === "'" || node[0] === '"') {
            node = node.substring(1);
        }
        if (node[node.length - 1] === "'" || node[node.length - 1] === '"') {
            node = node.substring(0, node.length - 1);
        }

        node = { type: 'literal', value: node };
    }

    return node;
}

function parse (expr) {
    const tokens = tokenize(expr);
    // console.log('Tokens: ' + tokens);

    const rpnTokens = convertTokensToRPN(tokens);
    // console.log('RPN Tokens: ' + rpnTokens);

    return constructAST(rpnTokens);
}

function convertTokensToRPN (tokens) {
    // Use the shunting-yard algorithm to convert (an array of tokens in) infix notation to (an array of tokens in) RPN

    let output = [];
    let stack = [];

    // Process the stream of tokens
    let numArguments = 0;

    for (let i = 0; i < tokens.length; i++) {
        // Look ahead to next token to distinguish between functions and variables with the same name
        let followedByParen = (tokens.length > (i + 1) && tokens[i + 1] === '(');

        if (C.UNARY_POSTFIX_OPERATORS.includes(tokens[i])) {
            output.push(tokens[i]);
        } else if (C.UNARY_PREFIX_OPERATORS.includes(tokens[i])) {
            stack.push(tokens[i]);
        } else if (C.FUNCTIONS.includes(tokens[i]) && followedByParen) {
            // console.log('function');
            numArguments = 1;
            stack.push(tokens[i]);
        } else if (tokens[i] === C.FUNCTION_ARGUMENT_SEPARATOR) {
            numArguments++;
            while (stack.length > 0 && stack[stack.length - 1] !== '(') {
                output.push(stack.pop());
            }
        } else if (C.BINARY_OPERATORS.includes(tokens[i])) {
            // If A is left-associative, while there is an operator B of higher or equal precedence than A at the top of the stack, pop B off the stack and append it to the output.
            if (C.BINARY_OPERATORS_LEFT_ASSOCIATIVE.includes(tokens[i])) {
                while (stack.length > 0 && C.BINARY_OPERATORS.includes(stack[stack.length - 1]) && (C.BINARY_OPERATORS.indexOf(stack[stack.length - 1]) <= C.BINARY_OPERATORS.indexOf(tokens[i]))) {
                    output.push(stack.pop());
                }
            }

            // If A is right-associative, while there is an operator B of higher precedence than A at the top of the stack, pop B off the stack and append it to the output.
            if (C.BINARY_OPERATORS_RIGHT_ASSOCIATIVE.includes(tokens[i])) {
                while (stack.length > 0 && C.BINARY_OPERATORS.includes(stack[stack.length - 1]) && (C.BINARY_OPERATORS.indexOf(stack[stack.length - 1]) < C.BINARY_OPERATORS.indexOf(tokens[i]))) {
                    output.push(stack.pop());
                }
            }

            // Push A onto the stack.
            stack.push(tokens[i]);
        } else if (tokens[i] === '(') {
            stack.push('(');
        } else if (tokens[i] === ')') {
            while (stack.length > 0 && stack[stack.length - 1] !== '(') {
                output.push(stack.pop());
            }

            stack.pop(); // pop off the bracket

            let functionName = stack[stack.length - 1];
            if (functionName === 'substring' && numArguments === 2) {
                // There are two substring functions: one with 2 arguments, and one with 3
                // This renames the function with two arguments, to help the evaluate() function
                output.push('substring_binary');
                stack.pop();
            } else if (C.FUNCTIONS.includes(functionName)) {
                output.push(stack.pop());
            }
        } else {
            // token is an operand

            // console.log("THIS is an operand");
            output.push({ type: 'operand', value: tokens[i] });
        }

        // console.log("\n");
        // console.log("After token: " + tokens[i])
        // console.log("Stack: " + stack.join(" "));
        // console.log("Output: " + output.join(" "))
    }

    // Deal with any remaining tokens
    // console.log("About to do final iteration")
    while (stack.length > 0) {
        output.push(stack.pop());
    }

    // console.log(tokens);
    // console.log(output);

    return output;
}

function tokenize (expr) {
    const delimiters = [',', '(', ')'];
    let newToken = '';
    let tokens = [];

    for (let i = 0; i < expr.length; i++) {
        if (delimiters.includes(expr[i])) {
            if (newToken) {
                tokens.push(newToken);
            }

            newToken = '';

            tokens.push(expr[i]);
        } else if (expr[i] === ' ') {
            if (newToken) {
                tokens.push(newToken);
            }

            newToken = '';
        } else {
            newToken = newToken + expr[i];
        }
    }

    if (newToken) {
        tokens.push(newToken);
    }

    return tokens;
}

exports.parse = parse;
