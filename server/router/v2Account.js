const sqlDB = require('../auth/postgresql');
const Account = require('../models/account');
const Product = require('../models/product');
const Nationality = require('../models/nationality');
const Pickup = require('../models/pickups');
const log = require('../../log');
const env = require('../../package.json').env;
sqlDB.connect();

exports.post = (req, res) => {
    if (!req.get('Content-Type')) {
        log.warn('Account', 'Account-POST', 'wrong Content-Type');
        return res.status(400).json({message: "Content-Type should be json"});
    } else if (!req.body.hasOwnProperty('accountRouterAuth') || !req.body.accountRouterAuth) {
        if (!req.body.reservationResult) {
            log.warn('Account', 'Account-POST', 'this requester should send data through reservation router. not authorized for direct request to account router');
            return res.status(401).json({message:'this requester should send data through reservation router. not authorized for direct request to account router'});
        } else {
            log.debug('Account', 'Account-POST', 'no account authority but passed : came through reservation router');
        }
    }
    return accountHandler(req, res, 'POST')
        .catch(err => {
            log.error('Account', 'Account-POST', `unhandled error occurred!`);
            res.status(500).send(`unhandled ACCOUNT POST error`)
        });
};

exports.delete = (req, res) => {
    if (!req.get('Content-Type')) {
        log.warn('Account', 'Account-DELETE', 'wrong Content-Type');
        return res.status(400).json({message: "Content-Type should be json"});
    }  else if (!req.body.reservationResult) {
        if ((!req.body.hasOwnProperty('accountRouterAuth') || !req.body.accountRouterAuth)) {
            log.warn('Account', 'Account-DELETE', 'unAuthorized request');
            return res.status(401).json({message:'account router unauthorized!'});
        } else {
            log.debug('Account', 'Account-DELETE', 'no account authority but passed : came through reservation router');
        }
    }
    return accountHandler(req, res, 'REVERSE_CREATE')
        .catch(err => {
            log.error('Account', 'Account-REVERSE_CREATE', `unhandled error occurred!`);
            res.status(500).send(`unhandled ACCOUNT POST error`)
        });
};

/**
 * account handler for UPDATE / CREATE request
 * @param req {Object} request object from express
 * @param res {Object} response object from express
 * @param requestType {String} 'POST' || 'UPDATE'
 * @returns {*}
 */
async function accountHandler(req, res, requestType) {
    const data = req.body;
    let testObj;
    if (req.body.hasOwnProperty('testObj')) testObj = req.body.testObj;
    else testObj = testManager(req, env);
    data.accountResult = false;
    let nationalityData = await Nationality.getNationality(data.nationality);
    if (nationalityData.result) data.nationality = nationalityData.data;
    if (requestType === 'REVERSE_CREATE') {
        const task = {processReverseAccount:false, insertSQL : false, insertElastic: false};
        if (!data.account_id) data.account_id = await Account.getAccountId(data.reservation_id);
        let reverseAccount = await Account.processReverseAccount(data.account_id, testObj);
        if (!reverseAccount) {
            return res.status(500).json(aRRM('DELETE', data, task, false, 1));
        } else {
            task.processReverseAccount = true;
            let reverseSqlAccount = await Account.insertSQL(reverseAccount.sqlData, testObj);
            if (!reverseSqlAccount) {
                return res.status(500).json(aRRM('DELETE', data, task, false, 2));
            } else {
                task.insertSQL = true;
                reverseAccount.sqlData.id = reverseSqlAccount.id;
                reverseAccount.elasticData.id = reverseSqlAccount.id;
                data.reverseAccountId = reverseSqlAccount.id;
                let elasticResult = await Account.insertElastic(reverseAccount.elasticData, testObj);
                if (!elasticResult) {
                    let failureTask = await failureManager(reverseAccount.sqlData, task, requestType, testObj);
                    return res.status(500).json(aRRM('DELETE', data, failureTask, false, 3));
                } else {
                    task.insertElastic = true;
                    return res.status(200).json(aRRM('DELETE', data, task, true, null));
                }
            }
        }
    } else {
        const task = {validation : false, insertSQL : false, insertElastic: false, productDataFound : false, pickupDataFound : false};
        let productData;
        if (data.category === 'reservation' || data.category === 'Reservation') {
            if (!data.hasOwnProperty('productData') && data.hasOwnProperty('product')) {
                productData = await Product.productDataExtractFromFB(data);
                data.productData = productData.priceGroup;
            } else {
                productData = data.productData;
                productData.result = true;
            }
            if (!productData.result) {
                return res.status(400).json(aRRM('POST', data, task, false, 4));
            }
            task.productDataFound = true;
            let pickupData = await Pickup.getPickup(data.pickup);
            data.pickupData = pickupData;
            if (!pickupData) {
                return res.status(400).json(aRRM('POST', data, task, false, 5));
            }
            task.pickupDataFound = true;
        }
        if (!data.hasOwnProperty('cash')) data.cash = false;
        if (!data.hasOwnProperty('productData')) return res.status(400).json(aRRM('POST', data, task, false, 6));
        const account = new Account(data);
        if (account.sqlData.category !== 'reservation' && account.sqlData.category !== 'Reservation') data.reservation_id = null;
        data.category = account.sqlData.category;
        let validCheck = await Account.validation(data, account);
        if (!validCheck.result) {
            task.validationDetail = validCheck.detail;
            return res.status(400).json(aRRM('POST', data, task, false, 7));
        } else {
            task.validation = true;
            let sqlAccount = await Account.insertSQL(account.sqlData, testObj);
            if (!sqlAccount) {
                return res.status(500).json(aRRM('POST', data, task, false, 8));
            } else {
                task.insertSQL = true;
                account.sqlData.id = sqlAccount.id;
                account.elasticData.id = sqlAccount.id;
                let elasticResult = await Account.insertElastic(account.elasticData, testObj);
                if (!elasticResult) {
                    let failureTask = await failureManager(account.sqlData, task, requestType, testObj);
                    return res.status(500).json(aRRM('POST', data, failureTask, false, 9));
                } else {
                    task.insertElastic = true;
                    return res.status(200).json(aRRM('POST', data, task, true, null));
                }
            }
        }
    }
}

/**
 * abbreviation explanation : account Router Response Manager
 * @param requestType {String} request type (POST or DELETE)
 * @param data {Object} reservation / account raw data
 * @param accountTask {Object} account task object
 * @param success {Boolean} boolean of success
 * @param errorNumber {Number} error number when success is false
 */
function aRRM(requestType, data, accountTask, success, errorNumber) {
    let result = {
        requester : data.requester,
        type : requestType,
        reservationResult : data.reservationResult || 'no reservation task done before',
        reservationTask : data.reservationTask,
        accountResult : success,
        accountTask : accountTask
    };
    if (success) {
        result.message = `Account saved properly : ${requestType}`;
        let pickup = (data.category === 'reservation' || data.category === 'Reservation') ? data.pickupData.pickupPlace : 'no pickup data';
        if (requestType === 'POST') {
            result.resultData = {
                id : data.reservation_id,
                product: data.product,
                pickup : pickup,
                category : data.category,
                clientName : data.name,
                adult : data.adult, kid : data.kid, infant : data.infant
            };
        } else {
            result.id = data.reverseAccountId;
        }
        log.debug('Account', 'v2Account', `all task done successfully : ${requestType}`);
    } else {
        result.errorNumber = errorNumber;
        if (errorNumber === 1) {
            result.message = `accountHandler failed in processReverseAccount : ${data.account_id}`;
            log.error('Account', 'accountHandler', `errorNumber : ${errorNumber} / reverse account process failed. account id : ${data.account_id}`);
        } else if (errorNumber === 2) {
            result.message = `accountHandler failed in insert account to Elastic : ${data.reservation_id}`;
            log.error('Account', 'accountHandler', `errorNumber : ${errorNumber} / insert account to SQL failed. account id : ${data.account_id}`);
        } else if (errorNumber === 3) {
            result.message = `accountHandler failed in insert account to Elastic : ${data.reservation_id} / ${data.account_id}`;
            log.error('Account', 'accountHandler', `errorNumber : ${errorNumber} / insert account to Elastic failed. [${data.reservation_id} / ${data.account_id}]`);
        } else if (errorNumber === 4) {
            Object.entries({
                message:`accountHandler failed in processing productData : ${data.product}`,
                detail : data.productData.detail
            }).forEach(temp => {result[temp[0]] = temp[1]});
            log.info('Account', 'accountHandler', `errorNumber : ${errorNumber} / productData load failed. product : ${data.product}`);
        } else if (errorNumber === 5) {
            result.message = `accountHandler failed in pickupData find. pickup : ${data.pickup}`;
            log.info('Account', 'accountHandler', `errorNumber : ${errorNumber} / pickupData load failed. pickup : ${data.pickup}`);
        } else if (errorNumber === 6) {
            result.message = `productData is not present in non-reservation account. category : ${data.category}`;
            log.info('Account', 'accountHandler', `errorNumber : ${errorNumber} / productData is not present in non-reservation account. category : ${data.category}`);
        } else if (errorNumber === 7) {
            result.message = `accountHandler failed in account validation : ${data.reservation_id}`;
            log.info('Account', 'accountHandler', `errorNumber : ${errorNumber} / ValidDataCheck failed, [${data.reservation_id}]`);
        } else if (errorNumber === 8) {
            result.message = `accountHandler failed in insert account to SQL : ${data.reservation_id}`;
            log.error('Account', 'accountHandler', `errorNumber : ${errorNumber} / account insert to SQL failed, [${data.reservation_id}]`);
        } else if (errorNumber === 9) {
            result.message = `accountHandler failed in insert account to Elastic : ${data.reservation_id} / ${data.account_id}`;
            log.error('Account', 'accountHandler', `errorNumber : ${errorNumber} / account insert to Elastic failed, [${data.reservation_id} / ${data.account_id}]`);
        }
    }
    return result;
}

/**
 * failure manager when error occurred in AccountHandler.
 * @param account {Object} account object
 * @param task {Object} task from AccountHandler
 * @param type {String} POST / UPDATE
 * @param testObj {Object} only for test purpose. "isTest" : flag for test, "fail" : flag that one of the functions should fail, "detail" : detailed object for fail function information
 * @returns {*}
 */
function failureManager(account, task, type, testObj){
    log.debug('Account', 'Account - failureManager', `type : ${JSON.stringify(type)}, task : ${JSON.stringify(task)}`)
    task.insertReverseSQL = false;
    if (type === 'POST') {
        if (!task.insertElastic && task.insertSQL) {
            const reverseSQLAccount = Account.reverseMoneyProcess(Account.reverseAccountDataProcessing(account));
            if (reverseSQLAccount.id) delete reverseSQLAccount.id;
            return Account.insertSQL(reverseSQLAccount, testObj)
                .then(result => {
                    if (!result) return task;
                    task.insertReverseSQL = true;
                    log.debug('Account', 'Account-failureManager [POST]', `insert reverse Account (due to insertElastic failure) success! id : ${result.id}. task : ${task}`);
                    return task;});
        } else { return Promise.resolve(task); }
    } else {
        if (task.insertSQL && !task.insertElastic) {
            const originalSQLAccount = Account.reverseMoneyProcess(Account.reverseAccountDataProcessing(account));
            if (originalSQLAccount.id) delete originalSQLAccount.id;
            return Account.insertSQL(originalSQLAccount, testObj)
                .then(result => {
                    if (!result) return task;
                    task.insertReverseSQL = true;
                    log.debug('Account', 'Account-failureManager [DELETE]', `insert original Account (due to insertElastic failure) success! id : ${result.id}. task : ${task}`);
                    return task;
                });
        } else { return Promise.resolve(task); }
    }
}


/**
 * generate test object for account considering product release status
 * @param req {Object} requested object from router
 * @param env {Object} environmental object from package.json
 * @returns {Object}
 */
function testManager(req, env){
    const result = {isTest:false, fail:false, detail:{
            insertSQL:false, insertElastic:false, processReverseAccount: false
        }};
    const obj = req.body.testObj;
    if (!obj || obj.target !== 'account') return result;
    result.isTest = true;
    result.fail = obj.fail;
    Object.keys(obj.detail).forEach(key => {
        if (!!result.detail.key) result.detail[key] = obj.detail[key];
    });
    return result;
}
