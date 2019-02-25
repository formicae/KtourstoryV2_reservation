const {Pool ,Client} = require('pg');
const postgreSQLAuth = require('./postgresql-auth.json');
const fs = require('fs');

const connectionConfig = {
    host: postgreSQLAuth.host,
    port: postgreSQLAuth.port,
    database: postgreSQLAuth.database,
    user: postgreSQLAuth.user,
    password: postgreSQLAuth.password,
    ssl: {
        rejectUnauthorized : false,
        ca   : fs.readFileSync(__dirname + '/keys/server-ca.pem'),
        key  : fs.readFileSync(__dirname + '/keys/client-key.pem'),
        cert : fs.readFileSync(__dirname + '/keys/client-cert.pem'),
    }
};

const pool = new Pool(connectionConfig);
module.exports = pool;

