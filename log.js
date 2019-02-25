/**
 * logging
 * @param messageId {string=}
 * @param message {string}
 * @return {Promise}
 */
function log(messageId, message) {
    return new Promise((resolve, reject) => {
        if (!messageId) console.log(message);
        else console.log(messageId, message);
        resolve();
    });
}

/**
 * log error Error object is required
 * @param messageId {string}
 * @param error {Error}
 * @param message {string}
 * @return {Promise}
 */
function error(messageId, error, message) {
    return new Promise(((resolve, reject) => {
        if (!messageId) console.error(error, message);
        else console.error(error, messageId, message);
        resolve();
    }));

}

/**
 * log exception
 * @param messageId {string}
 * @param type {string}
 * @param message {string}
 * @return {Promise}
 */
function exception(messageId, type, message) {
    return new Promise((resolve, reject) => {
        if (!messageId) console.warn(type, message);
        else console.warn(messageId, type, message);
        resolve();
    });
}

module.exports = {
    log, error, exception
};
