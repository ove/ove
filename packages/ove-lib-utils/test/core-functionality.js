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

// Core functionality tests.
describe('The OVE Utils library', () => {
    it('should export mandatory functionality', () => {
        // The App Base library exports a number of utilities to applications,
        // this test validates that list. The method below tests the rest.
        expect(Object.keys(Utils)).toContain('JSON');
        expect(Object.keys(Utils)).toContain('sendMessage');
        expect(Object.keys(Utils)).toContain('sendEmptySuccess');
        expect(Object.keys(Utils)).toContain('isNullOrEmpty');
        expect(Object.keys(Utils)).toContain('getOVEHost');
        expect(Object.keys(Utils)).toContain('getSafeSocket');
    });

    it('should also export non-mandatory functionality', () => {
        expect(Object.keys(Utils).length).toEqual(10);
        expect(Object.keys(Utils)).toContain('Logger');
        expect(Object.keys(Utils)).toContain('registerRoutesForPersistence');
        expect(Object.keys(Utils)).toContain('registerRoutesForContent');
        expect(Object.keys(Utils)).toContain('buildAPIDocs');
    });

    it('should test null or empty', () => {
        expect(Utils.isNullOrEmpty(null)).toBeTruthy();
        expect(Utils.isNullOrEmpty(undefined)).toBeTruthy();
        expect(Utils.isNullOrEmpty({})).toBeTruthy();
        expect(Utils.isNullOrEmpty('test')).toBeFalsy();
        expect(Utils.isNullOrEmpty(10.1)).toBeFalsy();
        const foo = { bar: 'foobar' };
        expect(Utils.isNullOrEmpty(foo)).toBeFalsy();
    });

    it('should return a proper hostname', () => {
        process.env.OVE_HOST = 'http://localhost:8080/foo';
        expect(Utils.getOVEHost()).toEqual('localhost:8080');
        process.env.OVE_HOST = 'http://localhost:8080/foo/bar';
        expect(Utils.getOVEHost()).toEqual('localhost:8080');
        process.env.OVE_HOST = 'http://localhost:8080';
        expect(Utils.getOVEHost()).toEqual('localhost:8080');
        process.env.OVE_HOST = 'https://localhost:8080/foo';
        expect(Utils.getOVEHost()).toEqual('localhost:8080');
        process.env.OVE_HOST = '//localhost:8080/foo';
        expect(Utils.getOVEHost()).toEqual('localhost:8080');
        process.env.OVE_HOST = '//localhost:8080/';
        expect(Utils.getOVEHost()).toEqual('localhost:8080');
        process.env.OVE_HOST = 'localhost:8080/foo';
        expect(Utils.getOVEHost()).toEqual('localhost:8080');
        process.env.OVE_HOST = 'http://localhost:8080/';
        expect(Utils.getOVEHost()).toEqual('localhost:8080');
        process.env.OVE_HOST = 'localhost:8080/';
        expect(Utils.getOVEHost()).toEqual('localhost:8080');
        process.env.OVE_HOST = 'localhost:8080';
        expect(Utils.getOVEHost()).toEqual('localhost:8080');
        process.env.OVE_HOST = '/foo';
        expect(Utils.getOVEHost()).toEqual('');
        process.env.OVE_HOST = '//';
        expect(Utils.getOVEHost()).toEqual('');
        process.env.OVE_HOST = '/';
        expect(Utils.getOVEHost()).toEqual('');
        process.env.OVE_HOST = '////';
        expect(Utils.getOVEHost()).toEqual('');
        delete process.env.OVE_HOST;
        expect(Utils.getOVEHost()).toBeUndefined();
    });

    it('should be able to generate JSON responses', () => {
        let res = mockHttp.createResponse();
        Utils.sendMessage(res, 999, 'dummy message');
        expect(res._getData()).toEqual('dummy message');
        expect(res.statusCode).toEqual(999);
    });

    it('should be able to get descendants from JSON payloads', () => {
        expect(Utils.JSON.getDescendant('foo', null)).toBeUndefined();
        expect(Utils.JSON.getDescendant('foo', undefined)).toBeUndefined();
        expect(Utils.JSON.getDescendant('foo', { foo: 10 })).toEqual(10);
        expect(Utils.JSON.getDescendant('foo.bar', { foo: { bar: 'ten' } })).toEqual('ten');
        expect(Utils.JSON.getDescendant('bar', { foo: 10 })).toBeUndefined();
        expect(Utils.JSON.getDescendant('bar.foo', { foo: { bar: 'ten' } })).toBeUndefined();
    });

    it('should be able to generate empty JSON responses', () => {
        let res = mockHttp.createResponse();
        Utils.sendEmptySuccess(res);
        expect(res._getData()).toEqual(Utils.JSON.EMPTY);
        expect(res.statusCode).toEqual(HttpStatus.OK);
    });

    /* jshint ignore:start */
    // current version of JSHint does not support async/await
    it('should be exposing Swagger UI', async () => {
        // Swagger UI is a react app. We first test whether the Swagger UI is launching
        // properly and then test whether our documentation is being displayed by it.
        // Since there is no browser involved, we assume there are no issues during the
        // rendering process in these tests. We also assume that Swagger has a way of
        // validating the swagger.yaml that we provide, since that is also not tested.
        const app = express();
        const { Utils } = index('core', app, dirs);
        Utils.buildAPIDocs(path.join(srcDir, '..', 'test', 'resources', 'swagger.yaml'),
            path.join(srcDir, '..', 'package.json'));
        const res = await request(app).get('/api-docs/');
        expect(res.text).toContain('<title>Swagger UI</title>');
    });

    it('should be generating documentation using the swagger.yaml that is provided', async () => {
        const app = express();
        const { Utils } = index('core', app, dirs);
        Utils.buildAPIDocs(path.join(srcDir, '..', 'test', 'resources', 'swagger.yaml'),
            path.join(srcDir, '..', 'package.json'));
        const res = await request(app).get('/api-docs/swagger-ui-init.js');
        expect(res.text).toContain('"title": "Test Swagger"');
    });

    it('should not be generating documentation using the swagger.yaml when package.json is not found', async () => {
        const app = express();
        const { Utils } = index('core', app, dirs);
        const spy = jest.spyOn(global.console, 'warn');
        Utils.buildAPIDocs(path.join(srcDir, '..', 'test', 'resources', 'swagger.yaml'),
            path.join('dummyDir', 'package.json'));
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
        const res = await request(app).get('/api-docs/swagger-ui-init.js');
        expect(res.text).not.toContain('"title": "Test Swagger"');
    });

    it('should be replacing content on Swagger using package.json', async () => {
        // There is no easy way to determine how many things are being replaced, so
        // we rely on the developers to update this test case with any new fields they
        // reference.
        const app = express();
        const { Utils } = index('core', app, dirs);
        const pjsonPath = path.join(srcDir, '..', 'package.json');
        const pjson = require(pjsonPath);
        Utils.buildAPIDocs(path.join(srcDir, '..', 'test', 'resources', 'swagger.yaml'), pjsonPath);
        const res = await request(app).get('/api-docs/swagger-ui-init.js');
        expect(res.text).toContain('"version": "' + pjson.version + '"');
        expect(res.text).toContain('"email": "' +
            pjson.author.substring(pjson.author.indexOf('<') + 1, pjson.author.indexOf('>')) + '"');
        expect(res.text).toContain('"name": "' + pjson.license + ' License"');
    });

    it('should be extending documentation using the swagger-extensions.yaml that is provided', async () => {
        const app = express();
        const { Utils } = index('core', app, dirs);
        Utils.buildAPIDocs(path.join(srcDir, '..', 'test', 'resources', 'swagger.yaml'),
            path.join(srcDir, '..', 'package.json'), path.join(srcDir, '..', 'test', 'resources', 'swagger-extensions.yaml'));
        const res = await request(app).get('/api-docs/swagger-ui-init.js');
        expect(res.text).toContain('"name": "operation"');
        expect(res.text).toContain('"/operation/dummy"');
    });

    it('should not be extending documentation using a swagger-extensions.yaml that cannot be found', async () => {
        const app = express();
        const { Utils } = index('core', app, dirs);
        Utils.buildAPIDocs(path.join(srcDir, '..', 'test', 'resources', 'swagger.yaml'),
            path.join(srcDir, '..', 'package.json'), path.join(srcDir, '..', 'test', 'resources', 'swagger-fake-extensions.yaml'));
        const res = await request(app).get('/api-docs/swagger-ui-init.js');
        expect(res.text).not.toContain('"name": "operation"');
        expect(res.text).not.toContain('"/operation/dummy"');
    });

    it('should expose jQuery', async () => {
        const app = express();
        const { Utils } = index('core', app, dirs);
        Utils.registerRoutesForContent();
        const res = await request(app).get('/jquery.min.js');
        expect(res.text).toContain(fs.readFileSync(path.join(dirs.nodeModules, 'jquery', 'dist', 'jquery.min.js')));
    });

    it('should expose HTML and replace __OVETYPE__ appropriately', async () => {
        const app = express();
        const { Utils } = index('core', app, dirs);
        Utils.registerRoutesForContent();
        let res = await request(app).get('/view.html');
        expect(res.text).toContain('test.view.js');
        expect(res.text).toContain('test.view.css');
        expect(res.text).not.toContain('test.control.js');
        expect(res.text).not.toContain('test.control.css');

        res = await request(app).get('/control.html');
        expect(res.text).not.toContain('test.view.js');
        expect(res.text).not.toContain('test.view.css');
        expect(res.text).toContain('test.control.js');
        expect(res.text).toContain('test.control.css');

        res = await request(app).get('/index.html');
        expect(res.text).toContain('test.view.js');
        expect(res.text).toContain('test.view.css');
        expect(res.text).not.toContain('test.control.js');
        expect(res.text).not.toContain('test.control.css');
    });

    it('should expose JS and CSS appropriately', async () => {
        const app = express();
        const newDirs = {
            base: dirs.base,
            nodeModules: dirs.nodeModules,
            constants: path.join(srcDir, '..', 'test', 'resources', 'client', 'constants')
        };
        const { Utils } = index('dummy', app, newDirs);
        Utils.registerRoutesForContent();
        let res = await request(app).get('/dummy.view.js');
        expect(res.text).toContain('initView');
        expect(res.text).toContain('initCommon');
        expect(res.text).toContain('DUMMY_DUMMY');
        expect(res.text).not.toContain('initControl');

        res = await request(app).get('/dummy.control.js');
        expect(res.text).toContain('initControl');
        expect(res.text).toContain('initCommon');
        expect(res.text).toContain('DUMMY_DUMMY');
        expect(res.text).not.toContain('initView');

        res = await request(app).get('/dummy.view.css');
        expect(res.text).toContain('.view');
        expect(res.text).toContain('.common');
        expect(res.text).not.toContain('DUMMY_DUMMY');
        expect(res.text).not.toContain('.control');

        res = await request(app).get('/dummy.control.css');
        expect(res.text).toContain('.control');
        expect(res.text).toContain('.common');
        expect(res.text).not.toContain('DUMMY_DUMMY');
        expect(res.text).not.toContain('.view');
    });

    it('should skip JS/CSS files that are not provided', async () => {
        const app = express();
        const newDirs = {
            base: dirs.base,
            nodeModules: dirs.nodeModules,
            constants: path.join(srcDir, '..', 'test', 'resources', 'client', 'constants')
        };
        const { Utils } = index('foo', app, newDirs);
        Utils.registerRoutesForContent();
        let res = await request(app).get('/foo.control.js');
        expect(res.text).toContain('initControl');
        expect(res.text).not.toContain('initCommon');
        expect(res.text).not.toContain('DUMMY_DUMMY');
        expect(res.text).not.toContain('initView');

        res = await request(app).get('/foo.view.css');
        expect(res.text).toContain('.view');
        expect(res.text).not.toContain('.common');
        expect(res.text).not.toContain('DUMMY_DUMMY');
        expect(res.text).not.toContain('.control');
    });

    it('should route / to index.html when rootPage is not provided', async () => {
        const app = express();
        const { Utils } = index('core', app, dirs);
        Utils.registerRoutesForContent();
        let resRoot = await request(app).get('/');
        let resIndexHTML = await request(app).get('/index.html');
        expect(resRoot.text).toContain(resIndexHTML.text);
    });

    it('should not route / to index.html when rootPage is provided', async () => {
        const app = express();
        const newDirs = {
            base: dirs.base,
            nodeModules: dirs.nodeModules,
            constants: dirs.constants,
            rootPage: path.join(dirs.base, 'client', 'root.html')
        };
        const { Utils } = index('core', app, newDirs);
        Utils.registerRoutesForContent();
        let resRoot = await request(app).get('/');
        let resIndexHTML = await request(app).get('/index.html');
        expect(resRoot.text).not.toContain(resIndexHTML.text);
        expect(resRoot.text).toContain(fs.readFileSync(newDirs.rootPage));
    });

    it('should only expose files that are allowed', async () => {
        // Our list of 'should not be founds' is very limited to some very well
        // known paths, developers should add any other files to this list, as
        // needed.
        const app = express();
        const newDirs = {
            base: dirs.base,
            nodeModules: dirs.nodeModules,
            constants: dirs.constants,
            rootPage: path.join(dirs.base, 'client', 'root.html')
        };
        const { Utils } = index('foo', app, newDirs);
        Utils.registerRoutesForContent();
        let resRoot = await request(app).get('/');
        let resRootHTML = await request(app).get('/root.html');
        expect(resRootHTML.text).not.toContain(resRoot.text);
        expect(resRootHTML.statusCode).toEqual(HttpStatus.NOT_FOUND);

        let res = await request(app).get('/dummy.view.js');
        expect(res.statusCode).toEqual(HttpStatus.NOT_FOUND);

        res = await request(app).get('/dummy.control.js');
        expect(res.statusCode).toEqual(HttpStatus.NOT_FOUND);

        res = await request(app).get('/dummy.view.css');
        expect(res.statusCode).toEqual(HttpStatus.NOT_FOUND);

        res = await request(app).get('/dummy.control.css');
        expect(res.statusCode).toEqual(HttpStatus.NOT_FOUND);

        res = await request(app).get('/foo.test.css');
        expect(res.statusCode).toEqual(HttpStatus.NOT_FOUND);

        res = await request(app).get('/foo.index.js');
        expect(res.statusCode).toEqual(HttpStatus.NOT_FOUND);

        res = await request(app).get('/index.js');
        expect(res.statusCode).toEqual(HttpStatus.NOT_FOUND);

        res = await request(app).get('/constants.js');
        expect(res.statusCode).toEqual(HttpStatus.NOT_FOUND);

        res = await request(app).get('/foo.view.css');
        expect(res.statusCode).not.toEqual(HttpStatus.NOT_FOUND);

        res = await request(app).get('/foo.control.js');
        expect(res.statusCode).not.toEqual(HttpStatus.NOT_FOUND);
    });
    /* jshint ignore:end */
});
