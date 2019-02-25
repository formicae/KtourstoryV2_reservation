const sqlDB = require('../databaseAuth/postgresql');
const validation = require('./validation');
const ACCOUNT_KEY_MAP = validation.ACCOUNT_KEY_MAP;

class Account {
    constructor(reservation, data) {
        const currentDate = Account.getGlobalDate();
        if (!!data.id) this.id = data.id;
        this.reservation_id = Number(reservation.id);
        this.writer = (!data.writer) ? 'No writer' : data.writer;
        this.created = (!data.created) ? currentDate : data.created;
        this.category = (!data.category) ? '' : data.category;
        this.currency = (!data.currency) ? 'No currency' : data.currency;
        this.card_income = Account.moneyPreprocess(data.card_income);
        this.card_expenditure = Account.moneyPreprocess(data.card_expenditure);
        this.cash_income = Account.moneyPreprocess(data.cash_income);
        this.cash_expenditure = Account.moneyPreprocess(data.cash_expenditure);
        this.option = Account.optionPreprocess(data.option);
    }

    static getGlobalDate() {
        return new Date().toISOString().slice(0,-2);
    }

    static optionPreprocess(option) {
        if (!option) return {};
        if (typeof option === 'string') return JSON.parse(option);
        return option;
    }

    static moneyPreprocess(money) {
        const result = Number(money);
        if (!result || isNaN(result) || result < 0) return 0;
        return result;
    }

    static reverseMoneyProcess(account) {
        if (account.card_income > 0) {
            account.card_expenditure = (-1) * account.card_income;
            account.card_income = 0;
        } else if (account.cash_income > 0) {
            account.cash_expenditure = (-1) * account.cash_income;
            account.cash_income = 0;
        }
        return account;
    }

    /**
     *
     * @param account {Object} account object
     * @param detail {Boolean} false : only validation result. true : include details
     * @returns {PromiseLike<T | never> | Promise<T | never>}
     */
    static validation(account, detail) {
        return validation.validAccountCheck(account)
            .then(validation => {
                console.log('Account validation - result : ',validation.result);
                if (!detail) return validation.result;
                else return validation;
            })
    }

    /**
     * make reverse account when reservation is canceled. money income / expenditure will be reversed.
     * @param id {Object} reservation id
     * @param data {Object} raw data requested through router
     * @param currentDate {Date} current date
     * @returns {Promise<any>}
     */
    static makeReverseData(id, data) {
        const query = `SELECT * FROM reservation, account WHERE reservation.id = account.id AND reservation.id = ${id}`;
        let newAccount;
        return new Promise((resolve, reject) => {
            sqlDB.query(query, (err, result) => {
                const bool = (result.command === 'SELECT' && result.rowCount > 0);
                if (err || !bool) throw new Error(`get data from Account database failed. ${id}`);
                newAccount = new Account(result.rows[0], data);
                if (result.rowCount === 2 && (result.rows[0].option.reverseAccountPresent || result.rows[1].option.reverseAccountPresent)) {
                    newAccount.insertInhibition = true;
                }
                newAccount = Account.reverseMoneyProcess(newAccount);
                newAccount.option.reverseAccountPresent = true;
                resolve(newAccount);
            });
        });
    }

    /**
     *
     * @param account {Object}
     * @returns {Promise<any | never>}
     */
    static insertSQL(account) {
        return accountCreateQuery(account)
            .then(text => {
                const query = `INSERT INTO account (${text.keys}) VALUES (${text.values}) RETURNING *`;
                return new Promise((resolve, reject) => {
                    sqlDB.query(query, (err, result) => {
                        const bool = (result.command === 'INSERT' && result.rowCount === 1);
                        if (err || !bool) throw new Error(`Account insert to SQL failed. Account ${account}`);
                        resolve(result.rows[0]);
                    });
                });
            });
    }
}

function accountCreateQuery(object) {
    let tempKeys = "";
    let tempValues = "";
    return new Promise((resolve, reject) => {
        let value;
        Object.keys(object).forEach((key, index) => {
            value = object[key];
            if (ACCOUNT_KEY_MAP.includes(key) && key !== 'id') {
                if (typeof value === 'object') { tempValues += "'" + JSON.stringify(value) + "'" + ", "}
                else if (typeof value === 'string') { tempValues += "'" + value + "'" + ", "}
                else { tempValues += value + ", "}
                tempKeys += key + ", ";
            }
            if (index === Object.keys(object).length - 1) {
                resolve({keys: tempKeys.slice(0, -2), values: tempValues.slice(0, -2)})
            }
        });
    })
}
// const testFile = require('./test files/v2TEST_AccountData.json');
// Account.validation(testFile['1']).then(result => console.log(result))

module.exports = Account;