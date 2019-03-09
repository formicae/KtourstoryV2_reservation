const sqlDB = require('../auth/postgresql');
const validation = require('./validation');
const ACCOUNT_KEY_MAP = validation.ACCOUNT_KEY_MAP;
const Exceptor = require('../../exceptor');

class Account {
    constructor(data) {
        if (!!data.id) this.id = data.id;
        if (Math.abs(data.productData.income) + Math.abs(data.productData.expenditure) <= 0) Exceptor.report(Exceptor.TYPE.NO_PRICE_INFO, 'Total amount of money is zero');
        const currentDate = Account.getGlobalDate();
        this.sqlData = Account.generateSQLObject(data, currentDate);
        this.elasticData = Account.generateElasticObject(data, currentDate);
    }

    static generateSQLObject(data, currentDate) {
        const result = {
            writer : data.writer,
            category : data.productData.category,
            currency : data.productData.currency,
            income : Account.moneyPreprocess(data.productData.income) || 0.00,
            expenditure : Account.moneyPreprocess(data.productData.expenditure) || 0.00,
            cash : data.cash,
            memo : data.account_memo,
            created_date : currentDate,
            reservation_id : data.reservation_id
        };
        if (!!data.account_id) result.id = data.account_id;
        return result;
    }

    static generateElasticObject(data, currentDate) {
        return {
            id : data.account_id,
            writer : data.writer,
            category : data.productData.category,
            currency : data.productData.currency,
            income : data.productData.income,
            expenditure : data.productData.expenditure,
            cash : data.cash,
            memo : data.account_memo,
            created_date: currentDate,
            reservation : {
                id : data.reservation_id,
                agency : data.agency,
                tour_date : data.date,
                nationality : data.nationality,
                adult : data.adult,
                kid : data.kid,
                infant : data.infant,
                product : {
                    name : data.productData.name,
                    alias : data.productData.alias,
                    category : data.productData.category,
                    area : data.productData.area
                },
                options : data.options
            }
        }
    }

    static getGlobalDate() {
        return new Date().toISOString().slice(0,-2);
    }

    static moneyPreprocess(money) {
        const result = Number(money);
        if (!result || isNaN(result) || result < 0) return 0;
        return result;
    }

    static reverseMoneyProcess(account) {
        if (account.income > 0) {
            account.expenditure = (-1) * account.income;
            account.income = 0
        } else {
            account.income = (-1) * account.expenditure;
            account.expenditure = 0;
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
     * make reverse account when reservation is canceled.
     * canceled reservation data is being used to make reverse account data
     * @param data {Object} data from v2Reservation router. Reservation id is included.
     * @returns {Promise<boolean | never>}
     */
    static insertReverseAccountToSQL(data) {
        let reverseAccount;
        const queryColumns = 'acc ount.id, writer, category, currency, income, expenditure, cash, account.memo, created_date, reservation_id';
        const query = `SELECT ${queryColumns} FROM reservation, account WHERE reservation.id = account.reservation_id AND reservation.id = ${data.canceled_reservation_id}`;
        return new Promise((resolve, reject) => {
            sqlDB.query(query, (err, result) => {
                const bool = (result.command === 'SELECT' && result.rowCount > 0);
                if (err || !bool) throw new Error(`get data from Account database failed. ${data.canceled_reservation_id}`);
                resolve(result.rows[0])})})
            .then(canceledData => {
                const tempAccount = new Account(canceledData);
                reverseAccount = Account.reverseMoneyProcess(tempAccount.sqlData);
                return Account.insertSQL(reverseAccount)})
            .then(result => {
                const bool = (result.command === 'INSERT' && result.rowCount === 1);
                if (err || !bool) throw new Error(`Reverse Account insert to SQL failed.`);
                return reverseAccount;
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

    /**
     * Insert data to Elastic search
     * @param account {Object} account object
     * @returns {Promise<any>}
     */
    static insertElastic(account) {
        return new Promise((resolve, reject)=> {
            elasticDB.create({
                index : 'ktour_account',
                type : '_doc',
                id : account.id,
                body: account
            },(err, resp) => {
                if (err || resp.result !== 'created' || resp._shards.successful <= 0) {
                    Exceptor.report(Exceptor.TYPE.NETWORK_ERR, `Elastic search insert failed. reservation id : ${reservation.id}`);
                    throw new Error('Failed : insert Account to Elastic');
                }
                resolve(true);
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
const testAccount = {
    id: 'testId2935',
    writer: 'Ktour || Formicae',
    category: 'CATEGORY-39',
    currency: 'KRW',
    income: 45000,
    expenditure: 0,
    cash: true,
    memo: 'pre-paid(account)',
    created_date: '2019-03-09T08:10:18.87',
    reservation: {
        id: 'testI12391u60',
        agency: 'Klook',
        tour_date: new Date(2019,3,17,15,0,0),
        nationality: 'Korea',
        adult: 6,
        kid: 2,
        infant: 4,
        product: {
            name: '통영루지_스키',
            alias: 'Busan_통영_루지_스키',
            category: 'CATEGORY-39',
            area: 'BUSAN'
        },
        options: { '0': {name:'LUGI',number:4}, '1': {name:'SKI',number:2} }
    }
};
// const testFile = require('./test files/v2TEST_AccountData.json');
// Account.validation(testFile['1']).then(result => console.log(result))

module.exports = Account;