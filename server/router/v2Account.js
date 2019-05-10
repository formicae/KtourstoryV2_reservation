const sqlDB = require('../auth/postgresql');
const Account = require('../models/account');
const log = require('../../log');
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

exports.update = (req, res) => {
    if (!req.get('Content-Type')) return res.status(400).send("Content-Type should be json");
    accountHandler(req, res, 'UPDATE')
        .then((resultData) => {
            if (!resultData.accountResult) return res.status(500).json({
                message:'accountHandler failed',
                reservationTask : resultData.reservationTask,
                accountTask : resultData.accountTask
            });
            log.debug('Router', 'v2Account', 'all task done successfully [UPDATE]');
            return res.status(201).json({
                message:'Account saved properly : UPDATE',
                accountTask:{reservation : resultData.reservationTask, account:resultData.accountTask}})})
        .catch(err => {
            log.error('Router', 'ACCOUNT export-UPDATE', `unhandled error occurred! error : ${err}`);
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
    data.accountResult = false;
    const account = new Account(data);
    if (requestType === 'UPDATE') {
        let reverseAccount;
        const task = {validation : false, reverseDataProcess:false, insertSQL : false, insertElastic: false};
        return Account.validation(account)
            .then(validCheck => {
                if (!validCheck.result) {
                    log.warn('Router', 'accountHandler', `ValidDataCheck failed [Account - ${requestType}], [${data.reservation_id}]`);
                    task.validationDetail = validCheck.detail;
                    return false;
                }
                task.validation = true;
                return Account.processReverseAccount(data)})
            .then(account => {
                if (!account) return false;
                reverseAccount = account;
                task.reverseDataProcess = true;
                return Account.insertSQL(reverseAccount.sqlData)})
            .then(result => {
                if (!result) return false;
                task.insertSQL = true;
                reverseAccount.sqlData.id = result.id;
                reverseAccount.elasticData.id = result.id;
                return Account.insertElastic(reverseAccount.elasticData)})
            .then(result => {
                data.accountTask = task;
                if (!result) return failureManager(reverseAccount, data, task, requestType).then(failureTask => {
                    data.accountTask = failureTask;
                    return data;
                });
                data.accountTask.insertElastic = true;
                data.accountResult = true;
                log.debug('Router','accountHandler [UPDATE]', 'all process success!');
                return data });
    } else if (requestType === 'POST') {
        const task = {validation : false, insertSQL : false, insertElastic: false};
        return Account.validation(account)
            .then(validCheck => {
                if (!validCheck) return false;
                task.validation = true;
                return Account.insertSQL(account.sqlData)})
            .then(result => {
                if (!result) return false;
                task.insertSQL = true;
                account.sqlData.id = result.id;
                account.elasticData.id = result.id;
                return Account.insertElastic(account.elasticData)})
            .then(result => {
                data.accountTask = task;
                console.log('result of Account.insertElastic', result, task);
                if (!result) return failureManager(account.sqlData, data, task, requestType).then(failureTask => {
                    data.accountTask = failureTask;
                    return data;
                });
                data.accountTask.insertElastic = true;
                data.accountResult = true;
                log.debug('Router','accountHandler [CREATE]', 'all process success!');
                return data;
            });
    }
}

/**
 * failure manager when error occurred in AccountHandler.
 * @param account {Object} account object
 * @param data {Object} data object
 * @param task {Object} task from AccountHandler
 * @param type {String} POST / UPDATE
 * @returns {*}
 */
function failureManager(account, data, task, type){
    log.debug('Router', 'Account - failureManager', `type : ${JSON.stringify(type)}, task : ${JSON.stringify(task)}`)
    task.insertReverseSQL = false;
    if (type === 'POST') {
        if (!task.insertElastic && task.insertSQL) {
            const reverseSQLAccount = Account.reverseMoneyProcess(account);
            if (reverseSQLAccount.id) delete reverseSQLAccount.id;
            return Account.insertSQL(reverseSQLAccount)
                .then(result => {
                    if (!result) return task;
                    task.insertReverseSQL = true;
                    log.debug('Router', 'Account-failureManager [POST]', `insert reverse Account success! id : ${result.id}. task : ${task}`);
                    return task;});
        } else { return Promise.resolve(task); }
    } else {
        if (task.insertSQL && !task.insertElastic) {
            const originalSQLAccount = Account.reverseMoneyProcess(account);
            if (originalSQLAccount.id) delete originalSQLAccount.id;
            return Account.insertSQL(originalSQLAccount)
                .then(result => {
                    if (!result) return task;
                    task.insertReverseSQL = true;
                    log.debug('Router', 'Account-failureManager [UPDATE]', `insert original Account success! id : ${result.id}. task : ${task}`);
                    return task;
                });
        } else { return Promise.resolve(task); }
    }
}