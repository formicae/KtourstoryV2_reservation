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
    'writer':true,
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
    'writer':true,
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
 * @param data {Object} raw data object
 * @param reservation {Object} reservation object
 * @returns {Map<any, any>} Reservation parameter map
 * @constructor
 */
function RESERVATION_VALID_CHECK_PARAMETER_MAP(data, reservation) {
    return new Map([
        ['id', ['reservation', 'id', reservation.id]],
        ['message_id', [reservation.message_id, 'string']],
        ['writer', [reservation.writer, 'string']],
        ['agency', [reservation.agency, 'string']],
        ['agency_code', [reservation.agency_code, 'string']],
        ['tour_date', [reservation.tour_date, reservation.product_id, reservation.agency, data.force]],
        ['options', [reservation.options, 'object']],
        ['adult', [reservation.adult]],
        ['kid', [reservation.kid]],
        ['infant', [reservation.infant]],
        ['canceled', [reservation.canceled, 'boolean']],
        ['created_date', [reservation.created_date]],
        ['modified_date', [reservation.modified_date]],
        ['productCheck', [reservation.product_id, reservation.tour_date, reservation.agency]],
        ['totalPeopleNumberCheck', [reservation.adult, reservation.kid, reservation.infant]],
    ]);
}

/**
 * Parameter Map for account validation
 * @param data {Object} Account object
 * @returns {Map<any, any>} Account parameter map
 * @constructor
 */
function ACCOUNT_VALID_CHECK_PARAMETER_MAP(data, account) {
    return new Map([
        ['id', ['account', 'id', account.id]],
        ['writer', [account.writer, 'string']],
        ['category', [account.category, 'string']],
        ['currency', [account.currency, 'string']],
        ['income', [account.income]],
        ['expenditure', [account.expenditure]],
        ['cash', [account.cash, 'boolean']],
        ['created_date', [account.created_date]],
        ['reservation_id', ['reservation', 'reservation_id', account.reservation_id]],
        ['totalMoneyCheck', [account.income, account.expenditure]]
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
function validCheckProduct(product_id, tour_date, agency) {
    let product;
    return Product.getProduct(product_id)
        .then(result => {
            if (!result) {
                log.warn('Validation','validCheckProduct', `getProduct failed : ${product_id}`);
                return false;
            } else {
                product = result;
                return product.on === 'ON' || product.on === 'true' || product.on === true;
            }})
        .then(statusCheck => {
            if (!statusCheck) {
                log.warn('Validation','validCheckProduct', 'statusCheck failed. product.on is not TRUE');
                return false;
            } else {
                log.debug('Debug','validCheckProduct status check', `statusCheck success with ${product_id}`);
                return Product.getAvailablePriceGroup(tour_date, product, agency)
            }})
        .then(availablePriceGroup => {
            if (!availablePriceGroup) return false;
            if (availablePriceGroup.length === 0) {
                log.warn('Validation','validCheckProduct', `availablePriceGroup failed number of available price group : ${availablePriceGroup.length}`);
                return false;
            } else {
                log.debug('Debug','validCheckProduct price group check', `availablePriceGroup check success with ${availablePriceGroup[0].name}`);
                return availablePriceGroup.length > 0;
            }
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


function dateCheckFailureManager(failureNumber, passed, tour_date, product, additionalData) {
    if (failureNumber === 1) {
        log.warn('Validation', 'validCheckOperationDateTime', `failureNumber : ${failureNumber} / tour_date is undefined`);
    } else if (failureNumber === 2) {
        log.warn('Validation', 'validCheckOperationDateTime', `failureNumber : ${failureNumber} / product_id is undefined`);
    } else if (failureNumber === 3) {
        if (passed) log.debug('Validation','validCheckOperationDateTime','validCheckSimpleDateTime passed');
        else log.warn('Validation', 'simpleLengthCheck',`failureNumber : ${failureNumber} / simple length check failed : ${tour_date}`);
    } else if (failureNumber === 4) {
        if (passed) log.debug('Validation','validCheckOperationDateTime','dayCheck passed');
        else log.warn('Validation', 'validCheckOperationDateTime', `failureNumber : ${failureNumber} / dayCheck failed. invalid operation day of week. day of tour_date : ${DAY_MAP[additionalData.tourDay]} / firebase Tour day array : ${JSON.stringify(additionalData.productDayArray)}`);
    } else if (failureNumber === 5) {
        if (passed) log.debug('Validation','validCheckOperationDateTime','tourDateRangeCheck passed');
        else log.warn('Validation','validCheckOperationDateTime', `failureNumber : ${failureNumber} / tourDateCheck failed`);
    } else if (failureNumber === 6) {
        if (passed) log.debug('Validation','validCheckOperationDateTime', `priceGroupCheck passed. number of available price group : ${additionalData.length}`);
        else log.warn('Valdation','validCheckOperationDateTime', `failureNumber : ${failureNumber} / priceGroupCheck failed. no existing price group in product : ${product.id} / priceGroup : ${additionalData}`);
    } else if (failureNumber === 7) {
        if (passed) log.debug('Validation','validCheckOperationDateTime',`deadLine passed : [${additionalData} hours left / deadline : ${product.deadline}] hours`);
        else log.warn('Validation','validCheckOperationDateTime',`failureNumber : ${failureNumber} / deadLine failed : [${additionalData} hours left / deadline : ${product.deadline}] hours`);
    }
    return false;
}

/**
 * validation check for tour_date(operation date) of reservation.
 * simple string, availability of day of week, tour_date valid check with available reservation date, price group is checked.
 * @param tour_date {Date || String} Local date (UTC+9)
 * @param product_id {Number} product id
 * @param agency {String} agency
 * @param force {Boolean} deadline validation pass by force when client requests
 * @returns {PromiseLike<any | never | boolean | never>}
 */
async function validCheckOperationDateTime(tour_date, product_id, agency, force) {
    const task = {getProduct:false, simpleLengthCheck:false, validCheckDayOfWeek:false, checkTourDateInValidRange:false, getAvailablePriceGroup:false};
    if (!tour_date) {
        return dateCheckFailureManager(1, false, tour_date, null, null);
    } else if (!product_id) {
        return dateCheckFailureManager(2, false, tour_date, null, null)
    } else {
        let product = await Product.getProduct(product_id);
        if (product) task.getProduct = true;
        if (!product.hasOwnProperty('timezone')) product.timezone = 'UTC+9';
        task.simpleLengthCheck = await validCheckSimpleDateTime(tour_date);
        dateCheckFailureManager(3, task.simpleLengthCheck, tour_date, product, null);
        let dayCheckData = await validCheckDayOfWeek(product, tour_date);
        task.validCheckDayOfWeek = dayCheckData.result;
        dateCheckFailureManager(4, task.validCheckDayOfWeek, tour_date, product, dayCheckData);
        task.checkTourDateInValidRange = await Product.checkTourDateInValidRange(tour_date, product.tour_begin, product.tour_end, product.timezone);
        dateCheckFailureManager(5, task.checkTourDateInValidRange, tour_date, product, null);
        let availablePriceGroup = await Product.getAvailablePriceGroup(tour_date, product, agency);
        task.getAvailablePriceGroup = availablePriceGroup.length > 0;
        dateCheckFailureManager(6, task.getAvailablePriceGroup, tour_date, product, availablePriceGroup);
        if (Object.values(task).includes(false)) {
            log.warn('Validation', 'validCheckOperationDateTime', `over one of task failed : ${JSON.stringify(task)}`);
            return false;
        } else {
          if (force) {
              log.debug('Validation', 'validCheckOperationDateTime', `all task passed : ${JSON.stringify(task)} and forced validation : no deadline will be checked`);
              return true
          } else {
              let leftTime = ((new Date(tour_date).getTime() - Product.getLocalDate(new Date(), product.timezone).getTime()) / (60 * 60 * 1000));
              let beforeDeadLine = leftTime >= product.deadline;
              dateCheckFailureManager(7, beforeDeadLine, tour_date, product, leftTime);
              return beforeDeadLine;
          }
        }
    }
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
    let tourDay = new Date(correctedDate).getDay() - 1;
    tourDay = (tourDay < 0) ? 6 : tourDay;
    log.debug('Validation', 'validCheckDayOfWeek', `tourDay : ${tourDay}, operation day : ${JSON.stringify(product.days)}`)
    let productDayArray = {};
    for (let i=0; i<product.days.length; i++) {
        productDayArray[DAY_MAP[i]] = product.days[i];
    }
    return {
        result : product.days[tourDay],
        tourDay : tourDay,
        productDayArray : productDayArray
    };
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
 * @param data {Object} raw data object
 * @param object {Object} object (reservation || account)
 * @param paramMap {Object} parameter map : JSON
 * @param checkList {Array} validation check list : Array
 * @param functionMap {function(): Map<any, any>} function map : MAP
 * @returns {Promise<{result: boolean, detail} | never>}
 */
function validDataCheck(data, object, paramMap ,checkList, functionMap) {
    const checkObject = {};
    const promiseArray = buildPromiseArray(checkList, paramMap(data, object), functionMap());
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
 * @param data {Object} raw data object
 * @param reservation {Object} reservation object
 * @returns {Promise<{result: boolean, detail} | never | boolean>}
 */
function validReservationUpdateCheck(data, reservation) {
    return validDataCheck(data, reservation.sqlData, RESERVATION_VALID_CHECK_PARAMETER_MAP, RESERVATION_UPDATE_VALID_CHECK_LIST_MAP, RESERVATION_VALID_CHECK_FUNCTION_MAP)
}

/**
 * validation check for reservation create
 * @param data {Object} raw data object
 * @param reservation {Object} reservation object
 * @returns {Promise<{result: boolean, detail} | never | boolean>}
 */
function validReservationCreateCheck(data, reservation) {
    console.log('reservation validation check!');
    return validDataCheck(data, reservation.sqlData, RESERVATION_VALID_CHECK_PARAMETER_MAP, RESERVATION_CREATE_VALID_CHECK_LIST_MAP, RESERVATION_VALID_CHECK_FUNCTION_MAP)
}

/**
 * validation for account creation. account cannot be modified.
 * @param data {Object} raw data object
 * @param account {Object} account obejct
 * @returns {Promise<{result: boolean, detail} | never | boolean>}
 */
function validAccountCheck(data, account) {
    return validDataCheck(data, account.sqlData, ACCOUNT_VALID_CHECK_PARAMETER_MAP, ACCOUNT_VALID_CHECK_LIST_MAP, ACCOUNT_VALID_CHECK_FUNCTION_MAP)
}

exports.RESERVATION_KEY_MAP = RESERVATION_KEY_MAP;
exports.ACCOUNT_KEY_MAP = ACCOUNT_KEY_MAP;
exports.DAY_MAP = DAY_MAP;
exports.TIME_OFFSET_MAP = TIME_OFFSET_MAP;
exports.validReservationCreateCheck = validReservationCreateCheck;
exports.validReservationUpdateCheck = validReservationUpdateCheck;
exports.validAccountCheck = validAccountCheck;
