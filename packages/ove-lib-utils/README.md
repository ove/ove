# `@ove-lib/utils`

> Core utility library for [Open Visualization Environment (OVE)](https://github.com/ove/ove) framework.

## Install

```bash
npm install @ove-lib/utils --save
```

## Usage

To use the entire library:

```js
const path = require('path');
const express = require('express');
const app = express();
const dirs = {
    base: __dirname,
    nodeModules: path.join(__dirname, '..', 'node_modules'),
    constants: path.join(__dirname, 'constants'),
    rootPage: path.join(__dirname, 'client', 'blank.html')
};
const { Constants, Utils } = require('@ove-lib/utils')('myapp', app, dirs);
const log = Utils.Logger('myapp');
log.debug('Starting application:', 'myapp');
```

To use logging and common utility functions:

```js
const { Utils } = require('@ove-lib/utils')();
const log = Utils.Logger('myapp');
log.debug('Sample log message');
```
