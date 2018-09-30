const path = require('path');
const fs = require('fs');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const yamljs = require('yamljs');
const { Constants } = require('./constants');

// A collection of utilities for OVE and OVE applications. It is generally
// not required module if OVE App Base Library is used to build an app. The
// input parameters of this module include:
//    1. The express app instance.
//    2. The name of the application (OVE Core uses 'core').
//    3. A list of directories:
//        1. The base directory (generally __dirname)
//        2. The location of the node_modules directory
//        3. The location of additional app-specific constants.js
//        4. [optional] The location of the page to use as '/'
function Utils (app, appName, dirs) {
    this.registerRoutesForContent = function () {
        const showRoot = !!dirs.rootPage;
        // If a rootPage parameter is provided, '/' will redirect to the rootPage.
        if (showRoot) {
            app.get('/', function (_req, res) {
                res.sendFile(dirs.rootPage);
            });
        }

        // Each CSS file is combination of {type}/{name}.css and common/{name}.css.
        // Each JS file is combination of {type}/{name}.js, common/{name}.js and
        // constants/{name}.js files from the filesystem.
        app.use('/' + appName + '.:type.:fileType(js|css)', function (req, res) {
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
                    /* const fp = path.join(dirs.constants, (appName === 'core' ? 'constants' : appName) + '.js');
                    if (fs.existsSync(fp)) {
                        text = fs.readFileSync(fp, Constants.UTF8)
                            // Remove export statement for use in web-browser.
                            .replace('exports.Constants = Constants;', '')
                            // Remove all comments matching pattern
                            .replace(Constants.RegExp.ES5_COMMENT_PATTERN, '') + text;
                    } */
                    cType = Constants.HTTP_CONTENT_TYPE_JS;
                    break;
                case 'css':
                    cType = Constants.HTTP_CONTENT_TYPE_CSS;
                    break;
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
                .replace(Constants.RegExp.OVE_HOST, process.env.OVE_HOST));
        });
        app.use('/', express.static(path.join(dirs.nodeModules, 'jquery', 'dist')));
    };

    this.buildAPIDocs = function (swaggerPath, packagePath, swaggerExtPath) {
        // Swagger API documentation
        let swaggerDoc = (function (swagger, pjson) {
            swagger.info.title = swagger.info.title.replace(Constants.RegExp.Annotation.NAME, pjson.name);
            swagger.info.version = swagger.info.version.replace(Constants.RegExp.Annotation.VERSION, pjson.version);
            swagger.info.license.name = swagger.info.license.name.replace(Constants.RegExp.Annotation.LICENSE, pjson.license);
            // Extract e-mail address from format within package.json
            swagger.info.contact.email = swagger.info.contact.email.replace(Constants.RegExp.Annotation.AUTHOR,
                pjson.author.substring(pjson.author.indexOf('<') + 1, pjson.author.indexOf('>')));
            return swagger;
        })(yamljs.load(swaggerPath), require(packagePath));

        // App-specific swagger extensions
        if (arguments.length > 2 && swaggerExtPath) {
            (function (swaggerDoc, swaggerExt) {
                if (fs.existsSync(swaggerExt)) {
                    let swagger = yamljs.load(swaggerExt);
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
}

module.exports = function (app, appName, dirs) {
    // Constants are defined as follows:
    //    1. System-wide within @ove/ove-lib-utils
    //    2. Within OVE Core as a part of client utilities
    //    3. Within each app as a part of client constants
    // But, some apps may not be having specific constants of their own, and simply depend on the
    // system-wide constants. The following code supports all of the above combinations.
    const constantsFile = path.join(dirs.constants, (appName === 'core' ? 'constants' : appName) + '.js');
    if (fs.existsSync(constantsFile)) {
        module.exports.Constants = Object.assign({}, Constants, require(constantsFile).Constants);
    } else {
        module.exports.Constants = Constants;
    }

    // Exporting the Utility functions.
    module.exports.Utils = new Utils(app, appName, dirs);

    return module.exports;
};
