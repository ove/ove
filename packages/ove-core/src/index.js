const path = require('path');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const request = require('request');
const uglify = require('uglify-js');
const app = express();
const wss = require('express-ws')(app).getWss('/');
const swaggerUi = require('swagger-ui-express');
const yamljs = require('yamljs');
const pjson = require('../package.json'); // this path might have to be fixed based on packaging
const nodeModules = path.join(__dirname, '..', '..', '..', 'node_modules');

var DEBUG = true;

app.use(cors());
app.use(express.json());

/**************************************************************
                        OVE Extensions
**************************************************************/
(function (add) {
    Object.getPrototypeOf(wss.clients).add = function (i) {
        if (!Object.getPrototypeOf(i).safeSend) {
            Object.getPrototypeOf(i).safeSend = function (msg) {
                try {
                    this.send(msg);
                } catch (e) {
                    if (this.readyState == 1) {
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
app.get('/:page(ove.js)', function (req, res, next) {
    res.set('Content-Type', 'application/javascript').send(uglify.minify(
        fs.readFileSync(path.join(__dirname, 'client', req.params.page), 'utf8')
            .replace(/DEBUG/g, DEBUG)
            .replace(/@VERSION/g, pjson.version)
            .replace(/@LICENSE/g, pjson.license)
            .replace(/@AUTHOR/g, pjson.author)
            // Remove all comments with pattern: //-- {comment} --//
            .replace(/\/\/--(.*?)--\/\//g, ''), { output: { comments: true } }).code
    );
});

/**************************************************************
                   Static Content of OVE Core
**************************************************************/
app.get('/', function (req, res, next) {
    res.sendFile(path.join(__dirname, 'blank.html'));
});
app.use('/core.:type.:fileType(js|css)', function (req, res, next) {
    let text = '';
    let type = req.params.type == 'control' ? 'control' : 'view';
    for (let context of ['common', type]) {
        let fp = path.join(__dirname, 'client', context, 'core.' + req.params.fileType);
        if (fs.existsSync(fp)) {
            text += fs.readFileSync(fp, 'utf8');
        }
    }
    let cType;
    switch (req.params.fileType) {
        case 'js':
            cType = 'application/javascript';
            break;
        case 'css':
            cType = 'text/css';
            break;
        default:
            cType = 'text/html';
    }
    res.set('Content-Type', cType).send(text);
});
app.use('/:fileName(index|control|view).html', function (req, res, next) {
    res.send(fs.readFileSync(path.join(__dirname, 'client', 'index.html'), 'utf8')
        .replace(/_OVETYPE_/g, req.params.fileName == 'control' ? 'control' : 'view'));
});
app.use('/', express.static(path.join(nodeModules, 'jquery', 'dist')));

/**************************************************************
                    APIs Exposed by OVE Core
**************************************************************/
var clients = JSON.parse(fs.readFileSync(path.join(__dirname, 'client', 'Clients.json')));
var sections = [];

var listClients = function (req, res, next) {
    res.status(200).set('Content-Type', 'application/json').send(JSON.stringify(clients));
};

var listClientById = function (req, res, next) {
    let sectionId = req.params.id;
    if (!sections[sectionId]) {
        res.status(200).set('Content-Type', 'application/json').send(JSON.stringify({}));
    }
    res.status(200).set('Content-Type', 'application/json').send(JSON.stringify(sections[sectionId].clients));
};

// Creates an individual section
var createSection = function (req, res, next) {
    if (!req.body.space || !clients[req.body.space]) {
        res.status(400).set('Content-Type', 'application/json').send(JSON.stringify({ error: 'invalid space' }));
    }
    if (req.body.w === undefined || req.body.h === undefined || req.body.x === undefined || req.body.y === undefined) {
        res.status(400).set('Content-Type', 'application/json').send(JSON.stringify({ error: 'invalid dimensions' }));
    }
    let section = { w: req.body.w, h: req.body.h, clients: {} };
    section.clients[req.body.space] = [];

    // Calculate the dimensions on a client-by-client basis
    clients[req.body.space].forEach(function (e) {
        if ((e.x + e.w) > req.body.x && (req.body.x + req.body.w) > e.x &&
            (e.y + e.h) > req.body.y && (req.body.y + req.body.h) > e.y) {
            let c = Object.assign({}, e);
            if (!c.offset) {
                c.offset = { x: 0, y: 0 };
            }
            if (c.x >= req.body.x) {
                c.x -= req.body.x;
            } else if (c.x + c.w > req.body.x) {
                c.offset.x += (req.body.x - c.x);
                c.x = 0;
                c.w -= c.offset.x;
            }
            if (c.x + c.w > req.body.w) {
                c.w = (req.body.w - c.x);
            }
            if (c.y >= req.body.y) {
                c.y -= req.body.y;
            } else if (c.y + c.h > req.body.y) {
                c.offset.y += (req.body.y - c.y);
                c.y = 0;
                c.h -= c.offset.y;
            }
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
            if (req.body.app.states.cache) {
                Object.keys(req.body.app.states.cache).forEach(function (name) {
                    request.post(section.app.url + '/state/' + name, {
                        headers: { 'Content-Type': 'application/json' },
                        json: req.body.app.states.cache[name]
                    });
                });
            }
            if (req.body.app.states.load) {
                if (typeof req.body.app.states.load === 'string' || req.body.app.states.load instanceof String) {
                    section.app.state = req.body.app.states.load;
                } else {
                    request.post(section.app.url + '/' + sectionId + '/state', {
                        headers: { 'Content-Type': 'application/json' },
                        json: req.body.app.states.load
                    });
                }
            }
        }
    }
    sections[sectionId] = section;

    // Notify OVE viewers/controllers
    wss.clients.forEach(function (c) {
        if (c.readyState == 1) {
            c.safeSend(JSON.stringify({ appId: 'core', message: { action: 'create', id: sectionId, clients: section.clients } }));
            if (section.app) {
                setTimeout(function () {
                    c.safeSend(JSON.stringify({ appId: 'core', message: { action: 'update', id: sectionId, app: section.app } }));
                }, 150);
            }
        }
    });
    if (DEBUG) {
        console.log('active sections: ' + sections.length);
    }
    res.status(200).set('Content-Type', 'application/json').send(JSON.stringify({ id: sectionId }));
};

// Deletes all sections
var deleteSections = function (req, res, next) {
    while (sections.length !== 0) {
        let section = sections.pop();
        if (section.app) {
            request.post(section.app.url + '/flush');
        }
    }
    if (DEBUG) {
        console.log('active sections: ' + sections.length);
    }
    wss.clients.forEach(function (c) {
        if (c.readyState == 1) {
            c.safeSend(JSON.stringify({ appId: 'core', message: { action: 'delete' } }));
        }
    });
    res.status(200).set('Content-Type', 'application/json').send(JSON.stringify({}));
};

// Fetches details of an individual section
var readSectionById = function (req, res, next) {
    let sectionId = req.params.id;
    if (!sections[sectionId]) {
        res.status(200).set('Content-Type', 'application/json').send(JSON.stringify({}));
    }
    let section = { id: sectionId, w: sections[sectionId].w, h: sections[sectionId].h };
    if (sections[sectionId].app && sections[sectionId].app.state) {
        section.state = sections[sectionId].app.state;
    }
    res.status(200).set('Content-Type', 'application/json').send(JSON.stringify(section));
};

// Updates an individual section
var updateSectionById = function (req, res, next) {
    let sectionId = req.params.id;
    if (!sections[sectionId] || JSON.stringify(sections[sectionId]) === JSON.stringify({})) {
        res.status(400).set('Content-Type', 'application/json').send(JSON.stringify({ error: 'invalid section id' }));
    }

    // Redeploys an App into a section
    let commands = [];
    if (sections[sectionId].app) {
        delete sections[sectionId].app;
        commands.push(JSON.stringify({ appId: 'core', message: { action: 'update', id: sectionId } }));
    }
    if (req.body.app) {
        sections[sectionId].app = { 'url': req.body.app.url.replace(/\/$/, '') };
        if (req.body.app.states) {
            if (req.body.app.states.cache) {
                Object.keys(req.body.app.states.cache).forEach(function (name) {
                    request.post(sections[sectionId].app.url + '/state/' + name, {
                        headers: { 'Content-Type': 'application/json' },
                        json: req.body.app.states.cache[name]
                    });
                });
            }
            if (req.body.app.states.load) {
                if (typeof req.body.app.states.load === 'string' || req.body.app.states.load instanceof String) {
                    sections[sectionId].app.state = req.body.app.states.load;
                } else {
                    request.post(sections[sectionId].app.url + '/' + sectionId + '/state', {
                        headers: { 'Content-Type': 'application/json' },
                        json: req.body.app.states.load
                    });
                }
            }
        }
        commands.push(JSON.stringify({ appId: 'core', message: { action: 'update', id: sectionId, app: req.body.app } }));
    }

    // Notify OVE viewers/controllers
    wss.clients.forEach(function (c) {
        if (c.readyState == 1) {
            commands.forEach(function (m) {
                c.safeSend(m);
            });
        }
    });
    res.status(200).set('Content-Type', 'application/json').send(JSON.stringify({ id: sectionId }));
};

// Deletes an individual section
var deleteSectionById = function (req, res, next) {
    let sectionId = req.params.id;
    if (!sections[sectionId] || JSON.stringify(sections[sectionId]) === JSON.stringify({})) {
        res.status(400).set('Content-Type', 'application/json').send(JSON.stringify({ error: 'invalid section id' }));
    }
    let section = sections[sectionId];
    if (section.app) {
        request.post(section.app.url + '/flush');
    }
    delete sections[sectionId];
    sections[sectionId] = {};
    wss.clients.forEach(function (c) {
        if (c.readyState == 1) {
            c.safeSend(JSON.stringify({ appId: 'core', message: { action: 'delete', id: sectionId } }));
        }
    });
    res.status(200).set('Content-Type', 'application/json').send(JSON.stringify({ id: sectionId }));
};

app.get('/clients', listClients);
app.get('/client/:id', listClientById);
app.delete('/sections', deleteSections);
app.post('/section', createSection);
app.get('/section/:id', readSectionById);
app.post('/section/:id', updateSectionById);
app.delete('/section/:id', deleteSectionById);

// Swagger API documentation
let swaggerDoc = (function (swagger) {
    swagger.info.version = swagger.info.version.replace('@VERSION', pjson.version);
    swagger.info.license.name = swagger.info.license.name.replace('@LICENSE', pjson.license);
    swagger.info.contact.email = swagger.info.contact.email.replace('@AUTHOR',
        pjson.author.substring(pjson.author.indexOf('<') + 1, pjson.author.indexOf('>')));
    return swagger;
})(yamljs.load(path.join(__dirname, 'swagger.yaml')));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc, {
    swaggerOptions: {
        defaultModelsExpandDepth: -1
    }
}));

/**************************************************************
                   OVE Messaging Middleware
**************************************************************/
app.ws('/', function (s, req) {
    s.safeSend(JSON.stringify({ func: 'connect' }));
    s.on('message', function (msg) {
        let m = JSON.parse(msg);

        // Method for viewers to request section information, helps browser crash recovery
        if (m.appId == 'core' && m.message.action == 'request') {
            if (m.sectionId === undefined) {
                sections.forEach(function (section, sectionId) {
                    if (section) {
                        wss.clients.forEach(function (c) {
                            if (c.readyState == 1) {
                                c.safeSend(JSON.stringify({ appId: 'core', message: { action: 'create', id: sectionId, clients: section.clients } }));
                                if (section.app) {
                                    setTimeout(function () {
                                        c.safeSend(JSON.stringify({ appId: 'core', message: { action: 'update', id: sectionId, app: section.app } }));
                                    }, 150);
                                }
                            }
                        });
                    }
                });
            } else {
                console.error('section information cannot be requested from within a section.');
            }

            // All other messages
        } else {
            wss.clients.forEach(function (c) {
                if (c !== s && c.readyState == 1) {
                    if (DEBUG) {
                        console.log('sending message to socket: ' + c.id);
                    }
                    c.safeSend(msg);
                }
            });
        }
    });
    if (DEBUG) {
        s.id = wss.clients.size;
        console.log('websocket connection established. Clients connected: ' + wss.clients.size);
    }
});

app.listen(process.env.PORT || 8080);
console.log('OVE core started');
