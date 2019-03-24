const RESERVATION_KEY_MAP = ['id', 'message_id', 'product_id', 'agency', 'reserved_name', 'nationality', 'tour_date', 'pickup', 'name', 'options', 'adult', 'kid', 'infant', 'memo', 'phone', 'email', 'messenger', 'canceled', 'created_date', 'modified_date', 'cancel_comment'];
const ACCOUNT_KEY_MAP = ['id', 'reservation_id', 'writer', 'created_date', 'category', 'currency', 'income', 'expenditure', 'cash_income', 'cash_expenditure', 'options'];
const DAY_MAP = {'MON':0,'TUE':1,'WED':2,'THU':3,'FRI':4,'SAT':5,'SUN':6,'0':'MON','1':'TUE','2':'WED','3':'THU','4':'FRI','5':'SAT','6':'SUN'};
const Product = require('./product');
const env = require('../../package.json').env;
const sqlDB = require('../auth/postgresql');
sqlDB.connect();

const ACCOUNT_VALID_CHECK_LIST_MAP = {
    'id' : false,
    'writer' : true,
    'category' : true,
    'currency' : true,
    'income' : true,
    'expenditure' : true,
    'cash' : true,
    'memo' : true,
    'created_date' : true,
    'reservation_id' : false,
    'totalMoneyCheck' : true
};

const RESERVATION_UPDATE_VALID_CHECK_LIST_MAP = {
    'id':true,
    'message_id':true,
    'writer':true,
    'agency':true,
    'tour_date':true,
    'options':false,
    'adult':true,
    'kid':true,
    'infant':true,
    'canceled':true,
    'created_date':true,
    'modified_date':true,
    'productCheck':true,
    'totalPeopleNumberCheck':true
};

const RESERVATION_CREATE_VALID_CHECK_LIST_MAP = {
    'id':false,
    'message_id':true,
    'writer':true,
    'agency':true,
    'tour_date':true,
    'options':false,
    'adult':true,
    'kid':true,
    'infant':true,
    'canceled':true,
    'created_date':true,
    'modified_date':true,
    'productCheck':true,
    'totalPeopleNumberCheck':true
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
        ['memo', [data.memo, 'string']],
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
        ['memo', validCheckOptionalItem],
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
function validCheckObjectSQL (table, field, objectId) {
    const tempValue = (typeof objectId === 'string') ? `"${objectId}"` : objectId;
    const query = `SELECT EXISTS(SELECT 1 FROM ${table} WHERE ${field} = ${tempValue})`;
    // console.log('validCheckObjectSQL - query : ',table,field, objectId, query);
    return new Promise((resolve, reject) => {
        sqlDB.query(query, (err, result) => {
            if (err) throw new Error(`validCheckObjectSQL failed : [${table}, ${field}, ${objectId}]`);
            if (!result || result.rowCount <= 0 || !result.rows[0].exists) {
                // Exceptor.report(Exceptor.TYPE.NO_OBJECT_ID_IN_DATABASE, `No object. table & field : ${table} & ${field} / object id : ${objectId}`);
                resolve(false)}
            resolve(true);
        });
    }).catch(err => {return err.message;})
}

function validCheckProduct(product_id, tour_date) {
    let product;
    return Product.getProduct(product_id)
        .then(result => {
            if (!result) {
                // Exceptor.report(Exceptor.TYPE.UNKNOWN_PRODUCT, `Unknown product id in reservation : ${product_id}`);
                return false;}
            product = result;
            return product.on === 'ON' })
        .then(statusCheck => {
            if (!statusCheck) {
                // Exceptor.report(Exceptor.TYPE.CLOSED_PRODUCT, `Product Status is STOP. product_id : ${product_id}`);
                return false;}
            return Product.getAvailablePriceGroup(tour_date, product) })
        .then(availablePriceGroup => {
            if (!availablePriceGroup) return false;
            return availablePriceGroup.length > 1;
        });
}

function validCheckSimpleItem(item, type) {
    return new Promise((resolve, reject) => {
        if (!!item && typeof item === type) resolve(true);
        else resolve(false);
    });
}
function validCheckOptionalItem(item, type) {
    return new Promise((resolve, reject) => {
        if (type === 'string' && item === '') resolve(true);
        else if (type === 'boolean' && typeof item === type) resolve(true);
        else if (!!item && typeof item === type) resolve(true);
        else resolve(false);
    });
}
/**
 *
 * @param tour_date {Date} Local date (UTC+9)
 * @param product_id {Number} product id
 * @returns {Promise<any | never | boolean>}
 */
function validCheckOperationDateTime(tour_date, product_id) {
    let product;
    if (!tour_date) throw new Error(`operation date is undefined ${tour_date}`);
    if (!product_id) throw new Error(`product id is undefined ${product_id}`);
    return new Promise((resolve, reject) => {
        resolve(validCheckSimpleDateTime(tour_date))})
        .then(simpleCheck => {
            // console.log('validCheckOperationDateTime - simpleCheck : ', simpleCheck);
            if (!simpleCheck) return false;
            return Product.getProduct(product_id)})
        .then(result => {
            product = result;
            // console.log('validCheckOperationDateTime - product : ', !!product);
            if (!result) {
                // Exceptor.report(Exceptor.TYPE.UNKNOWN_PRODUCT, `No product in product map. product_id : ${product_id}`);
                throw new Error('UNKNOWN_PRODUCT'); }
            return validCheckDayOfWeek(product, tour_date)})
        .then(dayCheck => {
            // console.log('validCheckOperationDateTime - dayCheck : ', dayCheck);
            if (!dayCheck) {
                // Exceptor.report(Exceptor.TYPE.INVALID_OPERATION_DAY_OF_WEEK, `Operation Date Wrong day. product_id : ${product_id}`);
                throw new Error('INVALID_OPERATION_DAY_OF_WEEK')}
            return Product.checkValidFBDate(tour_date, product.tour_begin, product.tour_end, product.timezone)})
        .then(tourDateCheck => {
            if (!tourDateCheck) throw new Error('Invalid Operation date at tourDateCheck!');
            return Product.checkValidFBDate(new Date(), product.reserve_begin, product.reserve_end, product.timezone)})
        .then((priceGroupCheck) => {
            if (!priceGroupCheck) throw new Error('price group check failed!');
            if (env.released) return new Date().getTime() - tour_date.getTime() < product.deadline;
            return true;
        }).catch(err => {return false});
}
// sqlDB.query('SELECT tour_date, product_id from reservation where id = 98', (err, result) => {
//     // console.log(result)
//     date = result.rows[0].tour_date;
//     validCheckOperationDateTime(date, result.rows[0].product_id)
//         .then(result => console.log(result));
// })

function validCheckPeopleNumber(number) {
    return new Promise((resolve, reject) => {
        if (number === 'NaN') resolve(false);
        if (typeof number === 'number') resolve(true);
        else resolve(false);
    });
}

function simpleCheck(input, length, limitNumber) {
    return new Promise((resolve, reject) => {
        if (!!input && input.length === length && Number(input) <= limitNumber) {resolve(true)}
        else {resolve(false)}
    });
}
/**
 * check structure of date / time
 * example of input : Date object || '2018-04-23T16:46:5800Z'
 * @param input
 * @returns {*}
 */
function validCheckSimpleDateTime(input) {
    if (!input) return Promise.resolve(false);
    const date = (typeof input === 'string') ? input : input.toISOString();
    const array = date.split('T');
    const dateArray = array[0].split('-');
    const timeArray = array[1].split(':');
    // console.log(dateArray, timeArray);
    if (dateArray.length === 3 && timeArray.length === 3) {
        return Promise.all([
            simpleCheck(dateArray[0], 4, 9999),
            simpleCheck(dateArray[1], 2, 12),
            simpleCheck(dateArray[2], 2, 31),
            simpleCheck(timeArray[0], 2, 24),
            simpleCheck(timeArray[1], 2, 60),
            simpleCheck(timeArray[2].split('.')[0], 2, 60) ])
            .then(result => {
                // console.log('simple check result : ',result);
                return !result.includes(false);
            }).catch(err => {return false});
    } else { return Promise.resolve(false) }
}
/**
 *
 * @param product {Object} product object
 * @param date {Date} operation date
 * @returns {*}
 */
function validCheckDayOfWeek(product, date) {
    const correctedDate = Product.getReverseTimezoneDate(date, product.timezone);
    // console.log('validCheckDayOfWeek : ', date, ' correctedDate -> ', correctedDate);
    let tourDay = new Date(correctedDate).getDay() - 1;
    tourDay = (tourDay < 0) ? 6 : tourDay;
    // console.log(`tourDay : ${tourDay}, operation day : ${product.days}`);
    return product.days[tourDay];
}


function validCheckMoney(money) {
    return new Promise((resolve, reject) => {
        if (typeof money === 'number' && money !== 'NaN') resolve(true);
        resolve(false);
    });
}
function validCheckTotalPeopleNumber(adult, kid, infant){
    return new Promise((resolve, reject) => {
        resolve(adult + kid + infant > 0);
    });
}

function validCheckTotalMoneyAmount(income, expenditure){
    return new Promise((resolve, reject) => {
        if (income === 0 && expenditure === 0) {
            // Exceptor.report(Exceptor.TYPE.NO_PRICE_INFO, 'sum of money is zero')
            resolve(false);
        } else { resolve(true) }
    });
}

/**
 *
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
            // console.log('validDataCheck result : ',checkObject);
            return {result:!checkList.includes(false), detail:checkObject};
        }).catch(err => console.log(err));
}
function validReservationUpdateCheck(reservation) {
    console.log('update validation!')
    return validDataCheck(reservation, RESERVATION_VALID_CHECK_PARAMETER_MAP, RESERVATION_UPDATE_VALID_CHECK_LIST_MAP, RESERVATION_VALID_CHECK_FUNCTION_MAP)
        .catch(err => {
            Exceptor.report(Exceptor.TYPE.VALID_CHECK_FAIL_RESERVATION, `Error occurred while update Reservation validation`);
            return false;
        });
}
function validReservationCreateCheck(reservation) {
    console.log('create validation!')
    return validDataCheck(reservation, RESERVATION_VALID_CHECK_PARAMETER_MAP, RESERVATION_CREATE_VALID_CHECK_LIST_MAP, RESERVATION_VALID_CHECK_FUNCTION_MAP)
        .catch(err => {
            Exceptor.report(Exceptor.TYPE.VALID_CHECK_FAIL_RESERVATION, `Error occurred while create Reservation validation`);
            return false;
        });
}
function validAccountCheck(account) {
    console.log('account check!');
    return validDataCheck(account, ACCOUNT_VALID_CHECK_PARAMETER_MAP, ACCOUNT_VALID_CHECK_LIST_MAP, ACCOUNT_VALID_CHECK_FUNCTION_MAP)
        .catch(err => {
            Exceptor.report(Exceptor.TYPE.VALID_CHECK_FAIL_ACCOUNT, `Error occured while Account validation`);
            return false;
        });
}
exports.RESERVATION_KEY_MAP = RESERVATION_KEY_MAP;
exports.ACCOUNT_KEY_MAP = ACCOUNT_KEY_MAP;
exports.DAY_MAP = DAY_MAP;
exports.validReservationCreateCheck = validReservationCreateCheck;
exports.validReservationUpdateCheck = validReservationUpdateCheck;
exports.validAccountCheck = validAccountCheck;