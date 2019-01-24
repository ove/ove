const request = require('request');

function Persistence (appName, log, Utils, Constants, __private) {
    // A persistable object needs a key and value, but will also have a type and a timestamp which
    // is automatically computed. The object also provides a method to extract the original value
    // in its original type.
    function Persistable (key, value) {
        const __self = this;
        __self.key = key;
        if (value === undefined || value === null) {
            __self.value = undefined;
            __self.type = typeof undefined;
        } else if (value instanceof Array) {
            __self.value = [];
            value.forEach(function (e, i) {
                __self.value.push(new Persistable(key + '[' + i + ']', e));
            });
            __self.type = 'array';
        } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            __self.value = value;
            __self.type = typeof value;
        } else if (typeof value === 'object') {
            __self.value = [];
            Object.keys(value).forEach(function (e) {
                __self.value.push(new Persistable(key + '[' + e + ']', value[e]));
            });
            __self.type = 'object';
        }
        __self.timestamp = Date.now();

        const fromPersistable = function (item) {
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
                        x[parseInt(key, 10)] = fromPersistable(e);
                    });
                    return x;
                case 'object':
                    x = {};
                    item.value.forEach(function (e) {
                        let key = e.key.substring(e.key.lastIndexOf('[') + 1, e.key.lastIndexOf(']'));
                        x[key] = fromPersistable(e);
                    });
                    return x;
                default:
                    log.warn('Unknown type:', item.type);
            }
        };

        __self.toOriginal = function () {
            return fromPersistable(__self);
        };
    }

    const getLocalItems = function (item) {
        let result = {};
        if (item === __private.local) {
            Object.keys(__private.local).forEach(function (e) {
                result = Object.assign(result, getLocalItems(__private.local[e]));
            });
        } else {
            switch (item.type) {
                case 'string':
                case 'number':
                case 'boolean':
                case 'undefined':
                    result[item.key] = item.timestamp;
                    break;
                case 'array':
                case 'object':
                    item.value.forEach(function (e) {
                        result = Object.assign(result, getLocalItems(e));
                    });
                    break;
                default:
                    log.warn('Unknown type:', item.type);
            }
        }
        return result;
    };

    const _handleRequestError = function (e) {
        /* istanbul ignore if */
        // It is impossible to test this scenario as there would be issues in the test runner if URLs
        // were invalid. This is easily testable using an integration test-case, since PM2/node will
        // eventually report the error after several seconds.
        if (e) {
            log.warn('Connection error when making request to persistence provider:', e);
        }
    };

    const updateRemoteItem = function (item) {
        if (item.value instanceof Array) {
            item.value.forEach(function (e) {
                updateRemoteItem(e);
            });
        } else if (item !== undefined && item.type !== undefined) {
            const url = __private.provider + '/' + item.key + '?appName=' + appName;
            if (item.value === undefined) {
                log.trace('Deleting key at:', url);
                request.delete(url, _handleRequestError);
            } else {
                log.trace('Updating key at:', url);
                request.post(url, {
                    headers: { 'Content-Type': Constants.HTTP_CONTENT_TYPE_JSON },
                    json: { value: item.value, type: item.type, timestamp: item.timestamp }
                }, _handleRequestError);
            }
        }
    };

    const deleteRemoteItem = function (item) {
        if (item.value instanceof Array) {
            item.value.forEach(function (e) {
                deleteRemoteItem(e);
            });
        } else {
            updateRemoteItem(new Persistable(item.key, undefined));
        }
    };

    const sortValues = function (item) {
        item.value.sort(function (a, b) {
            if (a.key < b.key) {
                return -1;
            }
            /* istanbul ignore next */
            // Below line exists only for the sake of completeness. Generally the array will
            // always be sorted, and therefore it is impossible to get to this state in a test.
            return a.key > b.key ? 1 : 0;
        });
        return item;
    };

    const compareAndSet = function (current, future) {
        if (current === undefined) {
            updateRemoteItem(future);
            return future;
        } else if (current.type !== future.type || current.key !== future.key) {
            // If the key or type are different, the object is not comparable and therefore
            // must be deleted and recreated.
            deleteRemoteItem(current);
            updateRemoteItem(future);
            return future;
        } else {
            switch (current.type) {
                case 'string':
                case 'number':
                case 'boolean':
                case 'undefined':
                    if (!Utils.JSON.equals(current.value, future.value)) {
                        updateRemoteItem(future);
                        return future;
                    }
                    return current;
                case 'array':
                case 'object':
                    // It is important to sort the arrays to avoid objects being replaced during parsing
                    // phase;
                    current.value = sortValues(current).value;
                    future.value = sortValues(future).value;
                    // We use two counters since the lists would never match in size.
                    let i = 0;
                    let j = 0;
                    while (i < current.value.length) {
                        if (!future.value[j]) {
                            // No more items in the future list, therefore delete everything we got.
                            current.value.splice(i, current.value.length - i).forEach(function (e) {
                                deleteRemoteItem(e);
                            });
                        } else if (current.value[i].key !== future.value[j].key) {
                            // The item has been deleted, and a new item has taken its place.
                            deleteRemoteItem(current.value.splice(i, 1)[0]);
                        } else {
                            current.value[i] = compareAndSet(current.value[i], future.value[j]);
                            i++;
                            j++;
                        }
                    }
                    // All items remaining on the list of future values are not existing on the current list.
                    if (current.value.length < future.value.length) {
                        for (let i = current.value.length; i < future.value.length; i++) {
                            current.value.push(compareAndSet(current.value[i], future.value[i]));
                        }
                    }
                    return current;
                default:
                    log.warn('Unknown type:', current.type);
            }
        }
    };

    const createOrUpdatePersistable = function (key, value) {
        let parent = readPersistable(__private.local, key, true);
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

    const readPersistable = function (item, key, returnParent) {
        let firstPart;
        let nextPart;
        if (key.indexOf('[') === -1) {
            firstPart = key;
            nextPart = null;
        } else {
            firstPart = key.substring(0, key.indexOf('['));
            nextPart = key.substring(key.indexOf('[') + 1, key.indexOf(']')) + key.substring(key.indexOf(']') + 1);
        }
        let result;
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
        if (!result && nextPart) {
            return result;
        } if (!result || !nextPart) {
            return returnParent ? item : result;
        } else {
            return readPersistable(result, nextPart, returnParent);
        }
    };

    const deletePersistable = function (key, deleteRemoteCopy) {
        let result;
        if (readPersistable(__private.local, key)) {
            let parent = readPersistable(__private.local, key, true);
            if (parent === __private.local) {
                result = __private.local[key];
                delete __private.local[key];
            } else {
                parent.value.forEach(function (e, i) {
                    if (e.key === key) {
                        result = parent.value.splice(i, 1)[0];
                    }
                });
            }
            if (deleteRemoteCopy) {
                deleteRemoteItem(result);
            }
        }
        return result;
    };

    this.sync = function () {
        request(__private.provider + '/?appName=' + appName, { json: true }, function (err, _res, remoteList) {
            if (err) {
                log.error('Unable to get of keys from persistence provider:',
                    __private.provider, ', got:', err);
            } else {
                const localList = getLocalItems(__private.local);
                Object.keys(localList).forEach(function (key) {
                    if (!remoteList[key]) {
                        deletePersistable(key);
                    }
                });
                Object.keys(remoteList).forEach(function (key) {
                    if (!localList[key] || remoteList[key] > localList[key]) {
                        const url = __private.provider + '/' + key + '?appName=' + appName;
                        request(url, { json: true }, function (err, _res, result) {
                            if (err) {
                                log.error('Unable to read key:', key, 'from persistence provider:',
                                    __private.provider, ', got:', err);
                            } else {
                                createOrUpdatePersistable(key, new Persistable(key, result.value)); 
                            }
                        });
                    }
                });
            }
        });
    };

    this.get = function (key) {
        const persistable = readPersistable(__private.local, key);
        return !persistable ? persistable : persistable.toOriginal();
    };

    this.set = function (key, value) {
        createOrUpdatePersistable(key, new Persistable(key, value));
    };

    this.del = function (key) {
        return deletePersistable(key, __private.provider);
    };
}

module.exports = function (appName, log, Utils, Constants, __private) {
    return new Persistence(appName, log, Utils, Constants, __private);
};
