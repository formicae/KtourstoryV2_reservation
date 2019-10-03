const sqlDB = require('../auth/postgresql');
const Account = require('../models/account');
const Product = require('../models/product');
const log = require('../../log');
const env = require('../../package.json').env;
sqlDB.connect();

exports.post = (req, res) => {
    if (!req.get('Content-Type')) {
        log.warn('Router', 'Account export-POST', 'wrong Content-Type');
        return res.status(400).json({message: "Content-Type should be json"});
    } else if (!req.body.hasOwnProperty('accountRouterAuth') || !req.body.accountRouterAuth) {
        log.warn('Router', 'Account export-POST', 'unAuthorized request');
        return res.status(401).json({message:'account router unauthorized!'});
    }
    return accountHandler(req, res, 'POST')
        .catch(err => {
            log.error('Router', 'ACCOUNT export-POST', `unhandled error occurred! error`);
            res.status(500).send(`unhandled ACCOUNT POST error`)
        });
};

exports.delete = (req, res) => {
    if (!req.get('Content-Type')) {
        log.warn('Router', 'Account export-DELETE', 'wrong Content-Type');
        return res.status(400).json({message: "Content-Type should be json"});
    } else if (!req.body.hasOwnProperty('accountRouterAuth') || !req.body.accountRouterAuth) {
        log.warn('Router', 'Account export-DELETE', 'unAuthorized request');
        return res.status(401).json({message:'account router unauthorized!'});
    }
    return accountHandler(req, res, 'REVERSE_CREATE')
        .catch(err => {
            log.error('Router', 'ACCOUNT export-REVERSE_CREATE', `unhandled error occurred! error`);
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
    if (requestType === 'REVERSE_CREATE') {
        const task = {processReverseAccount:false, insertSQL : false, insertElastic: false};
        if (!data.account_id) data.account_id = await Account.getAccountId(data.reservation_id);
        let reverseAccount = await Account.processReverseAccount(data.account_id, testObj);
        if (!reverseAccount) {
            log.warn('Router', 'accountHandler', `reverse account process failed. account id : ${data.account_id}`);
            return res.status(500).json({
                message:'accountHandler failed in processReverseAccount',
                type: 'DELETE',
                reservationResult : data.reservationResult || 'no reservation task done before',
                accountResult : false,
                reservationTask : data.reservationTask,
                accountTask : task
            });
        } else {
            task.processReverseAccount = true;
            let reverseSqlAccount = await Account.insertSQL(reverseAccount.sqlData, testObj);
            if (!reverseSqlAccount) {
                log.warn('Router', 'accountHandler', `insert account to SQL failed. account id : ${data.account_id}`);
                return res.status(500).json({
                    message:'accountHandler failed in insertSQL',
                    type: 'DELETE',
                    reservationResult : data.reservationResult || 'no reservation task done before',
                    accountResult : false,
                    reservationTask : data.reservationTask,
                    accountTask : task
                });
            } else {
                task.insertSQL = true;
                reverseAccount.sqlData.id = reverseSqlAccount.id;
                reverseAccount.elasticData.id = reverseSqlAccount.id;
                let elasticResult = await Account.insertElastic(reverseAccount.elasticData, testObj);
                if (!elasticResult) {
                    log.warn('Router', 'accountHandler', `insert account to Elastic failed. [${data.reservation_id} / ${data.account_id}]`);
                    let failureTask = await failureManager(reverseAccount.sqlData, task, requestType, testObj);
                    return res.status(500).json({
                        message:'accountHandler failed in insertSQL',
                        type: 'DELETE',
                        reservationResult : data.reservationResult || 'no reservation task done before',
                        accountResult : false,
                        reservationTask : data.reservationTask,
                        accountTask : failureTask
                    });
                } else {
                    task.insertElastic = true;
                    log.debug('Router', 'v2Account', 'all task done successfully [DELETE]');
                    return res.status(200).json({
                        message:'Account saved properly : DELETE',
                        reservationResult : data.reservationResult || 'no reservation task done before',
                        reservationTask : data.reservationTask,
                        accountResult : true,
                        accountTask : task
                    });
                }
            }
        }
    } else {
        const task = {validation : false, insertSQL : false, insertElastic: false, productDataFound : false};
        let productData;
        if (!data.hasOwnProperty('productData') && data.hasOwnProperty('product')) {
            productData = await Product.productDataExtractFromFB(data);
            data.productData = productData.priceGroup;
        } else {
            productData = data.productData;
            productData.result = true;
        }
        if (!productData.result) {
            log.warn('Router', 'accountHandler', `productData load failed. product : ${data.product}`);
            return res.status(500).json({
                message:'accountHandler failed in processing productData',
                type: 'POST',
                reservationResult : data.reservationResult || 'no reservation task done before',
                accountResult : false,
                reservationTask : data.reservationTask,
                accountTask : task,
                detail : productData.detail
            });
        } else {
            task.productDataFound = true;
            if (!data.hasOwnProperty('cash')) data.cash = false;
            const account = new Account(data);
            let validCheck = await Account.validation(account);
            if (!validCheck.result) {
                log.warn('Router', 'accountHandler', `ValidDataCheck failed, [${data.reservation_id}]`);
                task.validationDetail = validCheck.detail;
                return res.status(500).json({
                    message:'accountHandler failed in account validation',
                    type: 'POST',
                    reservationResult : data.reservationResult || 'no reservation task done before',
                    accountResult : false,
                    reservationTask : data.reservationTask,
                    accountTask : task
                });
            } else {
                task.validation = true;
                let sqlAccount = await Account.insertSQL(account.sqlData, testObj);
                if (!sqlAccount) {
                    log.warn('Router', 'accountHandler', `account insert failed, [${data.reservation_id}]`);
                    return res.status(500).json({
                        message:'accountHandler failed in insert account to SQL',
                        type: 'POST',
                        reservationResult : data.reservationResult || 'no reservation task done before',
                        accountResult : false,
                        reservationTask : data.reservationTask,
                        accountTask : task
                    });
                } else {
                    task.insertSQL = true;
                    account.sqlData.id = sqlAccount.id;
                    account.elasticData.id = sqlAccount.id;
                    let elasticResult = await Account.insertElastic(account.elasticData, testObj);
                    if (!elasticResult) {
                        log.warn('Router', 'accountHandler', `account insert to Elastic failed, [${data.reservation_id} / ${data.account_id}]`);
                        let failureTask = await failureManager(account.sqlData, task, requestType, testObj);
                        return res.status(500).json({
                            message:'accountHandler failed in insert account to Elastic',
                            type: 'POST',
                            reservationResult : data.reservationResult || 'no reservation task done before',
                            accountResult : false,
                            reservationTask : data.reservationTask,
                            accountTask : failureTask
                        });
                    } else {
                        task.insertElastic = true;
                        log.debug('Router', 'v2Account', 'all task done successfully [POST]');
                        return res.status(200).json({
                            message:'Account saved properly : POST',
                            resultData : {
                                id : data.reservation_id,
                                product: data.product,
                                pickup : data.pickupData.pickupPlace,
                                clientName : data.name,
                                adult : data.adult,
                                kid : data.kid,
                                infant : data.infant
                            },
                            reservationResult : data.reservationResult || 'no reservation task done before',
                            reservationTask : data.reservationTask,
                            accountResult : true,
                            accountTask : task
                        })
                    }
                }
            }
        }
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
            const reverseSQLAccount = Account.reverseMoneyProcess(Account.reverseAccountDataProcessing(account));
            if (reverseSQLAccount.id) delete reverseSQLAccount.id;
            return Account.insertSQL(reverseSQLAccount, testObj)
                .then(result => {
                    if (!result) return task;
                    task.insertReverseSQL = true;
                    log.debug('Router', 'Account-failureManager [POST]', `insert reverse Account (due to insertElastic failure) success! id : ${result.id}. task : ${task}`);
                    return task;});
        } else { return Promise.resolve(task); }
    } else {
        if (task.insertSQL && !task.insertElastic) {
            const originalSQLAccount = Account.reverseMoneyProcess(Account.reverseAccountDataProcessing(account));
            console.log('failuremanager reverse account : ',JSON.stringify(originalSQLAccount));
            if (originalSQLAccount.id) delete originalSQLAccount.id;
            return Account.insertSQL(originalSQLAccount, testObj)
                .then(result => {
                    if (!result) return task;
                    task.insertReverseSQL = true;
                    log.debug('Router', 'Account-failureManager [DELETE]', `insert original Account (due to insertElastic failure) success! id : ${result.id}. task : ${task}`);
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