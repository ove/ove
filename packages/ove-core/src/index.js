const path = require('path');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const request = require('request');
const HttpStatus = require('http-status-codes');
const uglify = require('uglify-js');
const app = express();
const wss = require('express-ws')(app).getWss('/');
const pjson = require(path.join('..', 'package.json')); // this path might have to be fixed based on packaging
const dirs = {
    base: __dirname,
    nodeModules: path.join(__dirname, '..', '..', '..', 'node_modules'),
    constants: path.join(__dirname, 'client', 'utils'),
    rootPage: path.join(__dirname, 'blank.html')
};
const { Constants, Utils } = require('@ove/ove-lib-utils')(app, 'core', dirs);
const clients = JSON.parse(fs.readFileSync(path.join(__dirname, 'client', Constants.CLIENTS_JSON_FILENAME)));

const __DEBUG__ = true;

app.use(cors());
app.use(express.json());

/**************************************************************
                        OVE Extensions
**************************************************************/
(function (add) {
    // We get hold of the WebSocket object's prototype within the add method. This is because
    // WebSockets are created within a module and the only way that we can extend that specific
    // instantiation of the object is to extend an object that has been created from within the
    // module. So, first of all we extend the add method to achieve what we want.
    Object.getPrototypeOf(wss.clients).add = function (i) {
        // Then we check if the object that is being added already has a safeSend method
        // associated with it's prototype, we add it only if it does not exist. The safeSend
        // method is introduced by OVE, so it is impossible for the WebSocket to have it unless
        // OVE introduced it.
        if (!Object.getPrototypeOf(i).safeSend) {
            // The safeSend method simply wraps the send method with a try-catch. We could avoid
            // doing this and introduce a try-catch whenever we send a message to introduce a
            // utility. This approach is a bit neater than that, since the code is easier to
            // follow as a result.
            Object.getPrototypeOf(i).safeSend = function (msg) {
                try {
                    this.send(msg);
                } catch (e) {
                    if (this.readyState === Constants.WEBSOCKET_READY) {
                        console.error('error sending message' + e.message);
                    }
                    // ignore all other errors, since there is no value in recording them.
                }
            };
        }
        add.bind(wss.clients)(i);
    };
}(Object.getPrototypeOf(wss.clients).add));

/**************************************************************
                      OVE Client Library
**************************************************************/
app.get('/ove.js', function (req, res) {
    // OVE.js is a combination of client/ove.js client/utils/utils.js and client/utils/constants.js
    let text = fs.readFileSync(path.join(__dirname, 'client', 'ove.js'), Constants.UTF8);
    text += fs.readFileSync(path.join(__dirname, 'client', 'utils', 'utils.js'), Constants.UTF8);
    const constantsPath = path.join(__dirname, 'client', 'utils', 'constants.js');
    const constants = fs.readFileSync(constantsPath, Constants.UTF8).replace('exports.Constants = Constants;', '');
    // Important thing to note here is that the output is minified using UglifyJS. This library
    // only supports ES5. Therefore some newer JS capabilities may not work. And, if there was a
    // newer JS capability used in any of the files included in OVE.js, UglifyJS will produce an
    // empty file. This can be observed by reviewing corresponding errors on the browser.
    res.set(Constants.HTTP_HEADER_CONTENT_TYPE, Constants.HTTP_CONTENT_TYPE_JS).send(uglify.minify(text
        // Inject constants
        .replace(/\/\/ @CONSTANTS/, constants)
        .replace(Constants.RegExp.DEBUG, __DEBUG__)
        .replace(Constants.RegExp.Annotation.VERSION, pjson.version)
        .replace(Constants.RegExp.Annotation.LICENSE, pjson.license)
        .replace(Constants.RegExp.Annotation.AUTHOR, pjson.author)
        // Replace all let/const with var for ES5 compliance
        .replace(/(let|const)/g, 'var')
        // Remove all comments matching pattern
        .replace(Constants.RegExp.ES5_COMMENT_PATTERN, ''), { output: { comments: true } }).code
    );
});

/**************************************************************
                   Static Content of OVE Core
**************************************************************/
Utils.registerRoutesForContent();

/**************************************************************
                    APIs Exposed by OVE Core
**************************************************************/
var sections = [];

const sendMessage = function (res, status, msg) {
    res.status(status).set(Constants.HTTP_HEADER_CONTENT_TYPE, Constants.HTTP_CONTENT_TYPE_JSON).send(msg);
};

// We don't want to see browser errors, so we send an empty success response in some cases.
const sendEmptySuccess = function (res) {
    sendMessage(res, HttpStatus.OK, JSON.stringify({}));
};

const listClients = function (_req, res) {
    sendMessage(res, HttpStatus.OK, JSON.stringify(clients));
};

const listClientById = function (req, res) {
    let sectionId = req.params.id;
    if (!sections[sectionId]) {
        sendEmptySuccess(res);
    } else {
        sendMessage(res, HttpStatus.OK, JSON.stringify(sections[sectionId].clients));
    }
};

// Creates an individual section
const createSection = function (req, res) {
    if (!req.body.space || !clients[req.body.space]) {
        sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid space' }));
    } else if (req.body.w === undefined || req.body.h === undefined || req.body.x === undefined || req.body.y === undefined) {
        sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid dimensions' }));
    } else {
        let section = { w: req.body.w, h: req.body.h, clients: {} };
        section.clients[req.body.space] = [];

        // Calculate the dimensions on a client-by-client basis
        clients[req.body.space].forEach(function (e) {
            // Below are the list of conditions evaluated:
            //     1. Does the section begin at a point before the ending point of the client
            //        along the horizontal axis.
            //     2. Does the section end after the starting point of the client along the
            //        horizontal axis.
            //     3. Does the section begin at a point before the ending point of the client
            //        along the vertical axis.
            //     4. Does the section end after the starting point of the client along the
            //        vertical axis.
            // this will tell us whether a client coincides with the dimensions of a section
            // or not. And, if it does not, we simply discard it.
            if ((e.x + e.w) > req.body.x && (req.body.x + req.body.w) > e.x &&
                (e.y + e.h) > req.body.y && (req.body.y + req.body.h) > e.y) {
                let c = Object.assign({}, e);
                // We generally don't use offsets, but this can be used to move content relative
                // to top-left both in the positive and negative directions. If the offsets were
                // not set (the most common case), we initialize it to (0,0).
                if (!c.offset) {
                    c.offset = { x: 0, y: 0 };
                }
                // In here we check if the section started before the starting point of a client
                // and adjust it accordingly along the horizontal axis. If it wasn't the case, the
                // section starts within the bounds of a client and therefore the offset is being
                // set.
                if (c.x >= req.body.x) {
                    c.x -= req.body.x;
                } else {
                    c.offset.x += (req.body.x - c.x);
                    c.x = 0;
                    c.w -= c.offset.x;
                }
                // In here we check if the section ends before the ending point of the client and
                // adjust the width of the frame along the horizontal axis.
                if (c.x + c.w > req.body.w) {
                    c.w = (req.body.w - c.x);
                }
                // In here we check if the section started before the starting point of a client
                // and adjust it accordingly along the vertical axis. If it wasn't the case, the
                // section starts within the bounds of a client and therefore the offset is being
                // set.
                if (c.y >= req.body.y) {
                    c.y -= req.body.y;
                } else {
                    c.offset.y += (req.body.y - c.y);
                    c.y = 0;
                    c.h -= c.offset.y;
                }
                // In here we check if the section ends before the ending point of the client and
                // adjust the width of the frame along the vertical axis.
                if (c.y + c.h > req.body.h) {
                    c.h = (req.body.h - c.y);
                }
                section.clients[req.body.space].push(c);
            } else {
                section.clients[req.body.space].push({});
            }
        });

        // Deploy an App into a section
        let sectionId = sections.length;
        if (req.body.app) {
            section.app = { 'url': req.body.app.url.replace(/\/$/, '') };
            if (req.body.app.states) {
                // Cache or load states if they were provided as a part of the create request.
                if (req.body.app.states.cache) {
                    Object.keys(req.body.app.states.cache).forEach(function (name) {
                        request.post(section.app.url + '/state/' + name, {
                            headers: { 'Content-Type': Constants.HTTP_CONTENT_TYPE_JSON },
                            json: req.body.app.states.cache[name]
                        });
                    });
                }
                if (req.body.app.states.load) {
                    // Either a named state or an in-line state configuration can be loaded.
                    if (typeof req.body.app.states.load === 'string' || req.body.app.states.load instanceof String) {
                        section.app.state = req.body.app.states.load;
                    } else {
                        request.post(section.app.url + '/' + sectionId + '/state', {
                            headers: { 'Content-Type': Constants.HTTP_CONTENT_TYPE_JSON },
                            json: req.body.app.states.load
                        });
                    }
                }
            }
        }
        sections[sectionId] = section;

        // Notify OVE viewers/controllers
        wss.clients.forEach(function (c) {
            if (c.readyState === Constants.WEBSOCKET_READY) {
                // Sections are created on the browser and then the application is deployed after a
                // short delay. This will ensure proper frame sizes.
                c.safeSend(JSON.stringify({ appId: Constants.APP_NAME,
                    message: { action: Constants.Action.CREATE, id: sectionId, clients: section.clients } }));
                if (section.app) {
                    setTimeout(function () {
                        c.safeSend(JSON.stringify({ appId: Constants.APP_NAME,
                            message: { action: Constants.Action.UPDATE, id: sectionId, app: section.app } }));
                    }, Constants.SECTION_UPDATE_DELAY);
                }
            }
        });
        if (__DEBUG__) {
            console.log('active sections: ' + sections.length);
        }
        sendMessage(res, HttpStatus.OK, JSON.stringify({ id: sectionId }));
    }
};

// Deletes all sections
const deleteSections = function (_req, res) {
    while (sections.length !== 0) {
        let section = sections.pop();
        if (section.app) {
            request.post(section.app.url + '/flush');
        }
    }
    if (__DEBUG__) {
        console.log('active sections: ' + sections.length);
    }
    wss.clients.forEach(function (c) {
        if (c.readyState === Constants.WEBSOCKET_READY) {
            c.safeSend(JSON.stringify({ appId: Constants.APP_NAME, message: { action: Constants.Action.DELETE } }));
        }
    });
    sendEmptySuccess(res);
};

// Fetches details of an individual section
const readSectionById = function (req, res) {
    let sectionId = req.params.id;
    if (!sections[sectionId]) {
        sendEmptySuccess(res);
    } else {
        let section = { id: sectionId, w: sections[sectionId].w, h: sections[sectionId].h };
        if (sections[sectionId].app && sections[sectionId].app.state) {
            section.state = sections[sectionId].app.state;
        }
        sendMessage(res, HttpStatus.OK, JSON.stringify(section));
    }
};

// Updates an individual section
const updateSectionById = function (req, res) {
    let sectionId = req.params.id;
    if (!sections[sectionId] || JSON.stringify(sections[sectionId]) === JSON.stringify({})) {
        sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid section id' }));
    } else {
        // Redeploys an App into a section
        let commands = [];
        if (sections[sectionId].app) {
            delete sections[sectionId].app;
            commands.push(JSON.stringify({ appId: Constants.APP_NAME, message: { action: Constants.Action.UPDATE, id: sectionId } }));
        }
        if (req.body.app) {
            sections[sectionId].app = { 'url': req.body.app.url.replace(/\/$/, '') };
            if (req.body.app.states) {
                // Cache or load states if they were provided as a part of the update request.
                if (req.body.app.states.cache) {
                    Object.keys(req.body.app.states.cache).forEach(function (name) {
                        request.post(sections[sectionId].app.url + '/state/' + name, {
                            headers: { 'Content-Type': Constants.HTTP_CONTENT_TYPE_JSON },
                            json: req.body.app.states.cache[name]
                        });
                    });
                }
                if (req.body.app.states.load) {
                    // Either a named state or an in-line state configuration can be loaded.
                    if (typeof req.body.app.states.load === 'string' || req.body.app.states.load instanceof String) {
                        sections[sectionId].app.state = req.body.app.states.load;
                    } else {
                        request.post(sections[sectionId].app.url + '/' + sectionId + '/state', {
                            headers: { 'Content-Type': Constants.HTTP_CONTENT_TYPE_JSON },
                            json: req.body.app.states.load
                        });
                    }
                }
            }
            commands.push(JSON.stringify({ appId: Constants.APP_NAME, message: { action: Constants.Action.UPDATE, id: sectionId, app: req.body.app } }));
        }

        // Notify OVE viewers/controllers
        wss.clients.forEach(function (c) {
            if (c.readyState === Constants.WEBSOCKET_READY) {
                commands.forEach(function (m) {
                    c.safeSend(m);
                });
            }
        });
        sendMessage(res, HttpStatus.OK, JSON.stringify({ id: sectionId }));
    }
};

// Deletes an individual section
const deleteSectionById = function (req, res) {
    let sectionId = req.params.id;
    if (!sections[sectionId] || JSON.stringify(sections[sectionId]) === JSON.stringify({})) {
        sendMessage(res, HttpStatus.BAD_REQUEST, JSON.stringify({ error: 'invalid section id' }));
    } else {
        let section = sections[sectionId];
        if (section.app) {
            request.post(section.app.url + '/flush');
        }
        delete sections[sectionId];
        sections[sectionId] = {};
        wss.clients.forEach(function (c) {
            if (c.readyState === Constants.WEBSOCKET_READY) {
                c.safeSend(JSON.stringify({ appId: Constants.APP_NAME, message: { action: Constants.Action.DELETE, id: sectionId } }));
            }
        });
        sendMessage(res, HttpStatus.OK, JSON.stringify({ id: sectionId }));
    }
};

app.get('/clients', listClients);
app.get('/client/:id', listClientById);
app.delete('/sections', deleteSections);
app.post('/section', createSection);
app.get('/section/:id', readSectionById);
app.post('/section/:id', updateSectionById);
app.delete('/section/:id', deleteSectionById);

// Swagger API documentation
Utils.buildAPIDocs(path.join(__dirname, 'swagger.yaml'), path.join('..', 'package.json'));

/**************************************************************
                   OVE Messaging Middleware
**************************************************************/
app.ws('/', function (s) {
    s.safeSend(JSON.stringify({ func: 'connect' }));
    s.on('message', function (msg) {
        let m = JSON.parse(msg);

        // Method for viewers to request section information, helps browser crash recovery
        if (m.appId === Constants.APP_NAME && m.message.action === Constants.Action.READ) {
            if (m.sectionId === undefined) {
                sections.forEach(function (section, sectionId) {
                    // We respond only to the sender and only if a section exists.
                    if (section && s.readyState === Constants.WEBSOCKET_READY) {
                        // Sections are created on the browser and then the application is deployed after a
                        // short delay. This will ensure proper frame sizes.
                        s.safeSend(JSON.stringify({ appId: Constants.APP_NAME, message: { action: Constants.Action.CREATE, id: sectionId, clients: section.clients } }));
                        if (section.app) {
                            setTimeout(function () {
                                s.safeSend(JSON.stringify({ appId: Constants.APP_NAME, message: { action: Constants.Action.UPDATE, id: sectionId, app: section.app } }));
                            }, Constants.SECTION_UPDATE_DELAY);
                        }
                    }
                });
            } else {
                console.error('section information cannot be requested from within a section.');
            }
        // All other messages
        } else {
            wss.clients.forEach(function (c) {
                // We respond to every socket but not to the sender
                if (c !== s && c.readyState === Constants.WEBSOCKET_READY) {
                    if (__DEBUG__) {
                        console.log('sending message to socket: ' + c.id);
                    }
                    c.safeSend(msg);
                }
            });
        }
    });
    if (__DEBUG__) {
        s.id = wss.clients.size;
        console.log('websocket connection established. Clients connected: ' + wss.clients.size);
    }
});

app.listen(process.env.PORT || 8080);
console.log('OVE core started');
