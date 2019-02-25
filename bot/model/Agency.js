const _ = require("lodash");
const Log = require("../../log");
const database = require("../../firebase/index").database;
/**
 *
 * @type {[Agency]}
 */
let AGENCY_LIST = [];


/**
 * Class represents Agency
 */
class Agency {
    /**
     * Find matching Agecny based on its address (mail)
     * @param address {string}
     * @return {Agency|null}
     */
    static find(address) {
        const idx = AGENCY_LIST.findIndex((agency, idx) => !!(agency.from && address.match(agency.from)));
        return idx >= 0 ? AGENCY_LIST[idx] : null;
    }

    constructor(raw) {
        this.id = raw.id;
        this.alias = raw.alias;
        this.name = raw.name;
        this.from = _.isString(raw.from) && raw.from.trim().length > 0 ? new RegExp(raw.from) : null;
        this.subject = _.isString(raw.subject) && raw.subject.trim().length > 0 ? new RegExp(raw.subject) : null;
        this.parsable = raw.parsable === true || false;
        this.parsingStrategy = _.isString(raw.parsingStrategy) && raw.parsingStrategy.includes("reservation")
            ? new Function("reservation", "mail", raw.parsingStrategy)
            : _.isObject(raw.parsingStrategy)
                ? _.assignWith(this, raw.parsingStrategy, (o, s) => new Function("reservation", "mail", s))
                : null;
    }

    // agency list{}

}

(function prep() {
    const cb = (snapshot) => {
        if (!snapshot.exists() && !snapshot.hasChildren()) Log.error(new Error("Fail read agency list"), "No Agency Data");
        const rawAgencies = snapshot.val();
        AGENCY_LIST = Object.values(rawAgencies).map(a => new Agency(a));
        //todo only for test
        AGENCY_LIST.push(new Agency({
            id: "test",
            alias: "test",
            name: "test",
            from: "kdh7337",
            subject: "test",
            parsable: true,
            parsingStrategy:"return {test:mail.content}"
        }))
    };
    const err = (error) => {
        Log.error(new Error("Fail read agency list"), error.code);
    };
    database.ref("agency").on("value", cb, err);
})();

module.exports = Agency;

/**
 * Email Watching bot verify the agency based on message email domain and its id (who use gmail)
 * 1. The number of agency would not be that many (less than 1000)
 *
 * 1.
 *
 *
 * {
 *     id: Agency Id,
 *     regex: regex to tell from where,
 *
 * }
 */