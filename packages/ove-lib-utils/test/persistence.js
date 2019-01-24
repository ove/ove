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

    beforeAll(() => {
        Utils.registerRoutesForPersistence();
    });

    jest.useFakeTimers();

    it('should export mandatory functionality', () => {
        // The App Base library exports a number of utilities to applications,
        // this test validates that list. The method below tests the rest.
        expect(Object.keys(Utils)).toContain('Persistence');
    });

    it('should fail when providing invalid keys', () => {
        const spy = jest.spyOn(global.console, 'error');
        expect(Utils.Persistence.del('fooNumber')).toBeUndefined();
        Utils.Persistence.set('fooNumber[bar]', 10);
        expect(Utils.Persistence.get('fooNumber[bar]')).not.toEqual(10);
        Utils.Persistence.set('fooNumber', 10);
        expect(Utils.Persistence.get('fooNumber')).toEqual(10);
        expect(Utils.Persistence.del('fooNumber[10]')).toBeUndefined();
        expect(Utils.Persistence.del('fooNumber')).not.toBeUndefined();
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('should support getting, setting and deleting objects of various types', () => {
        expect(Utils.Persistence.get('fooNumber')).toBeUndefined();
        Utils.Persistence.set('fooNumber', 10);
        expect(Utils.Persistence.get('fooNumber')).toEqual(10);
        Utils.Persistence.del('fooNumber');
        expect(Utils.Persistence.get('fooNumber')).toBeUndefined();

        expect(Utils.Persistence.get('fooString')).toBeUndefined();
        Utils.Persistence.set('fooString', 'myString');
        expect(Utils.Persistence.get('fooString')).toEqual('myString');
        Utils.Persistence.del('fooString');
        expect(Utils.Persistence.get('fooString')).toBeUndefined();

        expect(Utils.Persistence.get('fooString2')).toBeUndefined();
        Utils.Persistence.set('fooString2', '');
        expect(Utils.Persistence.get('fooString2')).toEqual('');
        Utils.Persistence.del('fooString2');
        expect(Utils.Persistence.get('fooString2')).toBeUndefined();

        expect(Utils.Persistence.get('fooBoolean')).toBeUndefined();
        Utils.Persistence.set('fooBoolean', false);
        expect(Utils.Persistence.get('fooBoolean')).toEqual(false);
        Utils.Persistence.del('fooBoolean');
        expect(Utils.Persistence.get('fooBoolean')).toBeUndefined();

        expect(Utils.Persistence.get('fooBoolean2')).toBeUndefined();
        Utils.Persistence.set('fooBoolean2', true);
        expect(Utils.Persistence.get('fooBoolean2')).toEqual(true);
        Utils.Persistence.del('fooBoolean2');
        expect(Utils.Persistence.get('fooBoolean2')).toBeUndefined();

        expect(Utils.Persistence.get('fooArray')).toBeUndefined();
        Utils.Persistence.set('fooArray', ['tick', 'tock', 10]);
        expect(Utils.Persistence.get('fooArray')).toEqual(['tick', 'tock', 10]);
        expect(Utils.Persistence.get('fooArray[0]')).toEqual('tick');
        Utils.Persistence.del('fooArray');
        expect(Utils.Persistence.get('fooArray')).toBeUndefined();

        expect(Utils.Persistence.get('fooArray2')).toBeUndefined();
        Utils.Persistence.set('fooArray2', []);
        expect(Utils.Persistence.get('fooArray2')).toEqual([]);
        Utils.Persistence.del('fooArray2');
        expect(Utils.Persistence.get('fooArray2')).toBeUndefined();

        expect(Utils.Persistence.get('fooObject')).toBeUndefined();
        Utils.Persistence.set('fooObject', { foo: ['foobar'] });
        expect(Utils.Persistence.get('fooObject')).toEqual({ foo: ['foobar'] });
        expect(Utils.Persistence.get('fooObject[foo]')).toEqual(['foobar']);
        expect(Utils.Persistence.get('fooObject[foo][0]')).toEqual('foobar');
        Utils.Persistence.del('fooObject');
        expect(Utils.Persistence.get('fooObject')).toBeUndefined();

        expect(Utils.Persistence.get('fooObject2')).toBeUndefined();
        Utils.Persistence.set('fooObject', {});
        expect(Utils.Persistence.get('fooObject')).toEqual({});
        Utils.Persistence.del('fooObject');
        expect(Utils.Persistence.get('fooObject')).toBeUndefined();
    });

    it('should support getting, setting and deleting objects using keys', () => {
        expect(Utils.Persistence.get('fooEntry')).toBeUndefined();
        Utils.Persistence.set('fooEntry', { bar: 10 });
        expect(Utils.Persistence.get('fooEntry[bar]')).toEqual(10);
        Utils.Persistence.del('fooEntry[bar]');
        expect(Utils.Persistence.get('fooEntry[bar]')).toBeUndefined();
        expect(Utils.Persistence.get('fooEntry')).not.toBeUndefined();
        Utils.Persistence.set('fooEntry[bar]', true);
        expect(Utils.Persistence.get('fooEntry[bar]')).toEqual(true);
        Utils.Persistence.set('fooEntry[bar]', ['ten']);
        expect(Utils.Persistence.get('fooEntry[bar]')).toEqual(['ten']);
        Utils.Persistence.set('fooEntry[bar]', {});
        expect(Utils.Persistence.get('fooEntry[bar]')).toEqual({});
        Utils.Persistence.set('fooEntry[bar]', { some: { deep: 'block' } });
        expect(Utils.Persistence.get('fooEntry[bar]')).toEqual({ some: { deep: 'block' } });
        Utils.Persistence.set('fooEntry[bar]', { some: { deep: 'block', with: 'updates' } });
        expect(Utils.Persistence.get('fooEntry[bar]')).toEqual({ some: { deep: 'block', with: 'updates' } });
        Utils.Persistence.set('fooEntry[bar]', { some: { deep: 'block', withMore: 'updates' } });
        expect(Utils.Persistence.get('fooEntry[bar]')).toEqual({ some: { deep: 'block', withMore: 'updates' } });
        Utils.Persistence.del('fooEntry[bar][some][withMore]');
        expect(Utils.Persistence.get('fooEntry[bar]')).toEqual({ some: { deep: 'block' } });
        Utils.Persistence.del('fooEntry');
        expect(Utils.Persistence.get('fooEntry[bar]')).toBeUndefined();
        expect(Utils.Persistence.get('fooEntry')).toBeUndefined();
    });

    /* jshint ignore:start */
    // current version of JSHint does not support async/await
    it('should not fail when trying to unset the provider, when it was not originally set', async () => {
        const app = express();
        app.use(express.json());
        const { Utils } = index('core', app, dirs);
        Utils.registerRoutesForPersistence();

        // We don't want sync operations to kick-in at this point.
        process.env.OVE_PERSISTENCE_SYNC_INTERVAL = 0;
        await request(app).delete('/persistence').send({ }).expect(HttpStatus.OK, Utils.JSON.EMPTY);
        delete process.env.OVE_PERSISTENCE_SYNC_INTERVAL;
    });

    it('should support getting, setting and deleting objects with a persistence provider', async () => {
        const app = express();
        app.use(express.json());
        const { Utils } = index('core', app, dirs);
        Utils.registerRoutesForPersistence();
        await request(app).post('/persistence')
            .send({ }).expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid request' }));

        // We don't want sync operations to kick-in at this point.
        process.env.OVE_PERSISTENCE_SYNC_INTERVAL = 0;
        await request(app).post('/persistence').send({ url: 'http://localhost:8081' })
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);

        let scope1 = nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooNumber?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY);
        let scope2 = nock('http://localhost:8081').delete('/fooNumber?appName=core').reply(HttpStatus.OK, Utils.JSON.EMPTY);

        expect(Utils.Persistence.get('fooNumber')).toBeUndefined();
        Utils.Persistence.set('fooNumber', 10);
        expect(Utils.Persistence.get('fooNumber')).toEqual(10);
        Utils.Persistence.del('fooNumber');
        expect(Utils.Persistence.get('fooNumber')).toBeUndefined();

        await request(app).delete('/persistence').send({ }).expect(HttpStatus.OK, Utils.JSON.EMPTY);
        delete process.env.OVE_PERSISTENCE_SYNC_INTERVAL;

        // Important: scopes must be tested at the end, or else they don't evaluate to anything
        expect(scope1.isDone()).toBeTruthy(); // request should be made at this point.
        expect(scope2.isDone()).toBeTruthy(); // request should not be made at this point.
    });

    it('should be comparing and setting objects and arrays', async () => {
        const app = express();
        app.use(express.json());
        const { Utils } = index('core', app, dirs);
        Utils.registerRoutesForPersistence();
        await request(app).post('/persistence')
            .send({ }).expect(HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid request' }));

        // We don't want sync operations to kick-in at this point.
        process.env.OVE_PERSISTENCE_SYNC_INTERVAL = 0;
        await request(app).post('/persistence').send({ url: 'http://localhost:8081' })
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);

        expect(Utils.Persistence.get('fooNumber')).toBeUndefined();
        let scopes = [];
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooNumber?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooNumber', 10);
        expect(Utils.Persistence.get('fooNumber')).toEqual(10);
        scopes.push(nock('http://localhost:8081').delete('/fooNumber?appName=core').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooNumber?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooNumber', 'ten');
        expect(Utils.Persistence.get('fooNumber')).toEqual('ten');
        scopes.push(nock('http://localhost:8081').delete('/fooNumber?appName=core').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.del('fooNumber');
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooNumber[obj1]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooNumber', { obj1: 10 });
        expect(Utils.Persistence.get('fooNumber')).toEqual({ obj1: 10 });
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooNumber[obj1]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooNumber', { obj1: 20 });
        expect(Utils.Persistence.get('fooNumber')).toEqual({ obj1: 20 });
        scopes.push(nock('http://localhost:8081').delete('/fooNumber[obj1]?appName=core').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooNumber[obj2]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooNumber', { obj2: 20 });
        expect(Utils.Persistence.get('fooNumber')).toEqual({ obj2: 20 });
        // Ordering of the items in value have changed, and therefore, we must delete objects that are not matching
        // according to their indexes. This is mandatory for arrays, because the order is important.
        scopes.push(nock('http://localhost:8081').delete('/fooNumber[obj2]?appName=core').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooNumber[obj1]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooNumber[obj2]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooNumber', { obj1: 10, obj2: 30 });
        expect(Utils.Persistence.get('fooNumber')).toEqual({ obj1: 10, obj2: 30 });
        scopes.push(nock('http://localhost:8081').delete('/fooNumber[obj1]?appName=core').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooNumber', { obj2: 30 });
        expect(Utils.Persistence.get('fooNumber')).toEqual({ obj2: 30 });
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooNumber[obj3][0]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooNumber[obj3][1]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooNumber', { obj3: [10, 20], obj2: 30 });
        expect(Utils.Persistence.get('fooNumber')).toEqual({ obj2: 30, obj3: [10, 20] });
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooNumber[obj2]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooNumber', { obj2: 40, obj3: [10, 20] });
        expect(Utils.Persistence.get('fooNumber')).toEqual({ obj2: 40, obj3: [10, 20] });
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooNumber[obj2]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooNumber', { obj3: [10, 20], obj2: 30 });
        expect(Utils.Persistence.get('fooNumber')).toEqual({ obj2: 30, obj3: [10, 20] });
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooNumber[obj3][1]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooNumber[obj3][1]', 30);
        expect(Utils.Persistence.get('fooNumber')).toEqual({ obj2: 30, obj3: [10, 30] });
        scopes.push(nock('http://localhost:8081').delete('/fooNumber[obj3][0]?appName=core').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').delete('/fooNumber[obj3][1]?appName=core').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooNumber', { obj2: 30 });
        expect(Utils.Persistence.get('fooNumber')).toEqual({ obj2: 30 });
        scopes.push(nock('http://localhost:8081').delete('/fooNumber[obj2]?appName=core').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.del('fooNumber');
        expect(Utils.Persistence.get('fooNumber')).toBeUndefined();

        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooEntry[bar]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooEntry', { bar: 10 });
        expect(Utils.Persistence.get('fooEntry[bar]')).toEqual(10);
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooEntry[bar]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooEntry', { bar: 20 });
        expect(Utils.Persistence.get('fooEntry[bar]')).toEqual(20);
        scopes.push(nock('http://localhost:8081').delete('/fooEntry[bar]?appName=core').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooEntry[bar]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooEntry[bar]', true);
        expect(Utils.Persistence.get('fooEntry[bar]')).toEqual(true);
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooEntry[bar]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooEntry[bar]', false);
        expect(Utils.Persistence.get('fooEntry[bar]')).toEqual(false);
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooEntry[bar]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooEntry[bar]', 'some');
        expect(Utils.Persistence.get('fooEntry[bar]')).toEqual('some');
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooEntry[bar]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooEntry[bar]', 'string');
        expect(Utils.Persistence.get('fooEntry[bar]')).toEqual('string');
        scopes.push(nock('http://localhost:8081').delete('/fooEntry[bar]?appName=core').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooEntry[bar][0]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooEntry[bar]', ['ten']);
        expect(Utils.Persistence.get('fooEntry[bar]')).toEqual(['ten']);
        scopes.push(nock('http://localhost:8081').delete('/fooEntry[bar][0]?appName=core').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooEntry[bar]', {});
        expect(Utils.Persistence.get('fooEntry[bar]')).toEqual({});
        scopes.push(nock('http://localhost:8081').delete('/fooEntry[bar]?appName=core').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.del('fooEntry');
        expect(Utils.Persistence.get('fooEntry')).toBeUndefined();

        await request(app).delete('/persistence').send({ }).expect(HttpStatus.OK, Utils.JSON.EMPTY);
        delete process.env.OVE_PERSISTENCE_SYNC_INTERVAL;

        // Important: scopes must be tested at the end, or else they don't evaluate to anything
        scopes.forEach((e) => {
            expect(e.isDone()).toBeTruthy();
        });
    });

    it('should not be comparing and setting objects and arrays, without a persistence provider', async () => {
        const app = express();
        app.use(express.json());
        const { Utils } = index('core', app, dirs);
        Utils.registerRoutesForPersistence();

        expect(Utils.Persistence.get('fooNumber')).toBeUndefined();
        let scopes = [];
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooNumber?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooNumber', 10);
        expect(Utils.Persistence.get('fooNumber')).toEqual(10);
        scopes.push(nock('http://localhost:8081').delete('/fooNumber?appName=core').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooNumber?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooNumber', 'ten');
        expect(Utils.Persistence.get('fooNumber')).toEqual('ten');
        scopes.push(nock('http://localhost:8081').delete('/fooNumber?appName=core').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.del('fooNumber');
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooNumber[obj1]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooNumber', { obj1: 10 });
        expect(Utils.Persistence.get('fooNumber')).toEqual({ obj1: 10 });
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooNumber[obj1]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooNumber', { obj1: 20 });
        expect(Utils.Persistence.get('fooNumber')).toEqual({ obj1: 20 });
        scopes.push(nock('http://localhost:8081').delete('/fooNumber[obj1]?appName=core').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooNumber[obj2]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooNumber', { obj2: 20 });
        expect(Utils.Persistence.get('fooNumber')).toEqual({ obj2: 20 });
        // Ordering of the items in value have changed, and therefore, we must delete objects that are not matching
        // according to their indexes. This is mandatory for arrays, because the order is important.
        scopes.push(nock('http://localhost:8081').delete('/fooNumber[obj2]?appName=core').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooNumber[obj1]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooNumber[obj2]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooNumber', { obj1: 10, obj2: 30 });
        expect(Utils.Persistence.get('fooNumber')).toEqual({ obj1: 10, obj2: 30 });
        scopes.push(nock('http://localhost:8081').delete('/fooNumber[obj1]?appName=core').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooNumber', { obj2: 30 });
        expect(Utils.Persistence.get('fooNumber')).toEqual({ obj2: 30 });
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooNumber[obj3][0]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooNumber[obj3][1]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooNumber', { obj3: [10, 20], obj2: 30 });
        expect(Utils.Persistence.get('fooNumber')).toEqual({ obj2: 30, obj3: [10, 20] });
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooNumber[obj2]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooNumber', { obj2: 40, obj3: [10, 20] });
        expect(Utils.Persistence.get('fooNumber')).toEqual({ obj2: 40, obj3: [10, 20] });
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooNumber[obj2]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooNumber', { obj3: [10, 20], obj2: 30 });
        expect(Utils.Persistence.get('fooNumber')).toEqual({ obj2: 30, obj3: [10, 20] });
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooNumber[obj3][1]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooNumber[obj3][1]', 30);
        expect(Utils.Persistence.get('fooNumber')).toEqual({ obj2: 30, obj3: [10, 30] });
        scopes.push(nock('http://localhost:8081').delete('/fooNumber[obj3][0]?appName=core').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').delete('/fooNumber[obj3][1]?appName=core').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooNumber', { obj2: 30 });
        expect(Utils.Persistence.get('fooNumber')).toEqual({ obj2: 30 });
        scopes.push(nock('http://localhost:8081').delete('/fooNumber[obj2]?appName=core').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.del('fooNumber');
        expect(Utils.Persistence.get('fooNumber')).toBeUndefined();

        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooEntry[bar]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooEntry', { bar: 10 });
        expect(Utils.Persistence.get('fooEntry[bar]')).toEqual(10);
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooEntry[bar]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooEntry', { bar: 20 });
        expect(Utils.Persistence.get('fooEntry[bar]')).toEqual(20);
        scopes.push(nock('http://localhost:8081').delete('/fooEntry[bar]?appName=core').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooEntry[bar]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooEntry[bar]', true);
        expect(Utils.Persistence.get('fooEntry[bar]')).toEqual(true);
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooEntry[bar]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooEntry[bar]', false);
        expect(Utils.Persistence.get('fooEntry[bar]')).toEqual(false);
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooEntry[bar]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooEntry[bar]', 'some');
        expect(Utils.Persistence.get('fooEntry[bar]')).toEqual('some');
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooEntry[bar]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooEntry[bar]', 'string');
        expect(Utils.Persistence.get('fooEntry[bar]')).toEqual('string');
        scopes.push(nock('http://localhost:8081').delete('/fooEntry[bar]?appName=core').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooEntry[bar][0]?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooEntry[bar]', ['ten']);
        expect(Utils.Persistence.get('fooEntry[bar]')).toEqual(['ten']);
        scopes.push(nock('http://localhost:8081').delete('/fooEntry[bar][0]?appName=core').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.set('fooEntry[bar]', {});
        expect(Utils.Persistence.get('fooEntry[bar]')).toEqual({});
        scopes.push(nock('http://localhost:8081').delete('/fooEntry[bar]?appName=core').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        Utils.Persistence.del('fooEntry');
        expect(Utils.Persistence.get('fooEntry')).toBeUndefined();

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

        // We don't want sync operations to kick-in at this point.
        process.env.OVE_PERSISTENCE_SYNC_INTERVAL = 0;
        await request(app).post('/persistence').send({ url: 'http://localhost:8081' })
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);

        expect(Utils.Persistence.get('fooNumber')).toBeUndefined();
        let scopes = [];
        scopes.push(nock('http://localhost:8081').filteringRequestBody(() => '*').post('/fooNumber?appName=core', '*').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        scopes.push(nock('http://localhost:8081').delete('/fooNumber[obj2]?appName=core').reply(HttpStatus.OK, Utils.JSON.EMPTY));
        let func = function () {};
        let spy = jest.spyOn(global.console, 'warn');
        Utils.Persistence.set('fooFunc', func);
        expect(spy).not.toHaveBeenCalled();
        expect(Utils.Persistence.get('fooFunc')).not.toEqual(func);
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
        spy = jest.spyOn(global.console, 'warn');
        Utils.Persistence.set('fooFunc', func);
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();

        await request(app).delete('/persistence').send({ }).expect(HttpStatus.OK, Utils.JSON.EMPTY);
        delete process.env.OVE_PERSISTENCE_SYNC_INTERVAL;

        // Important: scopes must be tested at the end, or else they don't evaluate to anything
        scopes.forEach((e) => {
            expect(e.isDone()).not.toBeTruthy();
        });
    });

    it('should synchronise local and remote data', async () => {
        const app = express();
        app.use(express.json());
        const { Utils } = index('core', app, dirs);
        Utils.registerRoutesForPersistence();

        Utils.Persistence.set('fooEntry', { foo: 'bar', test: [0, false] });
        Utils.Persistence.set('fakeEntry', { fn: function () {} });
        expect(Utils.Persistence.get('fooEntry')).toEqual({ foo: 'bar', test: [0, false] });

        // We don't want sync operations to kick-in at this point.
        process.env.OVE_PERSISTENCE_SYNC_INTERVAL = 0;
        await request(app).post('/persistence').send({ url: 'http://localhost:8081' })
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);

        let scopes = [];
        const mockCallback = jest.fn(x => x);
        const OLD_CONSOLE = global.console;
        global.console = { error: mockCallback, log: OLD_CONSOLE.log, warn: OLD_CONSOLE.warn };
        Utils.Persistence.sync();

        scopes.push(nock('http://localhost:8081').get('/?appName=core').reply(HttpStatus.OK, {
            'fooEntry[foo]': Number.MIN_VALUE,
            'fooEntry[bar]': Number.MAX_VALUE,
            'fooEntry[nbar]': Number.MAX_VALUE,
            'fooEntry[test][0]': Number.MAX_VALUE
        }));
        scopes.push(nock('http://localhost:8081').get('/fooEntry[bar]?appName=core').reply(HttpStatus.OK, {
            value: 'bar'
        }));
        scopes.push(nock('http://localhost:8081').get('/fooEntry[test][0]?appName=core').reply(HttpStatus.OK, {
            value: 0
        }));
        Utils.Persistence.sync();

        // Fake request to make things wait for a while before cleaning up.
        await request(app).post('/').send({});

        await request(app).delete('/persistence').send({ }).expect(HttpStatus.OK, Utils.JSON.EMPTY);
        delete process.env.OVE_PERSISTENCE_SYNC_INTERVAL;

        // Important: scopes must be tested at the end, or else they don't evaluate to anything
        scopes.forEach((e) => {
            expect(e.isDone()).toBeTruthy();
        });
        expect(Utils.Persistence.get('fooEntry')).toEqual({ foo: 'bar', bar: 'bar', test: [0] });
        global.console = OLD_CONSOLE;

        // Should be getting exactly two errors due to failed network calls.
        expect(mockCallback.mock.calls.length).toBe(2);
        expect(mockCallback.mock.calls[0][5]).toBe('Unable to get of keys from persistence provider:');
        expect(mockCallback.mock.calls[1][5]).toBe('Unable to read key:');
    });

    it('should schedule sync task according to environment variables', async () => {
        const app = express();
        app.use(express.json());
        const { Utils } = index('core', app, dirs);
        Utils.registerRoutesForPersistence();

        // We don't want sync operations to kick-in at this point.
        process.env.OVE_PERSISTENCE_SYNC_INTERVAL = 1;
        const spy = jest.spyOn(Utils.Persistence, 'sync');

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

    it('should use the updated value of the OVE_PERSISTENCE_SYNC_INTERVAL whenever the persistence provider changes', async () => {
        const app = express();
        app.use(express.json());
        const { Utils } = index('core', app, dirs);
        Utils.registerRoutesForPersistence();

        // We don't want sync operations to kick-in at this point.
        process.env.OVE_PERSISTENCE_SYNC_INTERVAL = 1;
        await request(app).post('/persistence').send({ url: 'http://localhost:8081' })
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);

        // Reset it once to ensure sync will not be running, before we start the test.
        process.env.OVE_PERSISTENCE_SYNC_INTERVAL = 0;
        await request(app).post('/persistence').send({ url: 'http://localhost:8081' })
            .expect(HttpStatus.OK, Utils.JSON.EMPTY);

        // Now set the spy and check whether it actually runs or not.
        const spy = jest.spyOn(Utils.Persistence, 'sync');
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
});
