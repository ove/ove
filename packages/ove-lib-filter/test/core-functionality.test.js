/*
const path = global.path;
const fs = global.fs;
const request = global.request;
const express = global.express;
const mockHttp = global.mockHttp;
const HttpStatus = global.HttpStatus;
const srcDir = global.srcDir;
const index = global.index;
const dirs = global.dirs;
const Utils = global.Utils;
*/


// We always test against the distribution not the source.
const path = require('path');
const srcDir = path.join(__dirname, '..', 'lib');
const getPredicate = require(path.join(srcDir, 'filter')).getPredicate;
const parse = require(path.join(srcDir, 'parser')).parse;


// arithmetic operators



describe('The OVE filter library', () => {
    const OLD_CONSOLE = global.console;
    beforeAll(() => {
       // global.console = { log: jest.fn(x => x), warn: jest.fn(x => x), error: jest.fn(x => x) };
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
        // TODO: types
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
       // expect(predicate({ x: false, y: true })).toBe(false);
       // expect(predicate({ x: false, y: false })).toBe(false);
    });

    it('should correctly handle "or"', () => {
        const predicate = getPredicate(parse('x or y'));
        expect(predicate({ x: true, y: true })).toBe(true);
        expect(predicate({ x: true, y: false })).toBe(true);
        expect(predicate({ x: false, y: true })).toBe(true);
        // expect(predicate({ x: false, y: false })).toBe(false);

    });

    /*
    it('should correctly handle "not"', () => {
        const predicate = getPredicate(parse('not x'));
        expect(predicate({ x: true, y: true })).toBe(false);
        expect(predicate({ x: true, y: false })).toBe(false);
        expect(predicate({ x: false, y: true })).toBe(true);
        expect(predicate({ x: false, y: false })).toBe(true);

    });
*/


    // arithmetic
    // //     'add', 'sub', 'mul', 'div', 'mod'];


    afterAll(() => {
        global.console = OLD_CONSOLE;
    });
});


// TODO:
// - invalid operation name (e.g. > rather than gt)
// - mis-matched parens
