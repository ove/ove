const request = require('then-request');

function Persistence (appName, log, __private) {
    function Savable (key, value) {
        const __self = this;
        __self.key = key;
        if (value === undefined || value === null) {
            __self.value = undefined;
            __self.type = typeof undefined;
        } else if (value instanceof Array) {
            __self.value = [];
            value.forEach(function (e, i) {
                __self.value.push(new Savable(key + '[' + i + ']', e));
            });
            __self.type = 'array';
        } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            __self.value = value;
            __self.type = typeof value;
        } else if (value instanceof Object) {
            __self.value = [];
            Object.keys(value).forEach(function (e) {
                __self.value.push(new Savable(key + '[' + e + ']', value[e]));
            });
            __self.type = 'object';
        }
        __self.timestamp = Date.now();
    }

    const getSavable = function (item, key, returnParent) {
        let firstPart;
        let nextPart;
        if (key.indexOf('[') === -1) {
            firstPart = key;
            nextPart = null;
        } else {
            firstPart = key.substring(0, key.indexOf('['));
            nextPart = key.substring(key.indexOf('[') + 1, key.indexOf(']')) + key.substring(key.indexOf(']') + 1);
        }
        let result = null;
        if (item === __private.local) {
            result = item[firstPart];
        } else {
            if (item.type === 'array' || item.type === 'object') {
                item.value.forEach(function (e) {
                    if (e.key.endsWith('[' + firstPart + ']')) {
                        result = e;
                    }
                });
            }
        }
        if (!result || !nextPart) {
            return returnParent ? item : result;
        } else {
            return getSavable(result, nextPart, returnParent);
        }
    };

    const getLocalList = function (item, result) {
        if (item === __private.local) {
            Object.keys(__private.local).forEach(function (e) {
                getLocalList(__private.local[e], result);
            });
        } else {
            switch (item.type) {
                case 'string':
                case 'number':
                case 'boolean':
                case 'undefined':
                    result[item.key] = item.timestamp;
                    return;
                case 'array':
                case 'object':
                    item.value.forEach(function (e) {
                        getLocalList(e, result);
                    });
                    return;
                default:
                    log.error('Unknown type:', item.type);
            }
        }
    };

    const fromSavable = function (item) {
        if (!item) {
            return item;
        }
        let x;
        switch (item.type) {
            case 'string':
            case 'number':
            case 'boolean':
            case 'undefined':
                return item.value;
            case 'array':
                x = [];
                item.value.forEach(function (e) {
                    let key = e.key.substring(e.key.lastIndexOf('[') + 1, e.key.lastIndexOf(']'));
                    x[parseInt(key, 10)] = fromSavable(e);
                });
                return x;
            case 'object':
                x = {};
                item.value.forEach(function (e) {
                    let key = e.key.substring(e.key.lastIndexOf('[') + 1, e.key.lastIndexOf(']'));
                    x[key] = fromSavable(e);
                });
                return x;
            default:
                log.error('Unknown type:', item.type);
        }
    };

    const post = function (item) {
        if (item instanceof Array) {
            item.forEach(function (e) {
                post(e.value);
            });
        } else if (item !== undefined) {
            if (item.value === undefined) {
                request('DELETE', __private.provider + '/persist/' + item.key + '?appName=' + appName)
                    .then(function (res) {
                        if (res.statusCode >= 300) {
                            log.error('Unable to delete key:', item.key, 'from persistence provider:',
                                __private.provider, ', got: Server responded with status code ' + res.statusCode);
                        }
                    });
            } else {
                request('POST', __private.provider + '/persist/' + item.key + '?appName=' + appName, { json: {
                    value: item.value, type: item.type, timestamp: item.timestamp
                } }).then(function (res) {
                    if (res.statusCode >= 300) {
                        log.error('Unable to add key:', item.key, 'to persistence provider:',
                            __private.provider, ', got: Server responded with status code ' + res.statusCode);
                    }
                });
            }
        }
    };

    const $delete = function (item) {
        if (item instanceof Array) {
            item.forEach(function (e) {
                $delete(e.value);
            });
        } else {
            post(new Savable(item.key, undefined));
        }
    };

    const compareAndSet = function (current, future) {
        if (current === undefined) {
            post(future);
            return future;
        } else {
            switch (current.type) {
                case 'string':
                case 'number':
                case 'boolean':
                case 'undefined':
                    if (current.value !== future.value) {
                        post(future);
                        return future;
                    }
                    return current;
                case 'array':
                case 'object':
                    while (current.value.length > future.value.length) {
                        let x = current.value.pop();
                        x.value = undefined;
                        post(x);
                    }
                    for (let i = 0; i < current.value.length; i++) {
                        current.value[i] = compareAndSet(current.value[i], future.value[i]);
                    }
                    if (current.value.length < future.value.length) {
                        for (let i = current.value.length; i < future.value.length; i++) {
                            current.value.push(compareAndSet(current.value[i], future.value[i]));
                        }
                    }
                    return current;
                default:
                    log.error('Unknown type:', current.type);
            }
        }
    };

    const deleteSavable = function (key, deleteRemoteCopy) {
        if (getSavable(__private.local, key)) {
            let parent = getSavable(__private.local, key, true);
            if (parent === __private.local) {
                delete __private.local[key];
            } else {
                parent.value.forEach(function (e, i) {
                    if (e.key === key) {
                        parent.splice(i, 1);
                    }
                });
            }
            if (deleteRemoteCopy) {
                $delete(new Savable(key, undefined));
            }
        }
    };

    const createSavable = function (key, value) {
        let parent = getSavable(__private.local, key, true);
        if (!parent) {
            log.error('Invalid key:', key);
        } else if (parent === __private.local) {
            if (__private.provider) {
                __private.local[key] = compareAndSet(__private.local[key], value);
            } else {
                __private.local[key] = value;
            }
        } else {
            let exists = false;
            parent.value.forEach(function (e, i) {
                if (e.key === key) {
                    parent.value[i] = __private.provider ? compareAndSet(e, value) : value;
                    exists = true;
                }
            });
            if (!exists) {
                parent.value.push(value);
            }
        }
    };

    this.sync = function () {
        request('GET', __private.provider + '/persist/?appName=' + appName)
            .then(function (res) {
                try {
                    const remoteList = JSON.parse(res.getBody('utf-8'));
                    let localList;
                    getLocalList(__private.local, localList);
                    Object.keys(localList).forEach(function (key) {
                        if (!remoteList[key]) {
                            deleteSavable(key);
                        }
                    });
                    Object.keys(remoteList).forEach(function (key) {
                        if (!localList[key] || remoteList[key].timestamp > localList[key].timestamp) {
                            request('GET', __private.provider + '/persist/' + key + '?appName=' + appName)
                                .then(function (res) {
                                    try {
                                        const result = JSON.parse(res.getBody('utf-8'));
                                        let value;
                                        if (result.type === 'string') {
                                            value = new Savable(key, result.value);
                                        } else if (result.type === 'number') {
                                            value = new Savable(key, +(result.value));
                                        } else if (result.type === 'boolean') {
                                            value = new Savable(key,
                                                (result.value === 'true' || result.value));
                                        } else {
                                            log.error('Unable to handle type:', result.type);
                                            return;
                                        }
                                        value.type = result.type;
                                        createSavable(key, value);
                                    } catch (e) {
                                        log.error('Unable to read key:', key, 'from persistence provider:',
                                            __private.provider, ', got:', e);
                                        return undefined;
                                    }
                                });
                        }
                    });
                } catch (e) {
                    log.error('Unable to get of keys from persistence provider:',
                        __private.provider, ', got:', e);
                    return undefined;
                }
            });
    };

    this.get = function (key) {
        return fromSavable(getSavable(__private.local, key));
    };

    this.set = function (key, value) {
        let val = new Savable(key, value);
        createSavable(key, val);
    };

    this.del = function (key) {
        deleteSavable(key, true);
    };
}

module.exports = function (appName, log, __private) {
    return new Persistence(appName, log, __private);
};
