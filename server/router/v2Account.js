const sqlDB = require('../auth/postgresql');
const Account = require('../models/account');
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
            if (!validCheck) throw new Error('account validation failed!');
            if (requestType === 'UPDATE') return Account.insertReverseAccountToSQL(data);
            return true })
        .then(result => {
            if (!result) throw new Error('insert reverse account insert to SQL failed in accountHandler!');
            reverseAccount = result;
            return Account.insertSQL(account)})
        .then(result => {
            if (!result) throw new Error('insert Account to SQL failed in accountHandler!');
            return Promise.all([Account.insertElastic(reverseAccount), Account.insertElastic(account)])})
        .then(result => {
            if (!result) throw new Error('insert account / reverseAccount to Elastic failed in accountHandler!');
            return true;
        })
}