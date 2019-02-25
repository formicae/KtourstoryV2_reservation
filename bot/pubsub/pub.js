const Log = require("../../log");
const auth = require("../gmail/auth");
const {google} = require('googleapis');
const WATCH_CONFIG = {userId: "me", resource: {labelIds: ["INBOX"], topicName: "projects/kintranet-206323/topics/gmail"}}
const RENEW_TIMEOUT = 1000 * 60 * 60 * 24;
let nextWatch = null;

function renewWatching() {
    return auth()
        .then(_stopExistWatch)
        .then(_watch)
}

function _stopExistWatch(auth) {
    const gmail = google.gmail({version: 'v1', auth});
    return gmail.users.stop({userId: 'me'})
        .then(res => {
            Log.log("Stop watching gmail for pub/sub");
            return auth;
        })
}

function _watch(auth) {
    const gmail = google.gmail({version: 'v1', auth});
    return gmail.users.watch(WATCH_CONFIG)
        .then(res => {
            Log.log("Watching gmail for pub/sub");
            nextWatch = setTimeout(()=>{
                Log.log("Renew watching gmail for pub/sub");
                renewWatching(auth);
            }, RENEW_TIMEOUT);
        })
}
function _stop(){
    console.log("stop pub");
    auth()
        .then(auth => google.gmail({version: 'v1', auth}).users.stop({userId:"me"}))
        .catch(console.error);
}
process.once("uncaughtException", _stop);
process.once("beforeExit", _stop);
module.exports = renewWatching;
