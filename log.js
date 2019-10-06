const {Default, FirebaseTransport} = require('kintranet_lib').Logger;
const fbDB = require('./server/auth/firebase').database;
const log = Default(new FirebaseTransport(fbDB, 'notification', {level:"info"}));

module.exports = log;