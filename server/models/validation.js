const RESERVATION_KEY_MAP = ['id', 'message_id', 'writer', 'product_id', 'agency', 'agency_code', 'tour_date', 'options', 'adult', 'kid', 'infant', 'canceled', 'created_date', 'modified_date', 'nationality'];
const ACCOUNT_KEY_MAP = ['id', 'writer', 'category', 'currency', 'income', 'expenditure', 'cash', 'created_date','reservation_id', 'sub_category', 'card_number', 'contents','v1'];
const DAY_MAP = {'MON':0,'TUE':1,'WED':2,'THU':3,'FRI':4,'SAT':5,'SUN':6,'0':'MON','1':'TUE','2':'WED','3':'THU','4':'FRI','5':'SAT','6':'SUN'};
const TIME_OFFSET_MAP = {'UTC0':0,'UTC+1':-60,'UTC+2':-120,'UTC+3':-180,'UTC+4':-240,'UTC+5':-300,'UTC+6':-360, 'UTC+7':-420,'UTC+8':-480,'UTC+9':-540,'UTC+10':-600,'UTC+11':-660,'UTC+12':-720,'UTC-1':60,'UTC-2':120,'UTC-3':180,'UTC-4':240,'UTC-5':300,'UTC-6':360,'UTC-7':420,'UTC-8':480,'UTC-9':540,'UTC-10':600,'UTC-11':660};
const Product = require('./product');
const env = require('../../package.json').env;
const sqlDB = require('../auth/postgresql');
const log = require('../../log');
sqlDB.connect();

const ACCOUNT_VALID_CHECK_LIST_MAP = {
    'id' : false,
    'writer' : true,
    'category' : true,
    'currency' : true,
    'income' : true,
    'expenditure' : true,
    'cash' : false,
    'created_date' : true,
    'reservation_id' : false,
    'totalMoneyCheck' : true,
    'sub_category' : false,
    'card_number' : false,
    'contents' : false,
    'v1' : false
};

const RESERVATION_UPDATE_VALID_CHECK_LIST_MAP = {
    'id':true,
    'message_id':true,
    'writer':false,
    'agency':true,
    'agency_code':false,
    'tour_date':true,
    'options':false,
    'adult':true,
    'kid':true,
    'infant':true,
    'canceled':false,
    'created_date':false,
    'modified_date':false,
    'productCheck':true,
    'totalPeopleNumberCheck':true,
    'nationality' : false
};

const RESERVATION_CREATE_VALID_CHECK_LIST_MAP = {
    'id':false,
    'message_id':true,
    'writer':false,
    'agency':true,
    'agency_code':false,
    'tour_date':true,
    'options':true,
    'adult':true,
    'kid':true,
    'infant':true,
    'canceled':false,
    'created_date':false,
    'modified_date':false,
    'productCheck':true,
    'totalPeopleNumberCheck':true,
    'nationality' : false
};

/**
 * Parameter Map for reservation validation
 * @param data {Object} Reservation object
 * @returns {Map<any, any>} Reservation parameter map
 * @constructor
 */
function RESERVATION_VALID_CHECK_PARAMETER_MAP(data) {
    return new Map([
        ['id', ['reservation', 'id', data.id]],
        ['message_id', [data.message_id, 'string']],
        ['writer', [data.writer, 'string']],
        ['agency', [data.agency, 'string']],
        ['agency_code', [data.agency_code, 'string']],
        ['tour_date', [data.tour_date, data.product_id]],
        ['options', [data.options, 'object']],
        ['adult', [data.adult]],
        ['kid', [data.kid]],
        ['infant', [data.infant]],
        ['canceled', [data.canceled, 'boolean']],
        ['created_date', [data.created_date]],
        ['modified_date', [data.modified_date]],
        ['productCheck', [data.product_id, data.tour_date]],
        ['totalPeopleNumberCheck', [data.adult, data.kid, data.infant]],
    ]);
}

/**
 * Parameter Map for account validation
 * @param data {Object} Account object
 * @returns {Map<any, any>} Account parameter map
 * @constructor
 */
function ACCOUNT_VALID_CHECK_PARAMETER_MAP(data) {
    return new Map([
        ['id', ['account', 'id', data.id]],
        ['writer', [data.writer, 'string']],
        ['category', [data.category, 'string']],
        ['currency', [data.currency, 'string']],
        ['income', [data.income]],
        ['expenditure', [data.expenditure]],
        ['cash', [data.cash, 'boolean']],
        ['created_date', [data.created_date]],
        ['reservation_id', ['reservation', 'reservation_id', data.reservation_id]],
        ['totalMoneyCheck', [data.income, data.expenditure]]
    ]);
}

/**
 * Function Map for Reservation validation
 * @returns {Map<any, any>} Reservation function map
 * @constructor
 */
function RESERVATION_VALID_CHECK_FUNCTION_MAP() {
    return new Map([
        ['id', validCheckObjectSQL],
        ['message_id',validCheckSimpleItem],
        ['writer', validCheckOptionalItem],
        ['agency',validCheckSimpleItem],
        ['agency_code',validCheckSimpleItem],
        ['tour_date', validCheckOperationDateTime],
        ['options',validCheckOptionalItem],
        ['adult', validCheckPeopleNumber],
        ['kid', validCheckPeopleNumber],
        ['infant', validCheckPeopleNumber],
        ['canceled', validCheckSimpleItem],
        ['created_date', validCheckSimpleDateTime],
        ['modified_date', validCheckSimpleDateTime],
        ['productCheck',validCheckProduct],
        ['totalPeopleNumberCheck', validCheckTotalPeopleNumber],
    ]);
}

/**
 * Function Map for Account validation
 * @returns {Map<any, any>} Account function map
 * @constructor
 */
function ACCOUNT_VALID_CHECK_FUNCTION_MAP() {
    return new Map([
        ['id', validCheckObjectSQL],
        ['writer', validCheckOptionalItem],
        ['category', validCheckOptionalItem],
        ['currency', validCheckSimpleItem],
        ['income', validCheckMoney],
        ['expenditure', validCheckMoney],
        ['cash', validCheckSimpleItem],
        ['created_date', validCheckSimpleDateTime],
        ['reservation_id', validCheckObjectSQL],
        ['totalMoneyCheck', validCheckTotalMoneyAmount]
    ]);
}

/**
 * Check if object ID exist in postgreSQL.
 * @param table {String} table name of database
 * @param field {String} field name of table
 * @param objectId {String | Number} object id
 * @returns {Promise<boolean>} return true if table has objectId in certain field.
 */
function validCheckObjectSQL(table, field, objectId) {
    const tempValue = (typeof objectId === 'string') ? `'${objectId}'` : objectId;
    const query = `SELECT EXISTS(SELECT 1 FROM ${table} WHERE ${field} = ${tempValue})`;
    return new Promise((resolve, reject) => {
        sqlDB.query(query, (err, result) => {
            if (err || !result || result.rowCount <= 0 || !result.rows[0].exists) {
                log.warn('Validation','validCheckObjectSQL', `sqlDB query failed : [query : ${query}, objectId : ${objectId}]`);
                resolve(false)}
            resolve(true);
        });
    }).catch(err => {return err.message;})
}

/**
 * check if product is valid.
 * product is retrieved from productMap and check status, price group.
 * @param product_id {String}
 * @param tour_date {String || Date}
 * @returns {Promise<T | never>}
 */
function validCheckProduct(product_id, tour_date) {
    let product;
    return Product.getProduct(product_id)
        .then(result => {
            if (!result) {
                log.warn('Validation','validCheckProduct', `getProduct failed : ${product_id}`);
                return false;}
            product = result;
            return product.on === 'ON' })
        .then(statusCheck => {
            if (!statusCheck) {
                log.warn('Validation','validCheckProduct', 'statusCheck failed. product.on is not TRUE');
                return false;}
            log.debug('Debug','validCheckProduct status check', `statusCheck success with ${product_id}`);
            return Product.getAvailablePriceGroup(tour_date, product) })
        .then(availablePriceGroup => {
            if (!availablePriceGroup) return false;
            if (availablePriceGroup.length === 0) {
                log.warn('Validation','validCheckProduct', `availablePriceGroup failed number of available price group : ${availablePriceGroup.length}`);
                return false;
            }
            log.debug('Debug','validCheckProduct price group check', `availablePriceGroup check success with ${availablePriceGroup[0].name}`);
            return availablePriceGroup.length > 0;
        });
}

/**
 * check simple item. only compare type.
 * @param item {any}
 * @param type {String}
 * @returns {Promise<any>}
 */
function validCheckSimpleItem(item, type) {
    return new Promise((resolve, reject) => {
        if (typeof item !== 'boolean' && !item) resolve(false);
        else if (typeof item === type) resolve(true);
        else resolve(false);
    });
}

/**
 * check optional item
 * @param item {any}
 * @param type {String}
 * @returns {Promise<any>}
 */
function validCheckOptionalItem(item, type) {
    return new Promise((resolve, reject) => {
        if (type === 'string' && item === '') resolve(true);
        else if (type === 'boolean' && typeof item === type) resolve(true);
        else if (!!item && typeof item === type) resolve(true);
        else resolve(false);
    });
}
/**
 * validation check for tour_date(operation date) of reservation.
 * simple string, availability of day of week, tour_date valid check with available reservation date, price group is checked.
 * @param tour_date {Date} Local date (UTC+9)
 * @param product_id {Number} product id
 * @returns {PromiseLike<any | never | boolean | never>}
 */
function validCheckOperationDateTime(tour_date, product_id) {
    let product;
    const tourDateCheckTask = {simpleLengthCheck:false, getProduct:false, validCheckDayOfWeek:false, checkTourDateInValidRange:false, getAvailablePriceGroup:false};
    if (!tour_date) {
        log.warn('Validation', 'validCheckOperationDateTime', 'tour_date is undefined');
        return Promise.resolve(false);}
    if (!product_id) {
        log.warn('Validation', 'validCheckOperationDateTime', 'product_id is undefined');
        return Promise.resolve(false);}
    return validCheckSimpleDateTime(tour_date)
        .then(simpleLengthCheck => {
            if (!simpleLengthCheck) return false;
            tourDateCheckTask.simpleLengthCheck = true;
            log.debug('Validation','validCheckOperationDateTime','validCheckSimpleDateTime passed');
            return Product.getProduct(product_id)})
        .then(result => {
            product = result;
            if (!result) return false;
            tourDateCheckTask.getProduct = true;
            log.debug('Validation','validCheckOperationDateTime','get Product passed');
            return validCheckDayOfWeek(product, tour_date)})
        .then(dayCheck => {
            if (!dayCheck) return false;
            tourDateCheckTask.validCheckDayOfWeek = true;
            log.debug('Validation','validCheckOperationDateTime','dayCheck passed');
            return Product.checkTourDateInValidRange(tour_date, product.tour_begin, product.tour_end, product.timezone)})
        .then(tourDateCheck => {
            if (!tourDateCheck) return false;
            tourDateCheckTask.checkTourDateInValidRange = true;
            log.debug('Validation','validCheckOperationDateTime','tourDateCheck passed');
            return Product.getAvailablePriceGroup(tour_date, product)})
        .then((priceGroupCheck) => {
            if (!priceGroupCheck) return false;
            tourDateCheckTask.getAvailablePriceGroup = true;
            log.debug('Validation','validCheckOperationDateTime','priceGroupCheck passed');
            if (String(product_id).indexOf('test') > -1) return true;
            if (env.released) return ((new Date(tour_date).getTime() - new Date(2018,4,13).getTime()) / (60 * 60 * 1000)) >= product.deadline;
            return true;})
        .then(result => {
            if (result) return true;
            if (!tourDateCheckTask.simpleLengthCheck) log.warn('Validation', 'simpleLengthCheck',`simple lenght check failed : ${tour_date}`);
            else if (!tourDateCheckTask.getProduct) log.warn('Validation', 'validCheckOperationDateTime',`getProduct failed. [${product_id}] is not in productMap.`);
            else if (!tourDateCheckTask.validCheckDayOfWeek) log.warn('Validation', 'validCheckOperationDateTime', 'dayCheck failed. invalid operation day of week');
            else if (!tourDateCheckTask.checkTourDateInValidRange) log.warn('Validation','validCheckOperationDateTime', 'tourDateCheck failed');
            else if (!tourDateCheckTask.getAvailablePriceGroup) log.warn('Valdation','validCheckOperationDateTime', 'priceGroupCheck failed. no existing price group in product');
            return false;
        });
}

/**
 * people number check
 * @param number {Number} people number
 * @returns {Promise<any>}
 */
function validCheckPeopleNumber(number) {
    return new Promise((resolve, reject) => {
        if (number === 'NaN') resolve(false);
        else if (typeof number === 'number' && number >= 0) resolve(true);
        else resolve(false);
    });
}

/**
 * simple length check for date and time element.
 * @param input {Number}
 * @param length {Number}
 * @param limitNumber {Number}
 * @returns {Promise<any>}
 */
function simpleLengthCheck(input, length, limitNumber) {
    return new Promise((resolve, reject) => {
        if (!!input && input.length === length && Number(input) <= limitNumber) {resolve(true)}
        else {resolve(false)}
    });
}
/**
 * check structure of date / time
 * example of input : Date object || '2018-04-23T16:46:5800Z'
 * @param input {String || Date} input can be String(only Date) and Date object(Date and Time)
 * @returns {*}
 */
function validCheckSimpleDateTime(input) {
    if (!input) return Promise.resolve(false);
    let dateArray = [];
    let timeArray = [];
    const date = (typeof input === 'string') ? input : input.toISOString();
    if (date.match('T')){
        const array = date.split('T');
        dateArray = array[0].split('-');
        timeArray = array[1].split(':');
    } else {
        dateArray = date.split('-');
    }
    if (dateArray.length === 3 && timeArray.length === 3) {
        return Promise.all([
            simpleLengthCheck(dateArray[0], 4, 9999),
            simpleLengthCheck(dateArray[1], 2, 12),
            simpleLengthCheck(dateArray[2], 2, 31),
            simpleLengthCheck(timeArray[0], 2, 24),
            simpleLengthCheck(timeArray[1], 2, 60),
            simpleLengthCheck(timeArray[2].split('.')[0], 2, 60)])
            .then(result => {
                // console.log('simple check result : ',result);
                return !result.includes(false)})
    } else if (dateArray.length === 3) {
        return Promise.all([
            simpleLengthCheck(dateArray[0], 4, 9999),
            simpleLengthCheck(dateArray[1], 2, 12),
            simpleLengthCheck(dateArray[2], 2, 31)])
            .then(result => {
                return !result.includes(false)})
    } else { return Promise.resolve(false) }
}

/**
 * check weekday schedule of each product.
 * 0 : Monday, 6 : Sunday
 * @param product {Object} product object
 * @param date {Date} operation date
 * @returns {*}
 */
function validCheckDayOfWeek(product, date) {
    let correctedDate;
    if (new Date().getTimezoneOffset() === 0) correctedDate = new Date(date);
    else correctedDate = Product.getReverseTimezoneDate(date, new Date().getTimezoneOffset());
    // console.log('validCheckDayOfWeek : ', date, ' correctedDate -> ', correctedDate);
    let tourDay = new Date(correctedDate).getDay() - 1;
    tourDay = (tourDay < 0) ? 6 : tourDay;
    log.debug('Validation', 'validCheckDayOfWeek', `tourDay : ${tourDay}, operation day : ${JSON.stringify(product.days)}`)
    return product.days[tourDay];
}

/**
 * valid check money
 * @param money {Number}
 * @returns {Promise<any>}
 */
function validCheckMoney(money) {
    return new Promise((resolve, reject) => {
        if (typeof money === 'number' && money !== 'NaN' && money >= 0) resolve(true);
        resolve(false);
    });
}

/**
 * valid check for Total people number : adult & kid & infant.
 * at least one of adult, kid, infant should be bigger than 0.
 * @param adult {Number}
 * @param kid {Number}
 * @param infant {Number}
 * @returns {Promise<any>}
 */
function validCheckTotalPeopleNumber(adult, kid, infant){
    return new Promise((resolve, reject) => {
        if (adult + kid + infant > 0) resolve(true)
        resolve(false)
    });
}

/**
 * valid check for Total money : income & expenditure.
 * at least one of income ,expenditure should be bigger than 0.
 * @param income {Number}
 * @param expenditure {Number}
 * @returns {Promise<any>}
 */
function validCheckTotalMoneyAmount(income, expenditure){
    return new Promise((resolve, reject) => {
        if (income === 0 && expenditure === 0) {
            resolve(false);
        } else { resolve(true) }
    });
}

/**
 * function to build promise array for validation check.
 * check list, parameter map, function map for Reservation / Account is used to make array.
 * @param list {Array} check list array
 * @param paramMap {Object} parameter map : JSON
 * @param functionMap {Map} function map : MAP
 * @returns {{array: Array, keys: Array}}
 */
function buildPromiseArray(list, paramMap, functionMap) {
    let result = {array:[],keys:[]};
    Object.keys(list).forEach((key, index) => {
        if (list[key]) {
            result.array.push(functionMap.get(key).apply(this, paramMap.get(key)));
            result.keys.push(key);
        }
    });
    return result;
}
/**
 * validation check for reservation / account object according to check list.
 * @param object {Object} object (reservation || account)
 * @param paramMap {Object} parameter map : JSON
 * @param checkList {Array} validation check list : Array
 * @param functionMap {function(): Map<any, any>} function map : MAP
 * @returns {Promise<{result: boolean, detail} | never>}
 */
function validDataCheck(object, paramMap ,checkList, functionMap) {
    const checkObject = {};
    const promiseArray = buildPromiseArray(checkList, paramMap(object), functionMap());
    const checkKey = promiseArray.keys;
    return Promise.all(promiseArray.array)
        .then(checkList => {
            checkList.forEach((bool, index) => {checkObject[checkKey[index]] = bool});
            return {result:!checkList.includes(false), detail:checkObject};
        }).catch(err => {
            console.log(err);
            log.error('Validation', 'validDataCheck', 'check failed due to rejection');
            return {result:false, detail:'error'};
        });
}

/**
 * validation check for reservation update (reservation is already exist)
 * @param reservation {Object}
 * @returns {Promise<{result: boolean, detail} | never | boolean>}
 */
function validReservationUpdateCheck(reservation) {
    return validDataCheck(reservation.sqlData, RESERVATION_VALID_CHECK_PARAMETER_MAP, RESERVATION_UPDATE_VALID_CHECK_LIST_MAP, RESERVATION_VALID_CHECK_FUNCTION_MAP)
}

/**
 * validation check for reservation create
 * @param reservation {Object}
 * @returns {Promise<{result: boolean, detail} | never | boolean>}
 */
function validReservationCreateCheck(reservation) {
    console.log('reservation validation check!');
    return validDataCheck(reservation.sqlData, RESERVATION_VALID_CHECK_PARAMETER_MAP, RESERVATION_CREATE_VALID_CHECK_LIST_MAP, RESERVATION_VALID_CHECK_FUNCTION_MAP)
}

/**
 * validation for account creation. account cannot be modified.
 * @param account
 * @returns {Promise<{result: boolean, detail} | never | boolean>}
 */
function validAccountCheck(account) {
    return validDataCheck(account.sqlData, ACCOUNT_VALID_CHECK_PARAMETER_MAP, ACCOUNT_VALID_CHECK_LIST_MAP, ACCOUNT_VALID_CHECK_FUNCTION_MAP)
}

exports.RESERVATION_KEY_MAP = RESERVATION_KEY_MAP;
exports.ACCOUNT_KEY_MAP = ACCOUNT_KEY_MAP;
exports.DAY_MAP = DAY_MAP;
exports.TIME_OFFSET_MAP = TIME_OFFSET_MAP;
exports.validReservationCreateCheck = validReservationCreateCheck;
exports.validReservationUpdateCheck = validReservationUpdateCheck;
exports.validAccountCheck = validAccountCheck;