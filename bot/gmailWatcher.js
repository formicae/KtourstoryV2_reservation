const Log = require("../log");
const auth = require("./gmail/auth");
const {EventEmitter} = require("events");
const subscription = require("./pubsub/sub");
const {google} = require("googleapis");
const gmailParser = require("gmail-parser");

const isProcessed = (() => {
    const HISTORIES = new Set();
    const HISTORY_SIZE = 1000;

    return (id) => {
        const processed = HISTORIES.has(id);
        if (HISTORIES.size > HISTORY_SIZE) HISTORIES.clear();
        HISTORIES.add(id);
        return processed;
    };
})();

function singletoneGmailWatcher() {
    return new GmailWatcher("mail");
}

class GmailWatcher extends EventEmitter {

    constructor(event) {
        super();
        this.EVENT = event;
        auth()
            .then((auth) => this.gmail = google.gmail({version: "v1", auth}))
            .then(this.subscriber())
            .catch(err => {
                Log.error(err, "Fail initialize gmail watcher");
            })
    }


    subscriber() { // keep use this as GmailWatcher
        return () => {
            Log.log("Watch gmail");
            subscription.on(subscription.EVENT, this.requestGmailHistory());
        }
    }

    // gmail.users.history.list request history newer than the historyId
    // Should store the last historyId and request it when the new one emitted
    calledLast(historyId) {
        const last = this.lastId;
        this.lastId = historyId;
        return last;
    }

    requestGmailHistory() {
        return ({historyId}) => {
            Log.log(Log.CONTEXT_MESSAGE_BUILDER.HISTORY(historyId, "New History"));
            historyId = this.calledLast(historyId);
            if (!historyId)
                return Log.log(Log.CONTEXT_MESSAGE_BUILDER.HISTORY(historyId, "First History"));
            this.gmail.users.history
                .list({userId: "me", historyTypes: ["messageAdded"], startHistoryId: historyId})
                .then(this.gmailListHandler(historyId))
                .then(this.requestGmailsAndEmits(historyId))
                .catch(this.gmailHistoryErrHandler(historyId))
        }
    }

    requestGmailsAndEmits(historyId) {
        return (mailIds) => {
            if (!mailIds || !mailIds.length) return;
            return Promise.all(mailIds.map((mailId) => {
                Log.log(Log.CONTEXT_MESSAGE_BUILDER.MAIL(mailId, "Request mail"));
                this.gmail.users.messages.get({userId: "me", id: mailId, format: "raw"})
                    .then(res => {
                        if (!res.data || !res.data.raw)
                            return  Log.log(Log.CONTEXT_MESSAGE_BUILDER.MAIL(mailId, "Empty mail"));
                        gmailParser.parseGmail(res.data, (err, mail, decodedMailStr) => {
                            if (mail.from.match("ktourstory"))
                                return Log.log(Log.CONTEXT_MESSAGE_BUILDER.MAIL(mailId,"Ignore mail from Ktourstory"));
                            this.emit(this.EVENT, mail);
                        })
                    })
                    .catch(this.gmailErrHandler);
            })).then(mails => mails.filter(m => !!m))
        }
    }

    gmailListHandler(historyId) {
        return (res) => {
            if (!res.data && !res.history)
                return Log.log(Log.CONTEXT_MESSAGE_BUILDER.HISTORY(historyId, "Empty gmail list response"));
            let histories = (res.history || res.data.history);
            if (!histories || !Array.isArray(histories) || !histories.length)
                return Log.log(Log.CONTEXT_MESSAGE_BUILDER.HISTORY(historyId, "Empty gmail list response history"));  //Even res.data.history contains id, ignore it
            const messageHistories = histories
                .filter((h) => (h.messagesAdded && h.messagesAdded.length > 0))
                .map(h => h.messagesAdded);
            if (!messageHistories.length)
                return Log.log(Log.CONTEXT_MESSAGE_BUILDER.HISTORY(historyId, "Not a messageAdded History"));
            return messageHistories
                .reduce((result, current) => result.concat(current))
                .map(m => "message" in m ? "id" in m.message ? m.message.id : undefined : undefined)
                .filter(id => !!id)
                .filter((id)=>!isProcessed(id))
        }
    }

    gmailErrHandler(messageId) {
        return (err) => {
            if (err.code === 404)
                return Log.error(err, Log.CONTEXT_MESSAGE_BUILDER.MESSAGE(messageId, "404 occurs on requesting message"));
            if (err.code === 403 || err.code === 429 || err.code === "ECONNRESET") { // Hit gmail API limit
                return Log.error(err, Log.CONTEXT_MESSAGE_BUILDER.MESSAGE(messageId, "Hit gmail API limit"));
            }
            Log.error(err, Log.CONTEXT_MESSAGE_BUILDER.MESSAGE(messageId, "Unknown error on request gmail message"));
        }
    }

    gmailHistoryErrHandler(historyId) {
        return (err) => {
            if (err.code === 404)
                return Log.error(err, Log.CONTEXT_MESSAGE_BUILDER.HISTORY(historyId, "404 occurs on requesting history"));
            if (err.code === 403 || err.code === 429 || err.code === "ECONNRESET") { // Hit gmail API limit
                return Log.error(err, Log.CONTEXT_MESSAGE_BUILDER.HISTORY(historyId, "Hit gmail API limit"));
            }
            Log.error(err, Log.CONTEXT_MESSAGE_BUILDER.HISTORY(historyId, "Unknown error on request gmail History"));
        }
    }
}

module.exports = singletoneGmailWatcher();