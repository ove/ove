# `@ove-lib/appbase`

> Base library for [Open Visualization Environment (OVE)](https://github.com/ove/ove) applications. This library depends on [@ove-lib/utils](https://www.npmjs.com/package/@ove-lib/utils).

## Install

```bash
npm install @ove-lib/appbase --save
```

## Usage

```js
const express = require('express');
const app = express();
const dirs = {
    base: __dirname,
    nodeModules: path.join(__dirname, '..', 'node_modules'),
    constants: path.join(__dirname, 'constants'),
    rootPage: path.join(__dirname, 'client', 'blank.html')
};
const { Constants, Utils } = require('@ove-lib/utils')(app, 'myapp', dirs);
const log = Utils.Logger('myapp');
log.debug('Starting application:', 'myapp');
```
