const app = global.app;
const srcDir = global.srcDir;
const index = global.index;
const dirs = global.dirs;

// Tests on constants.
describe('The OVE Utils library', () => {
    const OLD_CONSOLE = global.console;
    beforeAll(() => {
        global.console = { log: jest.fn(x => x), warn: jest.fn(x => x), error: jest.fn(x => x) };
    });

    // The utilities carefully controls which constants are available for which
    // application/service. This allows multiple applications to reuse the
    // names of the constants without having naming conflicts. There are a
    // number of tests to validate this functionality.
    it('should export constants for any function', () => {
        const ConstantsA = index('core', app, dirs).Constants;
        expect(Object.keys(ConstantsA)).toContain('SWAGGER_API_DOCS_CONTEXT');
        const ConstantsB = index('foo', app, dirs).Constants;
        expect(Object.keys(ConstantsB)).toContain('SWAGGER_API_DOCS_CONTEXT');
    });

    it('should not require dirs to export constants for any function', () => {
        const ConstantsA = index('core', app).Constants;
        expect(Object.keys(ConstantsA)).toContain('SWAGGER_API_DOCS_CONTEXT');
        const ConstantsB = index('foo', app).Constants;
        expect(Object.keys(ConstantsB)).toContain('SWAGGER_API_DOCS_CONTEXT');
    });

    it('should export constants for the core app', () => {
        const { Constants } = index('core', app, dirs);
        expect(Object.keys(Constants)).toContain('CORE_DUMMY');
        expect(Object.keys(Constants)).not.toContain('FOO_DUMMY');
    });

    it('should also export constants for the foo app', () => {
        const { Constants } = index('foo', app, dirs);
        expect(Object.keys(Constants)).not.toContain('CORE_DUMMY');
        expect(Object.keys(Constants)).toContain('FOO_DUMMY');
    });

    it('should not export constants that were never referenced', () => {
        const newDirs = {
            base: dirs.base,
            nodeModules: dirs.nodeModules,
            constants: srcDir
        };
        const ConstantsA = index('core', app, newDirs).Constants;
        expect(Object.keys(ConstantsA)).not.toContain('CORE_DUMMY');
        const ConstantsB = index('foo', app, newDirs).Constants;
        expect(Object.keys(ConstantsB)).not.toContain('FOO_DUMMY');
    });

    afterAll(() => {
        global.console = OLD_CONSOLE;
    });
});
