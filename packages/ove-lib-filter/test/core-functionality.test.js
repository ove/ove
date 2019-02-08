// We always test against the distribution not the source.
const path = require('path');
const srcDir = path.join(__dirname, '..', 'lib');

// Include dependencies via index, rather than directly, so that index gets 100% test coverage (rather than 0%)
const filterLib = require(path.join(srcDir, 'index'));
const getPredicate = filterLib.getPredicate;
const parse = filterLib.parse;

describe('The OVE filter library - logical operations', () => {
    const OLD_CONSOLE = global.console;
    beforeAll(() => {
        global.console = { log: jest.fn(x => x), warn: jest.fn(x => x), error: jest.fn(x => x) };
    });

    // Inequalities and equalities
    it('should correctly handle "gt" (>)', () => {
        const predicate = getPredicate(parse('x gt 5'));
        expect(predicate({ x: '1' })).toBe(false);
        expect(predicate({ x: '5' })).toBe(false);
        expect(predicate({ x: '10' })).toBe(true);
    });

    it('should correctly handle "ge" (>=)', () => {
        const predicate = getPredicate(parse('x ge 5'));
        expect(predicate({ x: '1' })).toBe(false);
        expect(predicate({ x: '5' })).toBe(true);
        expect(predicate({ x: '10' })).toBe(true);
    });

    it('should correctly handle "lt" (<)', () => {
        const predicate = getPredicate(parse('x lt 5'));
        expect(predicate({ x: '1' })).toBe(true);
        expect(predicate({ x: '5' })).toBe(false);
        expect(predicate({ x: '10' })).toBe(false);
    });

    it('should correctly handle "le" (<=)', () => {
        const predicate = getPredicate(parse('x le 5'));
        expect(predicate({ x: '1' })).toBe(true);
        expect(predicate({ x: '5' })).toBe(true);
        expect(predicate({ x: '10' })).toBe(false);
    });

    it('should correctly handle "eq" (=)', () => {
        const predicate = getPredicate(parse('x eq 5'));
        expect(predicate({ x: '1' })).toBe(false);
        expect(predicate({ x: '5' })).toBe(true);
        expect(predicate({ x: '10' })).toBe(false);
    });

    it('should correctly handle "ne" (!=)', () => {
        const predicate = getPredicate(parse('x ne 5'));
        expect(predicate({ x: '1' })).toBe(true);
        expect(predicate({ x: '5' })).toBe(false);
        expect(predicate({ x: '10' })).toBe(true);
    });

    // Logical operators
    it('should correctly handle "and"', () => {
        const predicate = getPredicate(parse('x and y'));
        expect(predicate({ x: true, y: true })).toBe(true);
        expect(predicate({ x: true, y: false })).toBe(false);
        expect(predicate({ x: false, y: true })).toBe(false);
        expect(predicate({ x: false, y: false })).toBe(false);
    });

    it('should correctly handle "or"', () => {
        const predicate = getPredicate(parse('x or y'));
        expect(predicate({ x: true, y: true })).toBe(true);
        expect(predicate({ x: true, y: false })).toBe(true);
        expect(predicate({ x: false, y: true })).toBe(true);
        expect(predicate({ x: false, y: false })).toBe(false);
    });

    it('should correctly handle "not"', () => {
        const predicate = getPredicate(parse('not x'));
        expect(predicate({ x: true, y: true })).toBe(false);
        expect(predicate({ x: true, y: false })).toBe(false);
        expect(predicate({ x: false, y: true })).toBe(true);
        expect(predicate({ x: false, y: false })).toBe(true);
    });

    afterAll(() => {
        global.console = OLD_CONSOLE;
    });
});

describe('The OVE filter library - arithmetic operations', () => {
    const OLD_CONSOLE = global.console;
    beforeAll(() => {
        // global.console = { log: jest.fn(x => x), warn: jest.fn(x => x), error: jest.fn(x => x) };
    });

    it('should correctly handle "add" (+)', () => {
        const predicate = getPredicate(parse('(x add 1) eq 5'));
        expect(predicate({ x: '5' })).toBe(false);
        expect(predicate({ x: '4' })).toBe(true);
    });

    it('should correctly handle "sub" (-)', () => {
        const predicate = getPredicate(parse('(x sub 1) eq 5'));
        expect(predicate({ x: '5' })).toBe(false);
        expect(predicate({ x: '6' })).toBe(true);
    });

    it('should correctly handle "mul" (*)', () => {
        const predicate = getPredicate(parse('(x mul 2) eq 6'));
        expect(predicate({ x: '3' })).toBe(true);
        expect(predicate({ x: '6' })).toBe(false);
    });

    it('should correctly handle "div" (/)', () => {
        const predicate = getPredicate(parse('(x div 2) eq 5'));
        expect(predicate({ x: '5' })).toBe(false);
        expect(predicate({ x: '10' })).toBe(true);
    });

    it('should correctly handle "mod" (%)', () => {
        const predicate = getPredicate(parse('(x mod 3) eq y'));
        expect(predicate({ x: '0', y: '0' })).toBe(true);
        expect(predicate({ x: '1', y: '1' })).toBe(true);
        expect(predicate({ x: '2', y: '2' })).toBe(true);
        expect(predicate({ x: '3', y: '0' })).toBe(true);
        expect(predicate({ x: '4', y: '1' })).toBe(true);
    });

    afterAll(() => {
        global.console = OLD_CONSOLE;
    });
});

describe('The OVE filter library - string functions', () => {
    const OLD_CONSOLE = global.console;
    beforeAll(() => {
        // global.console = { log: jest.fn(x => x), warn: jest.fn(x => x), error: jest.fn(x => x) };
    });

    it('should correctly handle "substringof()"', () => {
        const predicate = getPredicate(parse('substringof(\'Alfreds\', CompanyName)'));
        expect(predicate({ CompanyName: 'AlfredsCar' })).toBe(true);
        expect(predicate({ CompanyName: 'AlfredCar' })).toBe(false);
    });

    it('should correctly handle "endswith()"', () => {
        const predicate = getPredicate(parse('endswith(x, \'def\')'));
        expect(predicate({ x: 'abcdef' })).toBe(true);
        expect(predicate({ x: 'abcdeg' })).toBe(false);
    });

    it('should correctly handle "startswith()"', () => {
        const predicate = getPredicate(parse('startswith(x, \'abc\')'));
        expect(predicate({ x: 'abcdef' })).toBe(true);
        expect(predicate({ x: 'ghijkl' })).toBe(false);
    });

    it('should correctly handle "length()"', () => {
        const predicate = getPredicate(parse('length(x) eq 3'));
        expect(predicate({ x: 'abc' })).toBe(true);
        expect(predicate({ x: 'abcd' })).toBe(false);
    });

    it('should correctly handle "indexof()"', () => {
        const predicate = getPredicate(parse('indexof(str, \'abc\') eq pos'));
        expect(predicate({ str: 'abc', pos: 0 })).toBe(true);
        expect(predicate({ str: 'abc', pos: 1 })).toBe(false);

        expect(predicate({ str: '.abcd', pos: 1 })).toBe(true);
    });

    it('should correctly handle "replace()"', () => {
        const predicate = getPredicate(parse('replace(str, old, replacement) eq new'));
        expect(predicate({ str: 'car', old: 'ar', replacement: 'ell', new: 'cell' })).toBe(true);
        expect(predicate({ str: 'car', old: 'ar', replacement: 'ell', new: 'car' })).toBe(false);
        expect(predicate({ str: 'car', old: 'c', replacement: 'b', new: 'bar' })).toBe(true);
    });

    it('should correctly handle "substring()"', () => {
        const predicate = getPredicate(parse('substring(str, pos) eq res'));
        expect(predicate({ str: 'abcde', pos: 0, res: 'abcde' })).toBe(true);
        expect(predicate({ str: 'abcde', pos: 1, res: 'bcde' })).toBe(true);
    });

    it('should correctly handle "substring()" with specified length', () => {
        const predicate = getPredicate(parse('substring(str, pos, len) eq res'));
        expect(predicate({ str: 'abcde', pos: 0, len: 5, res: 'abcde' })).toBe(true);
        expect(predicate({ str: 'abcde', pos: 1, len: 3, res: 'bcd' })).toBe(true);
    });

    it('should correctly handle "tolower()', () => {
        const predicate = getPredicate(parse('tolower(str) eq res'));
        expect(predicate({ str: 'AbCd!1', res: 'abcd!1' })).toBe(true);
        expect(predicate({ str: 'AbCd!1', res: 'abcddd' })).toBe(false);
    });

    it('should correctly handle "toupper()', () => {
        const predicate = getPredicate(parse('toupper(str) eq res'));
        expect(predicate({ str: 'AbCd!1', res: 'ABCD!1' })).toBe(true);
        expect(predicate({ str: 'AbCd!1', res: 'abcddd' })).toBe(false);
    });

    it('should correctly handle "trim()', () => {
        const predicate = getPredicate(parse('trim(str) eq res'));
        expect(predicate({ str: 'abcd ', res: 'abcd' })).toBe(true);
        expect(predicate({ str: 'abcd ', res: 'abcd ' })).toBe(false);
    });

    it('should correctly handle "concat()', () => {
        const predicate = getPredicate(parse('concat(str1, str2) eq res'));
        expect(predicate({ str1: 'abcd', str2: 'efg', res: 'abcdefg' })).toBe(true);
        expect(predicate({ str1: 'abcd', str2: 'efg', res: 'abcd' })).toBe(false);
    });

    afterAll(() => {
        global.console = OLD_CONSOLE;
    });
});

describe('The OVE filter library - math functions', () => {
    const OLD_CONSOLE = global.console;
    beforeAll(() => {
        // global.console = { log: jest.fn(x => x), warn: jest.fn(x => x), error: jest.fn(x => x) };
    });

    it('should correctly handle "round()"', () => {
        const predicate = getPredicate(parse('round(x) eq y'));
        expect(predicate({ x: 0.7, y: 1.0 })).toBe(true);
        expect(predicate({ x: 1.2, y: 1.0 })).toBe(true);
        expect(predicate({ x: 1.6, y: 2.0 })).toBe(true);
    });

    it('should correctly handle "floor()"', () => {
        const predicate = getPredicate(parse('floor(x) eq y'));
        expect(predicate({ x: 0.7, y: 0.0 })).toBe(true);
        expect(predicate({ x: 1.2, y: 1.0 })).toBe(true);
        expect(predicate({ x: 1.6, y: 1.0 })).toBe(true);
    });

    it('should correctly handle "ceiling()"', () => {
        const predicate = getPredicate(parse('ceiling(x) eq y'));
        expect(predicate({ x: 0.7, y: 1.0 })).toBe(true);
        expect(predicate({ x: 1.2, y: 2.0 })).toBe(true);
        expect(predicate({ x: 1.6, y: 2.0 })).toBe(true);
    });

    afterAll(() => {
        global.console = OLD_CONSOLE;
    });
});

describe('The OVE filter library - handling errors', () => {
    const OLD_CONSOLE = global.console;
    beforeAll(() => {
        global.console = { log: jest.fn(x => x), warn: jest.fn(x => x), error: jest.fn(x => x) };
    });

    it('test invalid functions throw errors', () => {
        const predicate = getPredicate({
            type: 'eq',
            left: { type: 'functioncall', func: 'NOT_A_REAL_FUNCTION', args: [{ type: 'property', name: 'x' }] },
            'right': { type: 'property', name: 'y' }
        });
        expect(() => predicate({ x: 0.7, y: 0.0 })).toThrow();
    });

    it('test invalid type throw errors', () => {
        const predicate = getPredicate({
            type: 'eq',
            left: { type: 'functioncall', func: 'ceiling', args: [{ type: 'NOT_A_REAL_PROPRTY', name: 'x' }] },
            'right': { type: 'property', name: 'y' }
        });
        expect(() => predicate({ x: 0.7, y: 0.0 })).toThrow();
    });

    it('should correctly fetch attributes', () => {
        const predicate = getPredicate(parse('x gt 5'));
        expect(predicate({attributes: { x: 10, y: 1 } })).toBe(true);
    });

    it('should correctly fetch nested attributes', () => {
        const predicate = getPredicate(parse('x.y gt 5'));
        expect(predicate({attributes: { x: {y: 10 }, y: 1 } })).toBe(true);
    });

    it('should correctly fetch nested values', () => {
        const predicate = getPredicate(parse('x.y gt 5'));
        expect(predicate({ x: { y: 10 }, y: 1 })).toBe(true);
    });

    it('should return false if property is undefined', () => {
        const predicate = getPredicate(parse('x gt 5'));
        expect(predicate({ y: 5 })).toBe(false);
    });

    it('should return false if nested property is undefined', () => {
        const predicate = getPredicate(parse('x.y gt 5'));
        expect(predicate({ x: 1 })).toBe(false);
    });

    it('should return false if parent property is undefined ', () => {
        const predicate = getPredicate(parse('x.y gt 5'));
        expect(predicate({ y: 5  })).toBe(false);
    });


    it('should handle missing 1st argument', () => {
        const predicate = getPredicate(parse('replace(str, old, replacement)'));
        expect(predicate({ str: 'car', old: 'ar', replacement: 'ell', new: 'cell' })).toBe('cell');
        expect(predicate({ old: 'ar', replacement: 'ell', new: 'cell' })).toBe(undefined);
    });

    it('should handle missing 2nd argument', () => {
        const predicate = getPredicate(parse('replace(str, old, replacement)'));
        expect(predicate({ str: 'car', old: 'ar', replacement: 'ell', new: 'cell' })).toBe('cell');
        expect(predicate({ str: 'car', replacement: 'ell', new: 'cell' })).toBe(undefined);
    });

    it('should handle missing 3rd argument', () => {
        const predicate = getPredicate(parse('replace(str, old, replacement)'));
        expect(predicate({ str: 'car', old: 'ar', replacement: 'ell', new: 'cell' })).toBe('cell');
        expect(predicate({ str: 'car', old: 'ar', new: 'cell' })).toBe(undefined);
    });



    afterAll(() => {
        global.console = OLD_CONSOLE;
    });
});

// TODO:
// - mis-matched parens
//         const predicate = getPredicate(parse('endswith(x, \'def\''));
