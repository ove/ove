# Open Visualisation Environment

Open Visualisation Environment (OVE) is an open-source software stack, designed to be used in large high resolution display (LHRD) environments like the [Imperial College](http://www.imperial.ac.uk) [Data Science Institute's](http://www.imperial.ac.uk/data-science/) [Data Observatory](http://www.imperial.ac.uk/data-science/data-observatory/).

We welcome collaboration under our [Code of Conduct](https://github.com/ove/ove/blob/master/CODE_OF_CONDUCT.md).

## Build Instructions

The build system is based on [Lerna](https://lernajs.io/) using [Babel](http://babeljs.io/) for [Node.js](https://nodejs.org/en/) and uses a [PM2](http://pm2.keymetrics.io/) runtime.

### Prerequisites

* [git](https://git-scm.com/downloads)
* [Node.js](https://nodejs.org/en/) (v8.0+)
* [npm](https://www.npmjs.com/)
* [npx](https://www.npmjs.com/package/npx) `npm install -global npx`
* [PM2](http://pm2.keymetrics.io/) `npm install -global pm2`
* [Lerna](https://lernajs.io/)  `npm install -global lerna`

### Build

Setup the lerna environment:

* `git clone https://github.com/ove/ove`
* `cd ove`
* `lerna bootstrap --hoist`

Build and start runtime:

* `lerna run clean`
* `lerna run build`
* `pm2 start pm2.json`

Lint the code, run the unit tests and generate coverage report:

* `lerna run lint`
* `lerna run test`

### Run

Run in Google Chrome:

* Client pages   `http://localhost:8080/view.html?oveClientId=LocalNine-0` < check Clients.json for info
* OVE JS library `http://localhost:8080/ove.js`
* OVE API docs   `http://localhost:8080/api-docs`

It is recommended to use OVE with Google Chrome, as this is the web browser used for development and in production at the DSI. However, it should also be compatible with other modern web browsers: if you encounter any browser-specific bugs please [report them as an Issue](https://github.com/ove/ove/issues).

### Stop

* `pm2 stop pm2.json`
* `pm2 delete pm2.json`

## Docker

Alternatively, you can use docker to build this image:

```sh
./build.sh
```

In order to run the image, you can customize the docker-compose file or run the default configuration:

```sh
SERVICE_VERSION="latest" docker-compose up -d
```

OVE should now run on port 8080 on localhost.

### Development

If you are a developer who has made changes to your local copy of OVE apps, you can quickly rebuild it with the **build.sh** script and then run the app with the **docker-compose** file. The **docker-compose.yml** file can be customized to reflect local changes.
