const sqlDB = require('../auth/postgresql');
const Account = require('../models/account');
const Product = require('../models/product');
const log = require('../../log');
const env = require('../../package.json').env;
sqlDB.connect();

exports.post = (req, res) => {
    if (!req.get('Content-Type')) return res.status(400).send("Content-Type should be json");
    accountHandler(req, res, 'POST')
        .then((resultData) => {
            if (!resultData.accountResult) return res.status(500).json({
                message : 'accountHandler failed',
                reservationTask : resultData.reservationTask,
                accountTask : resultData.accountTask
            });
            log.debug('Router', 'v2Account', 'all task done successfully [POST]');
            return res.status(201).json({
                message:'Account saved properly : POST',
                reservationTask : resultData.reservationTask,
                accountTask:resultData.accountTask})})
        .catch(err => {
            log.error('Router', 'ACCOUNT export-POST', `unhandled error occurred! error : ${err}`);
            res.status(500).send(`unhandled ACCOUNT POST error`)
        });
};

exports.delete = (req, res) => {
    if (!req.get('Content-Type')) return res.status(400).send("Content-Type should be json");
    accountHandler(req, res, 'REVERSE_CREATE')
        .then((resultData) => {
            if (!resultData.accountResult) return res.status(500).json({
                message:'accountHandler failed',
                reservationTask : resultData.reservationTask,
                accountTask : resultData.accountTask
            });
            log.debug('Router', 'v2Account', 'all task done successfully [UPDATE]');
            return res.status(201).json({
                message:'Account saved properly : UPDATE',
                reservationTask : resultData.reservationTask,
                accountTask: resultData.accountTask})})
        .catch(err => {
            log.error('Router', 'ACCOUNT export-REVERSE_CREATE', `unhandled error occurred! error : ${err}`);
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
function accountHandler(req, res, requestType) {
    const data = req.body;
    let testObj;
    if (req.body.hasOwnProperty('testObj')) testObj = req.body.testObj;
    else testObj = testManager(req, env);
    data.accountResult = false;
    if (requestType === 'REVERSE_CREATE') {
        let reverseAccount;
        const task = {processReverseAccount:false, insertSQL : false, insertElastic: false};
        return new Promise((resolve, reject) => {
            if (!data.account_id) {resolve(Account.getAccountId(data.reservation_id))}
            else { resolve(data.account_id)}
        }).then(account_id => {
            data.account_id = account_id;
            return Account.processReverseAccount(account_id, testObj)})
        .then(account => {
            // console.log('after processReverseAccount, testObj : ',JSON.stringify(testObj));
            if (!account) return false;
            reverseAccount = account;
            task.processReverseAccount = true;
            return Account.insertSQL(reverseAccount.sqlData, testObj)})
        .then(result => {
            if (!result) return false;
            task.insertSQL = true;
            reverseAccount.sqlData.id = result.id;
            reverseAccount.elasticData.id = result.id;
            return Account.insertElastic(reverseAccount.elasticData, testObj)})
        .then(result => {
            data.accountTask = task;
            if (!result) { return failureManager(reverseAccount.sqlData, task, requestType, testObj).then(failureTask => {
                data.accountTask = failureTask;
                return data;
            });}
            data.accountTask.insertElastic = true;
            data.accountResult = true;
            log.debug('Router','accountHandler [REVERSE_CREATE]', 'all process success!');
            return data });
    } else if (requestType === 'POST') {
        return new Promise((resolve, reject) => {
            if (!data.hasOwnProperty('productData') && data.hasOwnProperty('product')) {
                data.adult = data.reservation.adult;
                data.kid = data.reservation.kid;
                data.infant = data.reservation.infant;
                resolve(Product.productDataExtractFromFB(data));
            } else {
                resolve(data.productData);
            }
        }).then(productData => {
            if (!productData) {
                log.warn('Router', 'accountHandler', `productData load failed. product : ${data.product}`);
                return {
                    accountResult : false,
                    detail : 'priceGroup matching failed'
                };
            } else {
                data.productData = productData;
                if (!data.hasOwnProperty('cash')) data.cash = false;
                const account = new Account(data);
                const task = {validation : false, insertSQL : false, insertElastic: false};
                return Account.validation(account)
                    .then(validCheck => {
                        if (!validCheck.result) {
                            log.warn('Router', 'accountHandler', `ValidDataCheck failed [Account - ${requestType}], [${data.reservation_id}]`);
                            task.validationDetail = validCheck.detail;
                            return false;
                        }
                        task.validation = true;
                        return Account.insertSQL(account.sqlData, testObj)})
                    .then(result => {
                        if (!result) return false;
                        task.insertSQL = true;
                        account.sqlData.id = result.id;
                        account.elasticData.id = result.id;
                        return Account.insertElastic(account.elasticData, testObj)})
                    .then(result => {
                        data.accountTask = task;
                        if (!result) return failureManager(account.sqlData,task, requestType, testObj).then(failureTask => {
                            data.accountTask = failureTask;
                            return data;
                        });
                        data.accountTask.insertElastic = true;
                        data.accountResult = true;
                        log.debug('Router','accountHandler [CREATE]', 'all process success!');
                        return data;
                    });
            }
        })
    }
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
    log.debug('Router', 'Account - failureManager', `type : ${JSON.stringify(type)}, task : ${JSON.stringify(task)}`)
    task.insertReverseSQL = false;
    if (type === 'POST') {
        if (!task.insertElastic && task.insertSQL) {
            const reverseSQLAccount = Account.reverseMoneyProcess(account, testObj);
            if (reverseSQLAccount.id) delete reverseSQLAccount.id;
            return Account.insertSQL(reverseSQLAccount, testObj)
                .then(result => {
                    if (!result) return task;
                    task.insertReverseSQL = true;
                    log.debug('Router', 'Account-failureManager [POST]', `insert reverse Account success! id : ${result.id}. task : ${task}`);
                    return task;});
        } else { return Promise.resolve(task); }
    } else {
        if (task.insertSQL && !task.insertElastic) {
            const originalSQLAccount = Account.reverseMoneyProcess(account, testObj);
            console.log('failuremanager reverse account : ',JSON.stringify(originalSQLAccount));
            if (originalSQLAccount.id) delete originalSQLAccount.id;
            return Account.insertSQL(originalSQLAccount, testObj)
                .then(result => {
                    if (!result) return task;
                    task.insertReverseSQL = true;
                    log.debug('Router', 'Account-failureManager [UPDATE]', `insert original Account success! id : ${result.id}. task : ${task}`);
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