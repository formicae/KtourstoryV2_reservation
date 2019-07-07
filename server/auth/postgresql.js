const {Pool ,Client} = require('pg');
const env = require('../../package.json').env;
let hostName;
if (!env.released) hostName = "35.221.72.223";
else hostName = "10.88.0.3";  // private IP of postgreSQL

const remoteConnectionConfig = {
    host: hostName,
    port: 5432,
    database: "postgres",
    user: "formicae",
    password: "ktour6922",
};

const pool = new Pool(remoteConnectionConfig);
module.exports = pool;

