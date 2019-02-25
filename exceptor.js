const _ = require("lodash");
const Log = require("./log");
const _type = {
    // 낮음
    UNKNOWN_MAIL: "UNKNOWN_MAIL",
    UNPARSABLE_AGENCY: "UNPARSABLE_AGENCY",
    // 보통
    UNKNOWN_AGENCY_MAIL: "UNKNOWN_AGENCY_MAIL",
    KKDAY: "KKDAY",
    // 주의
    UNKNOWN_CONTENT_TYPE: "UNKNOWN_CONTENT_TYPE",
    COMPLEX_CONTENT_TYPE: "COMPLEX_CONTENT_TYPE",
    FAILED_PARSE_MAIL: "FAILED_PARSE_MAIL",
    PRIVATE_TOUR: "PRIVATE_TOUR",
    NOT_AUTO: "NOT_AUTO",
    FAILED_PARSE_RESERVATION: "FAILED_PARSE_RESERVATION",
    FAILED_UPDATE_RESERVATION_SQL: "FAILED_UPDATE_RESERVATION_SQL",
    FAILED_INSERT_RESERVATION_SQL: "FAILED_INSERT_RESERVATION_SQL",
    FAILED_INSERT_RESERVATION_FB: "FAILED_INSERT_RESERVATION_FB",
    FAILED_INSERT_RESERVATION_ELASTIC: "FAILED_INSERT_RESERVATION_ELASTIC",
    FAILED_INSERT_ACCOUNT_SQL: "FAILED_INSERT_ACCOUNT_SQL",
    VALID_CHECK_FAIL_RESERVATION: "VALID_CHECK_FAIL_RESERVATION",
    VALID_CHECK_FAIL_ACCOUNT: "VALID_CHECK_FAIL_ACCOUNT",
    FAILED_CHECK_FUNKO: "FAILED_CHECK_FUNKO",
    EMPTY_FUNKO: "EMPTY_FUNKO",
    UNKNOWN_PRODUCT: "UNKNOWN_PRODUCT",
    UNKNOWN_RESERVATION: "UNKNOWN_RESERVATION",
    UNKNOWN_ACCOUNT: "UNKNOWN_ACCOUNT",
    UNKNOWN_PICKUP: "UNKNOWN_PICKUP",
    UNKNOWN_OPTION: "UNKNOWN_OPTION",
    CLOSED_PRODUCT: "CLOSED_PRODUCT",
    NO_OBJECT_ID_IN_DATABASE: "NO_OBJECT_ID_IN_DATABASE",
    INVALID_OPERATION_TIME_OF_DAY: "INVALID_OPERATION_TIME_OF_DAY",
    INVALID_OPERATION_DAY_OF_WEEK: "INVALID_OPERATION_DAY_OF_WEEK",
    INVALID_OPERATION_DATE: "INVALID_OPERATION_DATE",
    MULTIPLE_PRICE_GROUP : "MULTIPLE_PRICE_GROUP",
    LAST_MINUTE: "LAST_MINUTE",
    NO_PEOPLE_NUMBER_INFO: "NO_PEOPLE_NUMBER_INFO",
    NO_PRICE_INFO: "NO_PRICE_INFO",
    NO_BUS_INFO: "NO_BUS_INFO",
    NO_MATCHING_PRICE_GROUP : "NO_MATCHING_PRICE_GROUP",
    // 위험
    UNKNOWN_ERROR_BOT: "UNKNOWN_ERROR_BOT",
    UNKNOWN_ERROR_SERVER: "UNKNOWN_ERROR_SERVER",
    SEND_PHOTO_MAIL_RESULT: "SEND_PHOTO_MAIL_RESULT",
    FAILED_CONFIRM_TOUR: "FAILED_CONFIRM_TOUR",
    NETWORK_ERR: "NETWORK_ERR",
    GMAIL_LIMIT: "GMAIL_LIMIT",
};

const _typeList = Object.values(_type);
const isOneOfType = (type) => _typeList.contains;

class Exceptor {
    static get TYPE() {
        return _type
    }

    /**
     * Report Exception
     * @param type {string}
     * @param message {string}
     */
    static report(type, message) {
        if (!_.isString(type) && isOneOfType(type)) throw new Error(`Wrong type param type : ${type}`);
        console.log(type, message);
    }

    /**
     *
     * @param type {string}
     * @param mail {Mail}
     * @param message {string=}
     */
    static reportWithMail(type, mail, message) {
        if (!_.isString(type) && isOneOfType(type)) throw new Error(`Wrong type param type : ${type}`);
        Log.exception(type, Log.CONTEXT_MESSAGE_BUILDER.MAIL(mail.messageid, mail.fromaddress || mail.from));
    }

    /**
     *
     * @param type {string}
     * @param agency {Agency}
     * @param mail {Mail}
     * @param message {string=}
     */
    static reportWithAgencyMail(type, agency, mail, message) {
        if (!_.isString(type) && isOneOfType(type)) throw new Error(`Wrong type param type : ${type}`);
        Log.exception(type, Log.CONTEXT_MESSAGE_BUILDER.MAIL(mail.messageid, agency.alias));
    }

    /**
     *
     * @param type {string}
     * @param reservation {Reservation}
     * @param message {string}
     */
    static reportWithReservation(type, reservation, message) {
        if (!_.isString(type) && isOneOfType(type)) throw new Error(`Wrong type param type : ${type}`);
    }
}

module.exports = Exceptor;