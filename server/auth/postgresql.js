const {Pool ,Client} = require('pg');
const env = require('../../package.json').env;
let hostName;
if (!env.released) hostName = "35.221.69.227"; // for local-test
else hostName = "10.229.128.3";  // private IP of postgreSQL (for virtual machine)

const remoteConnectionConfig = {
    host: "35.221.69.227",
    port: 5432,
    database: "postgres",
    user: "formicae",
    password: "ktour6922",
};

const pool = new Pool(remoteConnectionConfig);
module.exports = pool;

