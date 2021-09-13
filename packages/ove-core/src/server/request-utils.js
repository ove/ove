const HttpStatus = require('http-status-codes');
const request = require('request');

const _defaultError = (resolve, reject, url, error, res, b) => {
    if (error !== null && error !== undefined) {
        reject(error);
    } else if (res?.statusCode !== HttpStatus.OK) {
        reject(new Error(`Received status code: ${res?.statusCode} and reason: ${JSON.stringify(b)} when connecting to: ${url}`));
    } else {
        resolve(b);
    }
};

const post = async (url, headers, body, handler) => new Promise((resolve, reject) =>
    request.post(url, {
        headers: headers || {},
        json: body
    }, (handler || _defaultError).bind(null, resolve, reject, url)));

const del = async (url, headers, body, handler) => new Promise((resolve, reject) =>
    request.delete(url, {
        headers: headers || {},
        json: body || {}
    }, (handler || _defaultError).bind(null, resolve, reject, url)));

const get = async (url, headers, body, handler) => new Promise((resolve, reject) =>
    request.get(url, {
        headers: headers || {},
        json: body || {}
    }, (handler || _defaultError).bind(null, resolve, reject, url)));

exports.post = post;
exports.delete = del;
exports.get = get;
