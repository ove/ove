const path = require('path');
const fs = require('fs');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const yamljs = require('js-yaml');
const chalk = require('chalk');
const dateFormat = require('dateformat');
const HttpStatus = require('http-status-codes');
const Persistence = require('./persistence');
const { Constants } = require('./constants');

// A collection of utilities for OVE and OVE apps. It is generally not
// required if the OVE App Base Library is used to build an app. The input
// parameters of this module include:
//    1. The express app instance.
//    2. The name of the app (OVE Core uses 'core').
//    3. A list of directories:
//        1. The base directory (generally __dirname)
//        2. The location of the node_modules directory
//        3. The location of additional app-specific constants.js
//        4. [optional] The location of the page to use as '/'
function Utils (appName, app, dirs) {
    /**************************************************************
                           Utilities for JSON
    **************************************************************/
    this.JSON = {};
    this.JSON.equals = function (param1, param2) {
        return JSON.stringify(param1) === JSON.stringify(param2);
    };
    this.JSON.getDescendant = function getDescendant (input, obj) {
        if (!obj) {
            return undefined;
        }

        const nameSeparator = input.indexOf('.');
        if (nameSeparator === -1) {
            return obj[input];
        }
        return getDescendant(input.substring(nameSeparator + 1), obj[input.substring(0, nameSeparator)]);
    };
    this.JSON.EMPTY = JSON.stringify({});
    this.JSON.EMPTY_ARRAY = JSON.stringify([]);

    /**************************************************************
                           Logging Functions
    **************************************************************/
    this.Logger = function (name) {
        return new OVELogger(name);
    };
    // Instance of logger for the use of OVE.Utils
    const log = this.Logger('OVEUtils');

    function OVELogger (name) {
        // The logger name is stored for later use.
        let __private = { name: name };

        // Internal Utility function to get log labels
        const getLogLabel = function (logLevel) {
            return chalk.bgHex(logLevel.label.bgColor).hex(logLevel.label.color).bold;
        };

        // Internal Utility function to build log messages.
        const buildLogMessage = function (logLevel, args) {
            const time = dateFormat(new Date(), 'dd/mm/yyyy, h:MM:ss.l tt');
            // Each logger can have its own name. If this is
            // not provided, it will default to Unknown.
            const loggerName = __private.name || Constants.LOG_UNKNOWN_APP_ID;
            return [ (logLevel.name.length === 4 ? ' ' : '') +
                getLogLabel(logLevel)('[' + logLevel.name + ']'), time, '-',
            loggerName.padEnd(Constants.LOG_APP_ID_WIDTH), ':'].concat(Object.values(args));
        };

        // Expose a function for each log-level
        (function (__self) {
            Constants.LogLevel.forEach(function (level, i) {
                __self[level.name.toLowerCase()] = function () {
                    if (Constants.LOG_LEVEL >= i) {
                        // All log functions accept any number of arguments
                        console[level.consoleLogger].apply(console, buildLogMessage(level, arguments));
                    }
                };
            });
        })(this);
    }

    /**************************************************************
                              Persistence
    **************************************************************/
    this.registerRoutesForPersistence = function () {
        log.debug('Registering routes for persistence');
        let __self = this;
        let __private = { provider: null, local: {}, interval: null };

        const setProvider = function (req, res) {
            if (!req.body.url) {
                log.error('Invalid request,', 'got:', JSON.stringify(req.body));
                __self.sendMessage(res, HttpStatus.BAD_REQUEST,
                    JSON.stringify({ error: 'invalid request' }));
            } else {
                __private.provider = req.body.url;
                if (__private.interval) {
                    clearInterval(__private.interval);
                    __private.interval = null;
                }
                const interval = Constants.PERSISTENCE_SYNC_INTERVAL;
                if (interval > 0) {
                    __private.interval = setInterval(__self.Persistence.sync, interval);
                }
                __self.sendEmptySuccess(res);
            }
        };

        const removeProvider = function (_req, res) {
            if (__private.interval) {
                clearInterval(__private.interval);
                __private.interval = null;
            }
            if (__private.provider) {
                __private.provider = null;
            }
            __self.sendEmptySuccess(res);
        };

        app.post('/persistence', setProvider);
        app.delete('/persistence', removeProvider);
        __self.Persistence = Persistence(appName, log, __self, Constants, __private);
    };

    /**************************************************************
                     Static Content/Docs Generation
    **************************************************************/
    this.registerRoutesForContent = function () {
        log.debug('Registering routes for content pages');
        const showRoot = !!dirs.rootPage;
        // If a rootPage parameter is provided, '/' will redirect to the rootPage.
        if (showRoot) {
            log.debug('Got root page:', dirs.rootPage);
            app.get('/', function (_req, res) {
                res.sendFile(dirs.rootPage);
            });
        }

        // Each CSS file is combination of {type}/{name}.css and common/{name}.css.
        // Each JS file is combination of {type}/{name}.js, common/{name}.js and
        // constants/{name}.js files from the filesystem.
        app.use('/' + appName + '.:type(view|control).:fileType(js|css)', function (req, res) {
            let text = '';
            const type = req.params.type === 'control' ? 'control' : 'view';
            const fileName = appName + '.' + req.params.fileType;
            for (const context of ['common', type]) {
                const fp = path.join(dirs.base, 'client', context, fileName);
                if (fs.existsSync(fp)) {
                    text += fs.readFileSync(fp, Constants.UTF8);
                }
            }
            let cType;
            switch (req.params.fileType) {
                case 'js':
                    text = 'const Constants = ' + JSON.stringify(module.exports.Constants) + ';\n' + text;
                    cType = Constants.HTTP_CONTENT_TYPE_JS;
                    break;
                case 'css':
                    cType = Constants.HTTP_CONTENT_TYPE_CSS;
                    break;
                /* istanbul ignore next */
                default:
                    // This should not happen since the fileType is either CSS or JS.
            }
            res.set(Constants.HTTP_HEADER_CONTENT_TYPE, cType).send(text);
        });

        // Each app can serve view, control or index HTML pages. If a rootPage is provided '/'
        // will redirect to that, if not, it will redirect to view.html. The index.html page
        // also redirects to the view.html page. It must also be noted that neither view.html
        // or control.html exists on the filesystem and the same index.html file is served for
        // both of these scenarios. The index.html file is therefore a common template for both
        // viewer and controller.
        app.use((!showRoot ? '/(' : '/') + ':type(index|control|view).html' +
            (!showRoot ? ')?' : ''), function (req, res) {
            res.send(fs.readFileSync(path.join(dirs.base, 'client', 'index.html'), Constants.UTF8)
                .replace(Constants.RegExp.OVE_TYPE, req.params.type === 'control' ? 'control' : 'view')
                .replace(Constants.RegExp.OVE_HOST, module.exports.Utils.getOVEHost()));
        });
        app.use('/', express.static(path.join(dirs.nodeModules, 'jquery', 'dist')));
    };

    this.buildAPIDocs = function (swaggerPath, packagePath, swaggerExtPath) {
        if (!fs.existsSync(packagePath)) {
            log.warn('Failed to build Swagger API documentation, as package.json does not exist at path:', packagePath);
            return;
        }
        log.debug('Building Swagger API documentation');
        // Swagger API documentation
        let swaggerDoc = (function (swagger, pjson) {
            swagger.info.title = swagger.info.title.replace(Constants.RegExp.Annotation.NAME, pjson.name);
            swagger.info.version = swagger.info.version.replace(Constants.RegExp.Annotation.VERSION, pjson.version);
            swagger.info.license.name = swagger.info.license.name.replace(Constants.RegExp.Annotation.LICENSE, pjson.license);
            // Extract e-mail address from format within package.json
            swagger.info.contact.email = swagger.info.contact.email.replace(Constants.RegExp.Annotation.AUTHOR,
                pjson.author.substring(pjson.author.indexOf('<') + 1, pjson.author.indexOf('>')));
            return swagger;
        })(yamljs.safeLoad(fs.readFileSync(swaggerPath)), require(packagePath));

        // App-specific swagger extensions
        if (arguments.length > 2 && swaggerExtPath) {
            (function (swaggerDoc, swaggerExt) {
                if (fs.existsSync(swaggerExt)) {
                    let swagger = yamljs.safeLoad(fs.readFileSync(swaggerExt));
                    // Copying tags (which is an array)
                    swagger.tags.forEach(function (e) {
                        swaggerDoc.tags.push(e);
                    });
                    // Copying paths (which are properties of the paths object)
                    Object.keys(swagger.paths).forEach(function (e) {
                        swaggerDoc.paths[e] = swagger.paths[e];
                    });
                }
            })(swaggerDoc, swaggerExtPath);
        }

        app.use(Constants.SWAGGER_API_DOCS_CONTEXT, swaggerUi.serve, swaggerUi.setup(swaggerDoc, {

            swaggerOptions: {
                defaultModelsExpandDepth: -1
            }
        }));
    };

    /**************************************************************
                        Other Utility Functions
    **************************************************************/
    this.getOVEHost = function () {
        let host = process.env.OVE_HOST;
        if (host) {
            if (host.indexOf('//') >= 0) {
                host = host.substring(host.indexOf('//') + 2);
            }
            if (host.indexOf('/') >= 0) {
                host = host.substring(0, host.indexOf('/'));
            }
        }
        return host;
    };

    this.getSafeSocket = function (socket) {
        // We check if the WebSocket object already has a safeSend method associated with it's
        // prototype, we add it only if it does not exist. The safeSend method is introduced by
        // OVE, so it is impossible for the WebSocket to have it unless OVE introduced it.
        if (!Object.getPrototypeOf(socket).safeSend) {
            log.debug('Extending Prototype of WebSocket');
            // The safeSend method simply wraps the send method with a try-catch. We could avoid
            // doing this and introduce a try-catch whenever we send a message to introduce a
            // utility. This approach is a bit neater than that, since the code is easier to
            // follow as a result.
            Object.getPrototypeOf(socket).safeSend = function (msg) {
                try {
                    this.send(msg);
                } catch (e) {
                    if (this.readyState === Constants.WEBSOCKET_READY) {
                        log.error('Error sending message:', e.message);
                    }
                    // ignore all other errors, since there is no value in recording them.
                }
            };
        }
        return socket;
    };

    this.sendMessage = function (res, status, msg) {
        res.status(status).set(Constants.HTTP_HEADER_CONTENT_TYPE, Constants.HTTP_CONTENT_TYPE_JSON).send(msg);
    };

    // We don't want to see browser errors, so we send an empty success response in some cases.
    this.sendEmptySuccess = function (res) {
        this.sendMessage(res, HttpStatus.OK, this.JSON.EMPTY);
    };

    this.isNullOrEmpty = function (input) {
        return !input || this.JSON.equals(input, {}) || this.JSON.equals(input, []);
    };
}

/**************************************************************
                        Module Exports
**************************************************************/
module.exports = function (appName, app, dirs) {
    // Exporting the Utility functions.
    module.exports.Utils = new Utils(appName, app, dirs);

    // Constants are defined as follows:
    //    1. System-wide within @ove-lib/utils
    //    2. Within OVE Core as a part of client utilities
    //    3. Within each app as a part of client constants
    // But, some apps may not be having specific constants of their own, and simply depend on the
    // system-wide constants. The following code supports all of the above combinations.
    if (!dirs) {
        module.exports.Constants = Constants;
        return module.exports;
    }
    const constantsFile = path.join(dirs.constants, (appName === 'core' ? 'constants' : appName) + '.js');
    if (fs.existsSync(constantsFile)) {
        module.exports.Constants = Object.assign({}, Constants, require(constantsFile).Constants);
    } else {
        module.exports.Constants = Constants;
    }

    return module.exports;
};
