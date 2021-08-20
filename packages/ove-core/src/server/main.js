const path = require('path');
const fs = require('fs');
const uglify = require('uglify-js');
const pjson = require(path.join('..', '..', 'package.json')); // this path might have to be fixed based on packaging

module.exports = function (app, wss, spaces, log, Utils, Constants) {
    this.spaces = spaces;
    this.wss = wss;
    this.app = app;

    /**************************************************************
                            OVE Extensions
    **************************************************************/
    (function (add) {
        // We get hold of the WebSocket object's prototype within the add method. This is because
        // WebSockets are created within a module and the only way that we can extend that specific
        // instantiation of the object is to extend an object that has been created from within the
        // module. So, first of all we extend the add method to achieve what we want.
        Object.getPrototypeOf(wss.clients).add = function (i) {
            add.bind(wss.clients)(Utils.getSafeSocket(i));
        };
    }(Object.getPrototypeOf(wss.clients).add));

    /**************************************************************
                         OVE Client Library
    **************************************************************/
    const generateOVEClientLibrary = function () {
        log.debug('Generating OVE.js');
        // OVE.js is a combination of client/ove.js client/utils/utils.js and client/utils/constants.js
        let text = fs.readFileSync(path.join(__dirname, '..', 'client', 'ove.js'), Constants.UTF8);
        text += fs.readFileSync(path.join(__dirname, '..', 'client', 'utils', 'utils.js'), Constants.UTF8);
        // Important thing to note here is that the output is minified using UglifyJS. This library
        // only supports ES5. Therefore some newer JS capabilities may not work. And, if there was a
        // newer JS capability used in any of the files included in OVE.js, UglifyJS will produce an
        // empty file. This can be observed by reviewing corresponding errors on the browser.
        return uglify.minify(text
            // Inject constants
            .replace(/\/\/ @CONSTANTS/g, 'var Constants = ' + JSON.stringify(Constants) + ';')
            .replace(Constants.RegExp.Annotation.VERSION, pjson.version)
            .replace(Constants.RegExp.Annotation.LICENSE, pjson.license)
            .replace(Constants.RegExp.Annotation.AUTHOR, pjson.author)
            // Replace all let/const with var for ES5 compliance
            .replace(/(let|const)/g, 'var')
            // Remove all comments matching pattern
            .replace(Constants.RegExp.ES5_COMMENT_PATTERN, ''), { output: { comments: true } }).code;
    };
    // Cache OVE.js to avoid overheads in repeatedly generating on a per-request basis.
    const oveJS = generateOVEClientLibrary();
    app.get('/ove.js', function (_req, res) {
        res.set(Constants.HTTP_HEADER_CONTENT_TYPE, Constants.HTTP_CONTENT_TYPE_JS).send(oveJS);
    });

    /**************************************************************
                        OVE Core functionality
    **************************************************************/
    // Static content
    Utils.registerRoutesForContent(pjson);

    // Persistence
    Utils.registerRoutesForPersistence();
    this.state = Utils.Persistence;
    this.state.set('sections', []);
    this.state.set('groups', []);
    this.state.set('connections', []);
    this.state.set('servers', []);

    // Clock synchronisation
    this.clock = require(path.join(__dirname, 'clock'))(this, log, Constants);
    setInterval(this.clock.sync, Constants.CLOCK_SYNC_INTERVAL);

    // Peers
    this.peers = require(path.join(__dirname, 'peers'))(this, log, Utils, Constants);

    const ApiUtils = require(path.join(__dirname, 'api-utils'))(this, log, Utils);

    // Messaging middleware
    app.ws('/', require(path.join(__dirname, 'messaging'))(this, log, Constants));

    // APIs
    require(path.join(__dirname, 'api'))(this, log, Utils, Constants, ApiUtils);

    return this;
};
