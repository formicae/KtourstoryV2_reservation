const RESERVATION_KEY_MAP = ['id', 'mail_id', 'product_id', 'agency_id', 'reserved_name', 'nationality', 'operation_date', 'pickup_place', 'name', 'option', 'adult', 'child', 'infant', 'memo', 'phone', 'email', 'messenger', 'canceled', 'reserved_date', 'modify_date', 'cancel_comment'];
const ACCOUNT_KEY_MAP = ['id', 'reservation_id', 'writer', 'created', 'category', 'currency', 'card_income', 'card_expenditure', 'cash_income', 'cash_expenditure', 'option'];
const DAY_MAP = {'MON':0,'TUE':1,'WED':2,'THU':3,'FRI':4,'SAT':5,'SUN':6,'0':'MON','1':'TUE','2':'WED','3':'THU','4':'FRI','5':'SAT','6':'SUN'};
const env = require('../../package.json').env;
const Exceptor = require('../../exceptor');
const Product = require('./product');
const sqlDB = require('../databaseAuth/postgresql');
sqlDB.connect();
const ACCOUNT_VALID_CHECK_LIST_MAP = {
    'account_id' : false,
    'reservation_id' : true,
    'writer' : true,
    'created' : true,
    'category' : true,
    'currency' : true,
    'card_income' : true,
    'card_expenditure' : true,
    'cash_income' : true,
    'cash_expenditure' : true,
    'option' : false,
    'totalMoneyCheck' : true
};
const RESERVATION_UPDATE_VALID_CHECK_LIST_MAP = {
    'reservation_id':true,
    'mail_id':true,
    'productCheck':true,
    'agency_id':true,
    'reserved_name':true,
    'nationality':true,
    'operation_date':true,
    'pickup_place':true,
    'name':true,
    'option':false,
    'adult':true,
    'child':true,
    'infant':true,
    'memo':false,
    'phone':false,
    'email':false,
    'messenger':false,
    'canceled':true,
    'reserved_date':true,
    'modify_date':true,
    'cancel_comment':false,
    'totalPeopleNumberCheck':true
};
const RESERVATION_CREATE_VALID_CHECK_LIST_MAP = {
    'reservation_id':false,
    'mail_id':true,
    'productCheck':true,
    'agency_id':true,
    'reserved_name':true,
    'nationality':true,
    'operation_date':true,
    'pickup_place':true,
    'name':true,
    'option':false,
    'adult':true,
    'child':true,
    'infant':true,
    'memo':false,
    'phone':false,
    'email':false,
    'messenger':false,
    'canceled':false,
    'reserved_date':true,
    'modify_date':true,
    'cancel_comment':false,
    'totalPeopleNumberCheck':true
};
function RESERVATION_VALID_CHECK_PARAMETER_MAP(data) {
    return new Map([
        ['reservation_id', ['reservation', 'id', Number(data.id), 'number']],
        ['mail_id', [data.mail_id, 'string']],
        ['productCheck', [data.product_id, data.operation_date]],
        ['agency_id', [data.agency_id, 'string']],
        ['reserved_name', [data.reserved_name, 'string']],
        ['nationality', [data.nationality, 'string']],
        ['operation_date', [data.operation_date, data.product_id]],
        ['pickup_place', [data.pickup_place, 'string']],
        ['name', [data.name, 'string']],
        ['option', [data.option, 'object']],
        ['adult', [Number(data.adult)]],
        ['child', [Number(data.child)]],
        ['infant', [Number(data.infant)]],
        ['memo', [data.memo, 'string']],
        ['phone', [data.phone, 'string']],
        ['email', [data.email, 'string']],
        ['messenger', [data.messenger, 'string']],
        ['canceled', [Boolean(data.canceled), 'boolean']],
        ['reserved_date', [data.reserved_date]],
        ['modify_date', [data.modify_date]],
        ['cancel_comment', [data.cancel_comment, 'string']],
        ['totalPeopleNumberCheck', [Number(data.adult), Number(data.child), Number(data.infant)]],
    ]);
}
function ACCOUNT_VALID_CHECK_PARAMETER_MAP(data) {
    return new Map([
        ['account_id', ['account', 'id', Number(data.id), 'number']],
        ['reservation_id', ['reservation', 'id', Number(data.reservation_id), 'number']],
        ['writer', [data.writer, 'string']],
        ['created', [data.created]],
        ['category', [data.category, 'string']],
        ['currency', [data.currency, 'string']],
        ['card_income', [Number(data.card_income)]],
        ['card_expenditure', [Number(data.card_expenditure)]],
        ['cash_income', [Number(data.cash_income)]],
        ['cash_expenditure', [Number(data.cash_expenditure)]],
        ['option', [data.option, 'object']],
        ['totalMoneyCheck', [Number(data.card_income), Number(data.card_expenditure), Number(data.cash_income), Number(data.cash_expenditure)]]
    ]);
}
function RESERVATION_VALID_CHECK_FUNCTION_MAP() {
    return new Map([
        ['reservation_id', validCheckObjectSQL],
        ['mail_id',validCheckSimpleItem],
        ['productCheck',validCheckProduct],
        ['agency_id',validCheckSimpleItem],
        ['reserved_name',validCheckOptionalItem],
        ['nationality',validCheckOptionalItem],
        ['operation_date', validCheckOperationDateTime],
        ['pickup_place', validCheckOptionalItem],
        ['name', validCheckSimpleItem],
        ['option',validCheckOptionalItem],
        ['adult', validCheckPeopleNumber],
        ['child', validCheckPeopleNumber],
        ['infant', validCheckPeopleNumber],
        ['memo', validCheckOptionalItem],
        ['phone', validCheckOptionalItem],
        ['email', validCheckOptionalItem],
        ['messenger', validCheckOptionalItem],
        ['canceled', validCheckOptionalItem],
        ['reserved_date', validCheckSimpleDateTime],
        ['modify_date', validCheckSimpleDateTime],
        ['cancel_comment', validCheckOptionalItem],
        ['totalPeopleNumberCheck', validCheckTotalPeopleNumber],
    ]);
}
function ACCOUNT_VALID_CHECK_FUNCTION_MAP() {
    return new Map([
        ['account_id', validCheckObjectSQL],
        ['reservation_id', validCheckObjectSQL],
        ['writer', validCheckOptionalItem],
        ['created', validCheckSimpleDateTime],
        ['category', validCheckOptionalItem],
        ['currency', validCheckSimpleItem],
        ['card_income', validCheckMoney],
        ['card_expenditure', validCheckMoney],
        ['cash_income', validCheckMoney],
        ['cash_expenditure', validCheckMoney],
        ['option', validCheckOptionalItem],
        ['totalMoneyCheck', validCheckTotalMoneyAmount]
    ]);
}

/**
 *
 * @param table {String} table name of database
 * @param field {String} field name of table
 * @param objectId {String | Number} object id
 * @param type {String | Number} expected type of corresponding objectId
 * @returns {Promise<boolean>}
 */
function validCheckObjectSQL (table, field, objectId, type) {
    const tempValue = (typeof objectId === 'string') ? `"${objectId}"` : objectId;
    if (!objectId && typeof objectId !== type) return Promise.resolve(false);
    const query = `SELECT EXISTS(SELECT 1 FROM ${table} WHERE ${field} = ${tempValue})`;
    console.log('validCheckObjectSQL - query : ',table,field, objectId, type, query);
    return new Promise((resolve, reject) => {
        sqlDB.query(query, (err, result) => {
            if (err) throw new Error(`validCheckObjectSQL failed : [${table}, ${field}, ${objectId}]`);
            if (!result || result.rowCount <= 0 || !result.rows[0].exists) {
                Exceptor.report(Exceptor.TYPE.NO_OBJECT_ID_IN_DATABASE, `No object. table & field : ${table} & ${field} / object id : ${objectId}`);
                resolve(false);
            } else { resolve(true) }
        });
    }).catch(err => {
        if (field === 'id') Exceptor.report(Exceptor.TYPE.UNKNOWN_RESERVATION, `${err.message}`);
        else if (field === 'account_id') Exceptor.report(Exceptor.TYPE.UNKNOWN_ACCOUNT, `${err.message}`);
        return err;
    })
}

function validCheckProduct(product_id, operation_date) {
    let product;
    return Product.getProduct(product_id)
        .then(result => {
            if (!result) {
                Exceptor.report(Exceptor.TYPE.UNKNOWN_PRODUCT, `Unknown product id in reservation : ${product_id}`);
                return false;
            } else {
                product = result;
                return product.availability.on === 'ON' }})
        .then(statusCheck => {
            if (!statusCheck) {
                Exceptor.report(Exceptor.TYPE.CLOSED_PRODUCT, `Product Status is STOP. product_id : ${product_id}`);
                return false;
            } else { return Product.getAvailablePriceGroup(operation_date, product) }})
        .then(availablePriceGroup => {
            if (!availablePriceGroup) return false;
            if (availablePriceGroup.length > 1) {
                Exceptor.report(Exceptor.TYPE.MULTIPLE_PRICE_GROUP, `available price group : ${availablePriceGroup}`);
                return false;
            } else { return true }
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
 * @param operation_date {Date} Local date (UTC+9)
 * @param product_id {Number} product id
 * @returns {Promise<any | never | boolean>}
 */
function validCheckOperationDateTime(operation_date, product_id) {
    let product;
    if (!operation_date) throw new Error(`operation date is undefined ${operation_date}`);
    if (!product_id) throw new Error(`product id is undefined ${product_id}`);
    return new Promise((resolve, reject) => {
        resolve(validCheckSimpleDateTime(operation_date))})
        .then(simpleCheck => {
            // console.log('validCheckOperationDateTime - simpleCheck : ', simpleCheck);
            if (!simpleCheck) return false;
            return Product.getProduct(product_id)})
        .then(result => {
            product = result;
            // console.log('validCheckOperationDateTime - product : ', !!product);
            if (!result) {
                Exceptor.report(Exceptor.TYPE.UNKNOWN_PRODUCT, `No product in product map. product_id : ${product_id}`);
                throw new Error('UNKNOWN_PRODUCT'); }
            return validCheckDayOfWeek(product, operation_date)})
        .then(dayCheck => {
            // console.log('validCheckOperationDateTime - dayCheck : ', dayCheck);
            if (!dayCheck) {
                Exceptor.report(Exceptor.TYPE.INVALID_OPERATION_DAY_OF_WEEK, `Operation Date Wrong day. product_id : ${product_id}`);
                throw new Error('INVALID_OPERATION_DAY_OF_WEEK')
            }
            return Product.checkValidFBDate(operation_date, product.availability.reserve_date.begin, product.availability.reserve_date.end, product.timezone)})
        .then(reserveDateCheck => {
            // console.log('validCheckOperationDateTime - reserveDateCheck : ', reserveDateCheck);
            if (!reserveDateCheck) {
                Exceptor.report(Exceptor.TYPE.INVALID_OPERATION_DATE, `Invalid operation date compare to reserve_date : [${product.availability.reserve_date.begin}, ${product.availability.reserve_date.end}]`);
                throw new Error('Invalid Operation date at reserverDateCheck!');
            }
            const priceGroup = Product.getAvailablePriceGroup(operation_date, product);
            if (priceGroup.length === 0) {
                Exceptor.report(Exceptor.TYPE.NO_MATCHING_PRICE_GROUP, 'In operation date check');
                throw new Error('validCheckOperationDateTime - no matching price group');
            }
            let availablePriceGroup = [];
            priceGroup.forEach(group => {
                if (Product.checkValidFBDate(operation_date, group.tour_date.begin, group.tour_date.end, product.timezone)) {
                    availablePriceGroup.push(group);
                }
            });
            // console.log('validCheckOperationDateTime - priceGroupCheck : ', availablePriceGroup.length > 0);
            return availablePriceGroup.length > 0;
        }).catch(err => {return false});
}
// sqlDB.query('SELECT operation_date, product_id from reservation where id = 98', (err, result) => {
//     // console.log(result)
//     date = result.rows[0].operation_date;
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
function validCheckSimpleDateTime (input) {
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
    // console.log(`tourDay : ${tourDay}, operation day : ${product.availability.days}`);
    return product.availability.days[tourDay];
}

/**
 *
 * @param target {Date} date object from reservation
 * @param begin {String} beginning of available date of price group (Firebase)
 * @param end {String} end of available date of price group (Firebase)
 * @param timezone {String} timezone information
 */

function validCheckMoney(money) {
    return new Promise((resolve, reject) => {
        if (typeof money === 'number' && money !== 'NaN') resolve(true);
        resolve(false);
    });
}
function validCheckTotalPeopleNumber(adult, child, infant){
    return new Promise((resolve, reject) => {
        resolve(adult + child + infant > 0);
    });
}

function validCheckTotalMoneyAmount(card_income, card_expenditure, cash_income, cash_expenditure){
    return new Promise((resolve, reject) => {
        if (card_income === 0 && card_expenditure === 0 && cash_income === 0 && cash_expenditure === 0) {
            Exceptor.report(Exceptor.TYPE.NO_PRICE_INFO, 'sum of money is zero')
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