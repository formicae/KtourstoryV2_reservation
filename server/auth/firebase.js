const PROJECT_NAME = "kintranet-206323";
const admin = require("firebase-admin");
const databaseURL = `https://${PROJECT_NAME}.firebaseio.com/`;
const credential = getCredential(admin);
admin.initializeApp({credential, databaseURL});
function getCredential(admin) {
    // Before use applicationDefault, needs to set admin access scope
    // https://cloud.google.com/compute/docs/access/create-enable-service-accounts-for-instances?authuser=0#changeserviceaccountandscopes
    const NODE_ENV = process.env.NODE_ENV || require("../../package.json").NODE_ENV;
    if (NODE_ENV === "PRODUCTION") return admin.credential.applicationDefault();
    const serviceAccount = require(`./keys/${PROJECT_NAME}.credential.json`);
    return admin.credential.cert(serviceAccount);
}
module.exports = {
    database: admin.database()
};