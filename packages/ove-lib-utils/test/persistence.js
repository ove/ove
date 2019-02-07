const request = global.request;
const express = global.express;
const nock = global.nock;
const HttpStatus = global.HttpStatus;
const index = global.index;
const dirs = global.dirs;
const Utils = global.Utils;

// Core functionality tests.
describe('The OVE Utils library - Persistence', () => {
    const TIMEOUT = 500;
    let state;

    const OLD_CONSOLE = global.console;
    beforeAll(() => {
        global.console = { log: jest.fn(x => x), warn: jest.fn(x => x), error: jest.fn(x => x) };

        Utils.registerRoutesForPersistence();
        state = Utils.Persistence;
    });

    jest.useFakeTimers();

    it('should export mandatory functionality', () => {
        // The App Base library exports a number of utilities to applications,
        // this test validates that list. The method below tests the rest.
        expect(Object.keys(Utils)).toContain('Persistence');
    });

    it('should fail when providing invalid keys', () => {
        const spy = jest.spyOn(global.console, 'error');
        expect(state.del('fooNumber')).toBeUndefined();
        state.set('fooNumber[bar]', 10);
        expect(state.get('fooNumber[bar]')).not.toEqual(10);
        state.set('fooNumber', 10);
        expect(state.get('fooNumber')).toEqual(10);
        expect(state.del('fooNumber[10]')).toBeUndefined();
        expect(state.del('fooNumber')).not.toBeUndefined();
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('should support getting, setting and deleting objects of various types', () => {
        expect(state.get('fooNumber')).toBeUndefined();
        state.set('fooNumber', 10);
        expect(state.get('fooNumber')).toEqual(10);
        state.del('fooNumber');
        expect(state.get('fooNumber')).toBeUndefined();

        expect(state.get('fooString')).toBeUndefined();
        state.set('fooString', 'myString');
        expect(state.get('fooString')).toEqual('myString');
        state.del('fooString');
        expect(state.get('fooString')).toBeUndefined();

        expect(state.get('fooString2')).toBeUndefined();
        state.set('fooString2', '');
        expect(state.get('fooString2')).toEqual('');
        state.del('fooString2');
        expect(state.get('fooString2')).toBeUndefined();

        expect(state.get('fooBoolean')).toBeUndefined();
        state.set('fooBoolean', false);
        expect(state.get('fooBoolean')).toEqual(false);
        state.del('fooBoolean');
        expect(state.get('fooBoolean')).toBeUndefined();

        expect(state.get('fooBoolean2')).toBeUndefined();
        state.set('fooBoolean2', true);
        expect(state.get('fooBoolean2')).toEqual(true);
        state.del('fooBoolean2');
        expect(state.get('fooBoolean2')).toBeUndefined();

        expect(state.get('fooArray')).toBeUndefined();
        state.set('fooArray', ['tick', 'tock', 10]);
        expect(state.get('fooArray')).toEqual(['tick', 'tock', 10]);
        expect(state.get('fooArray[0]')).toEqual('tick');
        state.del('fooArray');
        expect(state.get('fooArray')).toBeUndefined();

        expect(state.get('fooArray2')).toBeUndefined();
        state.set('fooArray2', []);
        expect(state.get('fooArray2')).toEqual([]);
        state.del('fooArray2');
        expect(state.get('fooArray2')).toBeUndefined();

        expect(state.get('fooObject')).toBeUndefined();
        state.set('fooObject', { foo: ['foobar'] });
        expect(state.get('fooObject')).toEqual({ foo: ['foobar'] });
        expect(state.get('fooObject[foo]')).toEqual(['foobar']);
        expect(state.get('fooObject[foo][0]')).toEqual('foobar');
        state.del('fooObject');
        expect(state.get('fooObject')).toBeUndefined();

        expect(state.get('fooObject2')).toBeUndefined();
        state.set('fooObject', {});
        expect(state.get('fooObject')).toEqual({});
        state.del('fooObject');
        expect(state.get('fooObject')).toBeUndefined();
    });

    it('should support getting, setting and deleting objects using keys', () => {
        expect(state.get('fooEntry')).toBeUndefined();
        state.set('fooEntry', { bar: 10 });
        expect(state.get('fooEntry[bar]')).toEqual(10);
        state.del('fooEntry[bar]');
        expect(state.get('fooEntry[bar]')).toBeUndefined();
        expect(state.get('fooEntry')).not.toBeUndefined();
        state.set('fooEntry[bar]', true);
        expect(state.get('fooEntry[bar]')).toEqual(true);
        state.set('fooEntry[bar]', ['ten']);
        expect(state.get('fooEntry[bar]')).toEqual(['ten']);
        state.set('fooEntry[bar]', {});
        expect(state.get('fooEntry[bar]')).toEqual({});
        state.set('fooEntry[bar]', { some: { deep: 'block' } });
        expect(state.get('fooEntry[bar]')).toEqual({ some: { deep: 'block' } });
        state.set('fooEntry[bar]', { some: { deep: 'block', with: 'updates' } });
        expect(state.get('fooEntry[bar]')).toEqual({ some: { deep: 'block', with: 'updates' } });
        state.set('fooEntry[bar]', { some: { deep: 'block', withMore: 'updates' } });
        expect(state.get('fooEntry[bar]')).toEqual({ some: { deep: 'block', withMore: 'updates' } });
        state.set('fooEntry[bar][some]', { deep: 'block', withMore: 'updates', test: 'test' });
        expect(state.get('fooEntry[bar][some]')).toEqual({ deep: 'block', withMore: 'updates', test: 'test' });
        state.del('fooEntry[bar][some][withMore]');
        expect(state.get('fooEntry[bar]')).toEqual({ some: { deep: 'block', test: 'test' } });
        state.del('fooEntry');
        expect(state.get('fooEntry[bar]')).toBeUndefined();
        expect(state.get('fooEntry')).toBeUndefined();
    });

    /* jshint ignore:start */
    // current version of JSHint does not support async/await
    it('should not fail when trying to unset the service, when it was not originally set', async () => {
        const app = express();
        app.use(express.json());
        const { Utils } = index('core', app, dirs);
        Utils.registerRoutesForPersistence();

        // We don't want sync operations to kick-in at this point.
        process.env.OVE_PERSISTENCE_SYNC_INTERVAL = 0;
        await request(app).delete('/persistence').send({ }).expect(HttpStatus.OK, Utils.JSON.EMPTY);
        delete process.env.OVE_PERSISTENCE_SYNC_INTERVAL;
    });

    it('should support getting, setting and deleting objects with a persistence service', async () => {
        const app = express();
        app.use(express.json());
        const { Utils } = index('core', app, dirs);
        Utils.registerRoutesForPersistence();
        const state = Utils.Persistence;
        await request(app).post('/persistence')
            .send({ }).expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid request' }));

        // We don't want sync operations to kick-in at this point.
        process.env.OVE_PERSISTENCE_SYNC_INTERVAL = 0;
        await request(app).post('/persistence').send({ url: 'http://localhost:8081' })
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);

        let scopes = [];
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooNumber', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').delete('/core/fooNumber').reply(HttpStatus.OK, Utils.JSON.EMPTY));

        expect(state.get('fooNumber')).toBeUndefined();
        state.set('fooNumber', 10);
        expect(state.get('fooNumber')).toEqual(10);
        state.del('fooNumber');
        expect(state.get('fooNumber')).toBeUndefined();

        await request(app).delete('/persistence').send({ }).expect(HttpStatus.OK, Utils.JSON.EMPTY);
        delete process.env.OVE_PERSISTENCE_SYNC_INTERVAL;

        // Important: scopes must be tested at the end, or else they don't evaluate to anything
        scopes.forEach((e) => {
            expect(e.isDone()).toBeTruthy();
        });
    });

    it('should be comparing and setting objects and arrays', async () => {
        const app = express();
        app.use(express.json());
        const { Utils } = index('core', app, dirs);
        Utils.registerRoutesForPersistence();
        const state = Utils.Persistence;
        await request(app).post('/persistence')
            .send({ }).expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid request' }));

        // We don't want sync operations to kick-in at this point.
        process.env.OVE_PERSISTENCE_SYNC_INTERVAL = 0;
        await request(app).post('/persistence').send({ url: 'http://localhost:8081' })
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);

        expect(state.get('fooNumber')).toBeUndefined();
        let scopes = [];
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooNumber', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooNumber', 10);
        expect(state.get('fooNumber')).toEqual(10);
        scopes.push(nock('http://localhost:8081').delete('/core/fooNumber').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooNumber', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooNumber', 'ten');
        expect(state.get('fooNumber')).toEqual('ten');
        scopes.push(nock('http://localhost:8081').delete('/core/fooNumber').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.del('fooNumber');
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooNumber/obj1', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooNumber', { obj1: 10 });
        expect(state.get('fooNumber')).toEqual({ obj1: 10 });
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooNumber/obj1', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooNumber', { obj1: 20 });
        expect(state.get('fooNumber')).toEqual({ obj1: 20 });
        scopes.push(nock('http://localhost:8081').delete('/core/fooNumber/obj1').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooNumber/obj2', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooNumber', { obj2: 20 });
        expect(state.get('fooNumber')).toEqual({ obj2: 20 });
        // Ordering of the items in value have changed, and therefore, we must delete objects that are not matching
        // according to their indexes. This is mandatory for arrays, because the order is important.
        scopes.push(nock('http://localhost:8081').delete('/core/fooNumber/obj2').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooNumber/obj1', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooNumber/obj2', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooNumber', { obj1: 10, obj2: 30 });
        expect(state.get('fooNumber')).toEqual({ obj1: 10, obj2: 30 });
        scopes.push(nock('http://localhost:8081').delete('/core/fooNumber/obj1').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooNumber', { obj2: 30 });
        expect(state.get('fooNumber')).toEqual({ obj2: 30 });
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooNumber/obj3/0', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooNumber/obj3/1', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooNumber', { obj3: [10, 20], obj2: 30 });
        expect(state.get('fooNumber')).toEqual({ obj2: 30, obj3: [10, 20] });
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooNumber/obj2', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooNumber', { obj2: 40, obj3: [10, 20] });
        expect(state.get('fooNumber')).toEqual({ obj2: 40, obj3: [10, 20] });
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooNumber/obj2', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooNumber', { obj3: [10, 20], obj2: 30 });
        expect(state.get('fooNumber')).toEqual({ obj2: 30, obj3: [10, 20] });
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooNumber/obj3/1', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooNumber[obj3][1]', 30);
        expect(state.get('fooNumber')).toEqual({ obj2: 30, obj3: [10, 30] });
        scopes.push(nock('http://localhost:8081').delete('/core/fooNumber/obj3/0').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').delete('/core/fooNumber/obj3/1').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooNumber', { obj2: 30 });
        expect(state.get('fooNumber')).toEqual({ obj2: 30 });
        scopes.push(nock('http://localhost:8081').delete('/core/fooNumber/obj2').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.del('fooNumber');
        expect(state.get('fooNumber')).toBeUndefined();

        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooEntry/bar', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooEntry', { bar: 10 });
        expect(state.get('fooEntry[bar]')).toEqual(10);
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooEntry/bar', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooEntry', { bar: 20 });
        expect(state.get('fooEntry[bar]')).toEqual(20);
        scopes.push(nock('http://localhost:8081').delete('/core/fooEntry/bar').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooEntry/bar', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooEntry[bar]', true);
        expect(state.get('fooEntry[bar]')).toEqual(true);
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooEntry/bar', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooEntry[bar]', false);
        expect(state.get('fooEntry[bar]')).toEqual(false);
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooEntry/bar', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooEntry[bar]', 'some');
        expect(state.get('fooEntry[bar]')).toEqual('some');
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooEntry/bar', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooEntry[bar]', 'string');
        expect(state.get('fooEntry[bar]')).toEqual('string');
        scopes.push(nock('http://localhost:8081').delete('/core/fooEntry/bar').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooEntry/bar/0', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooEntry[bar]', ['ten']);
        expect(state.get('fooEntry[bar]')).toEqual(['ten']);
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooEntry/bar/1/0', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooEntry/bar/1/1', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooEntry[bar][1]', [10, 20]);
        expect(state.get('fooEntry[bar][1]')).toEqual([10, 20]);
        scopes.push(nock('http://localhost:8081').delete('/core/fooEntry/bar/0').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').delete('/core/fooEntry/bar/1/0').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').delete('/core/fooEntry/bar/1/1').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooEntry[bar]', {});
        expect(state.get('fooEntry[bar]')).toEqual({});
        scopes.push(nock('http://localhost:8081').delete('/core/fooEntry/bar').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.del('fooEntry');
        expect(state.get('fooEntry')).toBeUndefined();

        await request(app).delete('/persistence').send({ }).expect(HttpStatus.OK, Utils.JSON.EMPTY);
        delete process.env.OVE_PERSISTENCE_SYNC_INTERVAL;

        // Important: scopes must be tested at the end, or else they don't evaluate to anything
        scopes.forEach((e) => {
            expect(e.isDone()).toBeTruthy();
        });
    });

    it('should not be comparing and setting objects and arrays, without a persistence service', async () => {
        const app = express();
        app.use(express.json());
        const { Utils } = index('core', app, dirs);
        Utils.registerRoutesForPersistence();
        const state = Utils.Persistence;

        expect(state.get('fooNumber')).toBeUndefined();
        let scopes = [];
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooNumber', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooNumber', 10);
        expect(state.get('fooNumber')).toEqual(10);
        scopes.push(nock('http://localhost:8081').delete('/core/fooNumber').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooNumber', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooNumber', 'ten');
        expect(state.get('fooNumber')).toEqual('ten');
        scopes.push(nock('http://localhost:8081').delete('/core/fooNumber').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.del('fooNumber');
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooNumber/obj1', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooNumber', { obj1: 10 });
        expect(state.get('fooNumber')).toEqual({ obj1: 10 });
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooNumber/obj1', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooNumber', { obj1: 20 });
        expect(state.get('fooNumber')).toEqual({ obj1: 20 });
        scopes.push(nock('http://localhost:8081').delete('/core/fooNumber/obj1').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooNumber/obj2', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooNumber', { obj2: 20 });
        expect(state.get('fooNumber')).toEqual({ obj2: 20 });
        // Ordering of the items in value have changed, and therefore, we must delete objects that are not matching
        // according to their indexes. This is mandatory for arrays, because the order is important.
        scopes.push(nock('http://localhost:8081').delete('/core/fooNumber/obj2').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooNumber/obj1', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooNumber/obj2', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooNumber', { obj1: 10, obj2: 30 });
        expect(state.get('fooNumber')).toEqual({ obj1: 10, obj2: 30 });
        scopes.push(nock('http://localhost:8081').delete('/core/fooNumber/obj1').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooNumber', { obj2: 30 });
        expect(state.get('fooNumber')).toEqual({ obj2: 30 });
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooNumber/obj3/0', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooNumber/obj3/1', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooNumber', { obj3: [10, 20], obj2: 30 });
        expect(state.get('fooNumber')).toEqual({ obj2: 30, obj3: [10, 20] });
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooNumber/obj2', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooNumber', { obj2: 40, obj3: [10, 20] });
        expect(state.get('fooNumber')).toEqual({ obj2: 40, obj3: [10, 20] });
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooNumber/obj2', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooNumber', { obj3: [10, 20], obj2: 30 });
        expect(state.get('fooNumber')).toEqual({ obj2: 30, obj3: [10, 20] });
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooNumber/obj3/1', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooNumber[obj3][1]', 30);
        expect(state.get('fooNumber')).toEqual({ obj2: 30, obj3: [10, 30] });
        scopes.push(nock('http://localhost:8081').delete('/core/fooNumber/obj3/0').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').delete('/core/fooNumber/obj3/1').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooNumber', { obj2: 30 });
        expect(state.get('fooNumber')).toEqual({ obj2: 30 });
        scopes.push(nock('http://localhost:8081').delete('/core/fooNumber/obj2').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.del('fooNumber');
        expect(state.get('fooNumber')).toBeUndefined();

        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooEntry/bar', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooEntry', { bar: 10 });
        expect(state.get('fooEntry[bar]')).toEqual(10);
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooEntry/bar', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooEntry', { bar: 20 });
        expect(state.get('fooEntry[bar]')).toEqual(20);
        scopes.push(nock('http://localhost:8081').delete('/core/fooEntry/bar').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooEntry/bar', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooEntry[bar]', true);
        expect(state.get('fooEntry[bar]')).toEqual(true);
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooEntry/bar', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooEntry[bar]', false);
        expect(state.get('fooEntry[bar]')).toEqual(false);
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooEntry/bar', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooEntry[bar]', 'some');
        expect(state.get('fooEntry[bar]')).toEqual('some');
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooEntry/bar', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooEntry[bar]', 'string');
        expect(state.get('fooEntry[bar]')).toEqual('string');
        scopes.push(nock('http://localhost:8081').delete('/core/fooEntry/bar').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooEntry/bar/0', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooEntry[bar]', ['ten']);
        expect(state.get('fooEntry[bar]')).toEqual(['ten']);
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooEntry/bar/1/0', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooEntry/bar/1/1', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooEntry[bar][1]', [10, 20]);
        expect(state.get('fooEntry[bar][1]')).toEqual([10, 20]);
        scopes.push(nock('http://localhost:8081').delete('/core/fooEntry/bar/0').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').delete('/core/fooEntry/bar/1/0').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').delete('/core/fooEntry/bar/1/1').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.set('fooEntry[bar]', {});
        expect(state.get('fooEntry[bar]')).toEqual({});
        scopes.push(nock('http://localhost:8081').delete('/core/fooEntry/bar').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        state.del('fooEntry');
        expect(state.get('fooEntry')).toBeUndefined();

        // Important: scopes must be tested at the end, or else they don't evaluate to anything
        scopes.forEach((e) => {
            expect(e.isDone()).not.toBeTruthy();
        });
    });

    it('should complain when attempting to upload invalid types', async () => {
        const app = express();
        app.use(express.json());
        const { Utils } = index('core', app, dirs);
        Utils.registerRoutesForPersistence();
        const state = Utils.Persistence;

        // We don't want sync operations to kick-in at this point.
        process.env.OVE_PERSISTENCE_SYNC_INTERVAL = 0;
        await request(app).post('/persistence').send({ url: 'http://localhost:8081' })
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);

        expect(state.get('fooNumber')).toBeUndefined();
        let scopes = [];
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/core/fooNumber', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').delete('/core/fooNumber/obj2').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        let func = function () {};
        let spy = jest.spyOn(global.console, 'warn');
        state.set('fooFunc', func);
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
        spy = jest.spyOn(global.console, 'warn');
        expect(state.get('fooFunc')).not.toEqual(func);
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
        spy = jest.spyOn(global.console, 'warn');
        state.set('fooFunc', func);
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();

        await request(app).delete('/persistence').send({ }).expect(HttpStatus.OK, Utils.JSON.EMPTY);
        delete process.env.OVE_PERSISTENCE_SYNC_INTERVAL;

        // Important: scopes must be tested at the end, or else they don't evaluate to anything
        scopes.forEach((e) => {
            expect(e.isDone()).not.toBeTruthy();
        });
    });

    it('should not attempt to sync without a persistence service', () => {
        const app = express();
        app.use(express.json());
        const { Utils } = index('core', app);
        Utils.registerRoutesForPersistence();

        let spy = jest.spyOn(global.console, 'warn');
        Utils.Persistence.sync();
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('should synchronise local and remote data', async () => {
        const app = express();
        app.use(express.json());
        const { Utils } = index('core', app, dirs);
        Utils.registerRoutesForPersistence();
        const state = Utils.Persistence;

        state.set('fooEntry', { foo: 'bar', test: [0, false] });
        state.set('fakeEntry', { fn: function () {} });
        expect(state.get('fooEntry')).toEqual({ foo: 'bar', test: [0, false] });

        // We don't want sync operations to kick-in at this point.
        process.env.OVE_PERSISTENCE_SYNC_INTERVAL = 0;
        await request(app).post('/persistence').send({ url: 'http://localhost:8081' })
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);

        let scopes = [];
        const mockCallback = jest.fn(x => x);
        const OLD_CONSOLE = global.console;
        global.console = { error: mockCallback, log: OLD_CONSOLE.log, warn: OLD_CONSOLE.warn };
        state.sync();

        scopes.push(nock('http://localhost:8081').get('/core').reply(HttpStatus.OK, {
            'fooEntry/foo': Number.MIN_VALUE,
            'fooEntry/bar': Number.MAX_VALUE,
            'fooEntry/nbar': Number.MAX_VALUE,
            'xEntry/0/test/nbar': Number.MAX_VALUE,
            'fooEntry/test/0': Number.MAX_VALUE
        }));
        scopes.push(nock('http://localhost:8081').get('/core/fooEntry/bar').reply(HttpStatus.OK, {
            value: 'bar'
        }));
        scopes.push(nock('http://localhost:8081').get('/core/fooEntry/test/0').reply(HttpStatus.OK, {
            value: 0
        }));
        scopes.push(nock('http://localhost:8081').get('/core/xEntry/0/test/nbar').reply(HttpStatus.OK, {
            value: 0
        }));
        state.sync();

        // Fake request to make things wait for a while before cleaning up.
        await request(app).post('/').send({});

        await request(app).delete('/persistence').send({ }).expect(HttpStatus.OK, Utils.JSON.EMPTY);
        delete process.env.OVE_PERSISTENCE_SYNC_INTERVAL;

        expect(state.get('fooEntry')).toEqual({ foo: 'bar', bar: 'bar', test: [0] });
        global.console = OLD_CONSOLE;

        // Should be getting exactly two errors due to failed network calls.
        expect(mockCallback.mock.calls.length).toBe(2);
        expect(mockCallback.mock.calls[0][5]).toBe('Unable to get of keys from persistence service:');
        expect(mockCallback.mock.calls[1][5]).toBe('Unable to read key:');

        // Important: scopes must be tested at the end, or else they don't evaluate to anything
        scopes.forEach((e) => {
            expect(e.isDone()).toBeTruthy();
        });
    });

    it('should schedule sync task according to environment variables', async () => {
        const app = express();
        app.use(express.json());
        const { Utils } = index('core', app, dirs);
        Utils.registerRoutesForPersistence();
        const state = Utils.Persistence;

        // We don't want sync operations to kick-in at this point.
        process.env.OVE_PERSISTENCE_SYNC_INTERVAL = 1;
        const spy = jest.spyOn(state, 'sync');

        await request(app).post('/persistence').send({ url: 'http://localhost:8081' })
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);

        setTimeout(async () => {
            // Fake request to make things wait for a while before cleaning up.
            await request(app).post('/').send({});

            await request(app).delete('/persistence').send({ }).expect(HttpStatus.OK, Utils.JSON.EMPTY);
            delete process.env.OVE_PERSISTENCE_SYNC_INTERVAL;
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        }, TIMEOUT);
    });

    it('should use the updated value of the OVE_PERSISTENCE_SYNC_INTERVAL whenever the persistence service changes', async () => {
        const app = express();
        app.use(express.json());
        const { Utils, Constants } = index('core', app);
        Utils.registerRoutesForPersistence();
        const state = Utils.Persistence;

        // We don't want sync operations to kick-in at this point.
        Constants.PERSISTENCE_SYNC_INTERVAL = 0;
        await request(app).post('/persistence').send({ url: 'http://localhost:8081' })
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);

        // Reset it once to ensure sync will not be running, before we start the test.
        Constants.PERSISTENCE_SYNC_INTERVAL = 2000;
        await request(app).post('/persistence').send({ url: 'http://localhost:8081' })
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);

        // Now set the spy and check whether it actually runs or not.
        const spy = jest.spyOn(state, 'sync');
        await request(app).post('/persistence').send({ url: 'http://localhost:8081' })
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);

        setTimeout(async () => {
            // Fake request to make things wait for a while before cleaning up.
            await request(app).post('/').send({});

            await request(app).delete('/persistence').send({ }).expect(HttpStatus.OK, Utils.JSON.EMPTY);
            delete process.env.OVE_PERSISTENCE_SYNC_INTERVAL;
            expect(spy).not.toHaveBeenCalled();
            spy.mockRestore();
        }, TIMEOUT);
    });
    /* jshint ignore:end */

    afterEach(() => {
        nock.cleanAll();
    });

    afterAll(() => {
        global.console = OLD_CONSOLE;
    });
});
