const config = require("../config");
const Log = require("../../log");
const {EventEmitter} = require("events");
const PubSub = require("@google-cloud/pubsub");
const pubsubClient = new PubSub({projectId: config.gcp_projectId});
const subscription = pubsubClient.subscription("watcher");
const publish = require("./pub");

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

function singleTonMailListener() {
    return new Sub("history");
}

class Sub extends EventEmitter {
    constructor(event) {
        super();
        this.EVENT = event;
        publish()
            .then(this.subscriber())
            .catch(err => {
                Log.error(err, "Fail initialize subscription");
            });
    }

    subscriber() {
        return () => {
            Log.log("Subscribe on");
            subscription.on("message", (msg) => {
                Log.log(Log.CONTEXT_MESSAGE_BUILDER.MESSAGE(msg.id, "New Message"));
                msg.ack();
                const data = "data" in msg ? JSON.parse(msg.data) : undefined;
                if (!data || !data.historyId) return Log.log("Empty message"); //Empty message
                if (isProcessed(data.historyId)) return Log.log(Log.CONTEXT_MESSAGE_BUILDER.MESSAGE(msg.id, "History has been acked")); //Message has been treated, pub/sub can send duplicated message
                this.emit(this.EVENT, data)
            });
            subscription.on("error", (err) => Log.error(err, "Fail subscribe"))
        }
    }
}

module.exports = singleTonMailListener();