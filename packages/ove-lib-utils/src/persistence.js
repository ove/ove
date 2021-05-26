const request = require('request');

// IMPORTANT: Do not introduce any logs for operations on a single key, except for error scenarios.
// Logs have been left out from most of the methods on purpose, as it contributes to significant
// log file sizes.
function Persistence (appName, log, Utils, Constants, __private) {
    /**************************************************************
                        The Persistable Object
    **************************************************************/
    // A persistable object needs a key and value, but will also have a type and a timestamp which
    // is automatically computed. The object also provides a method to extract the original value
    // in its original type.

    const Type = {
        STRING: typeof '',
        NUMBER: typeof Number.MAX_VALUE,
        BOOLEAN: typeof true,
        ARRAY: 'array', // JavaScript does not provide this type by default, but we need it.
        OBJECT: typeof {},
        UNDEFINED: typeof undefined
    };

    // A utility method to extract the original value in its original type.
    const _fromPersistable = function (item) {
        let x;
        switch (item.type) {
            case Type.STRING:
            case Type.NUMBER:
            case Type.BOOLEAN:
            case Type.UNDEFINED:
                return item.value;
            case Type.ARRAY:
                x = [];
                item.value.forEach(function (e) {
                    let key = e.key.substring(e.key.lastIndexOf('[') + 1, e.key.lastIndexOf(']'));
                    x[parseInt(key, 10)] = _fromPersistable(e);
                });
                return x;
            case Type.OBJECT:
                x = {};
                item.value.forEach(function (e) {
                    let key = e.key.substring(e.key.lastIndexOf('[') + 1, e.key.lastIndexOf(']'));
                    x[key] = _fromPersistable(e);
                });
                return x;
            default:
                _logUnknownType(item.type);
        }
    };

    // The persistable object.
    function Persistable (key, value) {
        const __self = this;
        __self.key = key;

        // Set value and type of object.
        if (value === undefined || value === null) {
            __self.value = undefined;
            __self.type = typeof undefined;
        } else if (value instanceof Array) {
            __self.value = [];
            value.forEach(function (e, i) {
                __self.value.push(new Persistable(key + '[' + i + ']', e));
            });
            __self.type = Type.ARRAY;
        } else {
            switch (typeof value) {
                case Type.STRING:
                case Type.NUMBER:
                case Type.BOOLEAN:
                    __self.value = value;
                    __self.type = typeof value;
                    break;
                case Type.OBJECT:
                    __self.value = [];
                    Object.keys(value).forEach(function (e) {
                        __self.value.push(new Persistable(key + '[' + e + ']', value[e]));
                    });
                    __self.type = typeof value;
                    break;
                default:
                    _logUnknownType(typeof value);
            }
        }

        __self.timestamp = Date.now();

        __self.toOriginal = function () {
            return _fromPersistable(__self);
        };
    }

    /**************************************************************
                        Common Utility Methods
    **************************************************************/
    const _logUnknownType = function (type) {
        log.warn('Unknown type:', type);
    };

    const _handleRequestError = function (e) {
        /* istanbul ignore if */
        // It is impossible to test this scenario as there would be issues in the test runner
        // if URLs were invalid. This is easily testable using an integration test-case, since
        // PM2/node will eventually report the error after several seconds.
        if (e) {
            log.warn('Connection error when making request to persistence service:', e);
        }
    };

    // A utility method to covert keys to/from local from/to remote.
    const _convertKey = function (key) {
        let result = key.split('');
        if (key.indexOf('/') > -1) {
            while (result.indexOf('/') > -1) {
                result.splice(result.indexOf('/') + 1, 0, '[');
                result[result.indexOf('/')] = ']';
            }
            result.push(result.splice(result.indexOf(']'), 1));
        } else if (key.indexOf('[') > -1) {
            while (result.indexOf('[') > -1) {
                result[result.indexOf('[')] = '/';
                result.splice(result.indexOf(']'), 1);
            }
        }
        return result.join('');
    };

    /**************************************************************
                           Remote Operations
    **************************************************************/
    const updateRemoteItem = function (item) {
        /* istanbul ignore if */
        // The persistence service should always be set before calling this method.
        // This check is an additional precaution.
        if (!__private.provider) {
            log.error('Unable to perform remote operation. The persistence service has not been set');
            return;
        }

        if (item.value instanceof Array) {
            item.value.forEach(function (e) {
                updateRemoteItem(e);
            });
        } else if (item !== undefined && item.type !== undefined) {
            const url = __private.provider + '/' + appName + '/' + _convertKey(item.key);
            if (item.value === undefined) {
                request.delete(url, _handleRequestError);
            } else {
                request.post(url, {
                    headers: { 'Content-Type': Constants.HTTP_CONTENT_TYPE_JSON },
                    json: { value: item.value, type: item.type, timestamp: item.timestamp }
                }, _handleRequestError);
            }
        }
    };

    const deleteRemoteItem = function (item) {
        /* istanbul ignore if */
        // The persistence service should always be set before calling this method.
        // This check is an additional precaution.
        if (!__private.provider) {
            log.error('Unable to perform remote operation. The persistence service has not been set');
            return;
        }

        if (item.value instanceof Array) {
            item.value.forEach(function (e) {
                deleteRemoteItem(e);
            });
        } else {
            // A delete operation is equivalent to an update operation with an undefined key.
            updateRemoteItem(new Persistable(item.key, undefined));
        }
    };

    /**************************************************************
                        Compare and Set Method
    **************************************************************/

    // A utility method to sort values of a persistable object or array, which is used when
    // comparing current values with future values.
    const _sortValues = function (item) {
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

    const compareAndSet = function (future, current) {
        if (current === undefined) {
            updateRemoteItem(future);
            return future;
        } else if (current.type !== future.type || current.key !== future.key) {
            // If the key or type are different, the object is not comparable and therefore
            // must be deleted and recreated.
            deleteRemoteItem(current);
            updateRemoteItem(future);
            return future;
        }

        switch (current.type) {
            case Type.STRING:
            case Type.NUMBER:
            case Type.BOOLEAN:
            case Type.UNDEFINED:
                if (!Utils.JSON.equals(current.value, future.value)) {
                    updateRemoteItem(future);
                    return future;
                }
                return current;
            case Type.ARRAY:
            case Type.OBJECT:
                // The arrays are sorted to avoid objects being replaced during parsing.
                current.value = _sortValues(current).value;
                future.value = _sortValues(future).value;
                // We use two counters since the lists would never match in size.
                let i = 0;
                let j = 0;
                while (i < current.value.length) {
                    if (!future.value[j]) {
                        // No more items in the future list, so delete subsequent values in the
                        // current list.
                        current.value.splice(i, current.value.length - i).forEach(function (e) {
                            deleteRemoteItem(e);
                        });
                    } else if (current.value[i].key !== future.value[j].key) {
                        // The item has been deleted, and a new item has taken its place.
                        deleteRemoteItem(current.value.splice(i, 1)[0]);
                    } else {
                        // Compare and set the value of the existing item if it has changed.
                        current.value[i] = compareAndSet(future.value[j], current.value[i]);
                        i++;
                        j++;
                    }
                }
                // All items remaining in the future list do not yet exist in the current list,
                // so we add them.
                if (current.value.length < future.value.length) {
                    for (let i = current.value.length; i < future.value.length; i++) {
                        current.value.push(compareAndSet(future.value[i], current.value[i]));
                    }
                }
                return current;
            default:
                _logUnknownType(current.type);
        }
    };

    /**************************************************************
                CRUD Operations on Persistable Objects
    **************************************************************/
    const createParentIfNotExisting = function (key) {
        let parent = readPersistable(__private.local, key, true);
        if (!parent) {
            const parentKey = key.substring(0, key.lastIndexOf('['));
            createParentIfNotExisting(parentKey);
            // If a parent does not exist locally, but exists remotely, then, it should be
            // created locally. If a parent exists, it could be either an object or an array
            // and there is no easy way of figuring that out based on just the key. So, we
            // make an assumption that objects would not generally have keys that start with
            // numbers.
            const itemKey = key.substring(key.lastIndexOf('[') + 1, key.length - 1);
            const isArray = !isNaN(parseInt(itemKey, 10));
            createOrUpdatePersistable(parentKey, new Persistable(parentKey, isArray ? [] : {}));
        }
    };

    const createOrUpdatePersistable = function (key, value) {
        let parent = readPersistable(__private.local, key, true);
        if (!parent) {
            log.error('Invalid key:', key);
            return;
        }

        if (parent === __private.local) {
            __private.local[key] = __private.provider ? compareAndSet(value, __private.local[key]) : value;
            return;
        }

        let exists = false;
        parent.value.forEach(function (e, i) {
            if (e.key === key) {
                parent.value[i] = __private.provider ? compareAndSet(value, e) : value;
                exists = true;
            }
        });
        if (!exists) {
            parent.value.push(__private.provider ? compareAndSet(value) : value);
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
        } else if (item.type === 'array' || item.type === 'object') {
            item.value.forEach(function (e) {
                if (e.key.endsWith('[' + firstPart + ']')) {
                    result = e;
                }
            });
        }
        if (!result && nextPart) {
            return result;
        } if (!result || !nextPart) {
            return returnParent ? item : result;
        }
        return readPersistable(result, nextPart, returnParent);
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

    /**************************************************************
                 Synchronisation of Local with Remote
    **************************************************************/
    // A utility method to get local items for the sync operation.
    const _getLocalItems = function (item) {
        let result = {};
        if (item === __private.local) {
            Object.keys(__private.local).forEach(function (e) {
                result = Object.assign(result, _getLocalItems(__private.local[e]));
            });
            return result;
        }
        switch (item.type) {
            case Type.STRING:
            case Type.NUMBER:
            case Type.BOOLEAN:
            case Type.UNDEFINED:
                result[item.key] = item.timestamp;
                break;
            case Type.ARRAY:
            case Type.OBJECT:
                item.value.forEach(function (e) {
                    result = Object.assign(result, _getLocalItems(e));
                });
                break;
            default:
                _logUnknownType(item.type);
        }
        return result;
    };

    const sync = function () {
        if (!__private.provider) {
            log.warn('Ignoring sync request. The persistence service has not been set');
            return;
        }

        request(__private.provider + '/' + appName, { json: true }, function (err, _res, remoteList) {
            if (err) {
                log.error('Unable to get keys from persistence service:',
                    __private.provider, ', got:', err);
                return;
            }

            const localList = _getLocalItems(__private.local);

            // Delete all local items that do not exist remotely.
            Object.keys(localList).forEach(function (key) {
                const convertedKey = _convertKey(key);
                if (!remoteList[convertedKey]) {
                    deletePersistable(key);
                }
            });

            // Add any remote item if it does not exist locally or if it has a newer timestamp.
            Object.keys(remoteList).forEach(function (key) {
                const convertedKey = _convertKey(key);
                if (!localList[convertedKey] || remoteList[key] > localList[convertedKey]) {
                    const url = __private.provider + '/' + appName + '/' + key;
                    request(url, { json: true }, function (err, _res, result) {
                        if (err) {
                            log.error('Unable to read key:', convertedKey,
                                'from persistence service:', __private.provider, ', got:', err);
                            return;
                        }
                        createParentIfNotExisting(convertedKey);
                        createOrUpdatePersistable(convertedKey,
                            new Persistable(convertedKey, result.value));
                    });
                }
            });
        });
    };

    /**************************************************************
                     Functionality that is exposed
    **************************************************************/
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

    this.sync = sync;
}

module.exports = function (appName, log, Utils, Constants, __private) {
    return new Persistence(appName, log, Utils, Constants, __private);
};
