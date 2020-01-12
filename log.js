const {Default, FirebaseTransport} = require('kintranet_lib').Logger;
const fbDB = require('./server/auth/firebase').database;
const log = Default(new FirebaseTransport(fbDB, 'notification', {level:"warn"}));

module.exports = log;
