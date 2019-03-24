const {Default, FirebaseTransport} = require('kintranet_lib').Logger;
const fbDB = require('./server/auth/firebase').database;
const log = Default(new FirebaseTransport(fbDB,'notification'));
// log.warn('WARN','test','formicae');

module.exports = log;