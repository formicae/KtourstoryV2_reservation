const {Pool ,Client} = require('pg');
const nodeEnv = process.env.NODE_ENV;
let hostName;
if (nodeEnv === 'PRODUCTION') {
    hostName = "10.229.128.3" // private IP of postgreSQL (for virtual machine)
} else {
    hostName = "35.221.69.227" // for local-test
}

const remoteConnectionConfig = {
    host: hostName,
    port: 5432,
    database: "postgres",
    user: "formicae",
    password: "ktour6922",
};

const pool = new Pool(remoteConnectionConfig);
module.exports = pool;

