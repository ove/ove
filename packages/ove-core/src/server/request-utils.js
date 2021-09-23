const request = require('request');
const HttpStatus = require('http-status-codes');

const _defaultError = (resolve, reject, url, error, res, b) => {
    if (error !== null && error !== undefined) {
        reject({ statusCode: res?.statusCode, text: error });
    } else if (res?.statusCode !== HttpStatus.OK) {
        reject({ statusCode: res?.statusCode, text: b });
    } else {
        resolve({ statusCode: res?.statusCode, text: b });
    }
};

module.exports = {
    post: async (url, headers, body, handler) => new Promise((resolve, reject) =>
        request.post(url, {
            headers: headers || {},
            json: body
        }, (handler || _defaultError).bind(null, resolve, reject, url))),

    delete: async (url, headers, body, handler) => new Promise((resolve, reject) =>
        request.delete(url, {
            headers: headers || {},
            json: body || {}
        }, (handler || _defaultError).bind(null, resolve, reject, url))),

    get: async (url, headers, body, handler) => new Promise((resolve, reject) =>
        request.get(url, {
            headers: headers || {},
            json: body || {}
        }, (handler || _defaultError).bind(null, resolve, reject, url)))
};
