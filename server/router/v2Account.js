const sqlDB = require('../auth/postgresql');
const Account = require('../models/account');
const log = require('../../log');
sqlDB.connect();

exports.post = (req, res) => {
    if (!req.get('Content-Type')) return res.status(400).send("Content-Type should be json");
    accountHandler(req, res, 'POST')
        .then(() => res.status(201).send('Account saved properly : POST'))
        .catch(err => { res.status(500).send(`POST error :${err.message}`)});
};

exports.update = (req, res) => {
    if (!req.get('Content-Type')) return res.status(400).send("Content-Type should be json");
    accountHandler(req, res, 'UPDATE')
        .then(() => res.status(201).send('Account saved properly : UPDATE'))
        .catch(err => { res.status(500).send(`POST error :${err.message}`)});
};

function accountHandler(req, res, requestType) {
    const data = req.body;
    const account = new Account(data);
    let reverseAccount;
    return Account.validation(account, false)
        .then(validCheck => {
            if (!validCheck) {
                log.warn('Router', 'accountHandler', 'validCheck failed');
                throw new Error('account validation failed!');
            }
            log.debug('Router','accountHandler', 'validCheck success!');
            if (requestType === 'UPDATE') return Account.insertReverseAccount(data);
            else return true})
        .then(result => {
            if (!result) {
                log.warn('Router', 'accountHandler', 'insertReverseAccount failed');
                throw new Error('insert reverse account insert to SQL failed in accountHandler!');
            }
            return Account.insertSQL(account.sqlData)})
        .then(result => {
            if (!result) {
                log.warn('Router', 'accountHandler', 'insertSQL failed');
                throw new Error('insert Account to SQL failed in accountHandler!');
            }
            log.debug('Router','accountHandler', 'insertSQL success!');
            account.elasticData.id = result.id;
            return Account.insertElastic(account.elasticData)})
        .then(result => {
            if (!result) {
                log.warn('Router', 'accountHandler', 'insertElastic failed');
                throw new Error('insert Account to Elastic failed in accountHandler!');
            }
            log.debug('Router','accountHandler', 'insertElastic success!');
            return true;
        })
}