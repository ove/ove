const Constants = global.Constants;
const Utils = global.Utils;

// Tests on logging.
describe('The OVE Utils library', () => {
    // The tests below validate whether the logging works both anonymously
    // and with a given name and also at various levels.
    it('should be logging to the console', () => {
        const log = Utils.Logger('test');
        const spy = jest.spyOn(global.console, 'log');
        log.info('Some test message');
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('should be logging with application id when it is provided', () => {
        const log = Utils.Logger('foo');
        const mockCallback = jest.fn(x => x);
        const OLD_CONSOLE = global.console;
        global.console = { log: mockCallback };
        log.info('Some test message');
        global.console = OLD_CONSOLE;
        expect(mockCallback.mock.calls.length).toBe(1);
        expect(mockCallback.mock.calls[0][3]).toBe('foo'.padEnd(Constants.LOG_APP_ID_WIDTH));
    });

    it('should be logging with ' + Constants.LOG_UNKNOWN_APP_ID + ' application id when no application id is provided', () => {
        const log = Utils.Logger();
        const mockCallback = jest.fn(x => x);
        const OLD_CONSOLE = global.console;
        global.console = { log: mockCallback };
        log.info('Some test message');
        global.console = OLD_CONSOLE;
        expect(mockCallback.mock.calls.length).toBe(1);
        expect(mockCallback.mock.calls[0][3]).toBe(Constants.LOG_UNKNOWN_APP_ID.padEnd(Constants.LOG_APP_ID_WIDTH));
    });

    it('should be logging at log level INFO', () => {
        const log = Utils.Logger('test');
        const spy = jest.spyOn(global.console, 'log');
        log.info('Some test message at INFO level');
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('should be logging at log level DEBUG', () => {
        const log = Utils.Logger('test');
        const spy = jest.spyOn(global.console, 'log');
        log.debug('Some test message at DEBUG level');
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('should be logging at log level TRACE', () => {
        const log = Utils.Logger('test');
        const spy = jest.spyOn(global.console, 'log');
        log.trace('Some test message at TRACE level');
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('should be logging at log level WARN', () => {
        const log = Utils.Logger('test');
        const spy = jest.spyOn(global.console, 'warn');
        log.warn('Some test message at WARN level');
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('should be logging at log level ERROR', () => {
        const log = Utils.Logger('test');
        const spy = jest.spyOn(global.console, 'error');
        log.error('Some test message at ERROR level');
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('should be logging at log level FATAL', () => {
        const log = Utils.Logger('test');
        const spy = jest.spyOn(global.console, 'error');
        log.fatal('Some test message at FATAL level');
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });
});
