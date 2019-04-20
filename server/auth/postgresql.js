const {Pool ,Client} = require('pg');
// const connectString = 'postgres://formicae:ktour6922@35.211.72.223:5432/postgres';
// const postgreSQLAuth = require('./keys/postgresql-auth.json');
// const fs = require('fs');
// console.log('process.env.NODE_ENV : ',process.env.NODE_ENV);
const remoteConnectionConfig = {
    host: "35.221.72.223",
    port: 5432,
    database: "postgres",
    user: "formicae",
    password: "ktour6922",
}
// const connectionConfig = {
//     host: postgreSQLAuth.host,
//     port: postgreSQLAuth.port,
//     database: postgreSQLAuth.database,
//     user: postgreSQLAuth.user,
//     password: postgreSQLAuth.password,
    // ssl: {
    //     rejectUnauthorized : false,
    //     ca   : fs.readFileSync(__dirname + '/keys/server-ca.pem'),
    //     key  : fs.readFileSync(__dirname + '/keys/client-key.pem'),
    //     cert : fs.readFileSync(__dirname + '/keys/client-cert.pem'),
    // }
// };
const pool = new Pool(remoteConnectionConfig);
module.exports = pool;

