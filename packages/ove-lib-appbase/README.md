# `@ove-lib/appbase`

> Base library for [Open Visualization Environment (OVE)](https://github.com/ove/ove) applications. This library depends on [@ove-lib/utils](https://www.npmjs.com/package/@ove-lib/utils).

## Install

```bash
npm install @ove-lib/appbase --save
```

## Usage

```js
const path = require('path');
const { express, app, log, nodeModules } = require('@ove-lib/appbase')(__dirname, 'myapp');
const server = require('http').createServer(app);

log.debug('Using module:', 'some_module');
app.use('/', express.static(path.join(nodeModules, 'some_module', 'build')));

const port = process.env.PORT || 8080;
server.listen(port);
log.info('application started, port:', port);
```
