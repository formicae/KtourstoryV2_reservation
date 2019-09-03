const sqlDB = require('../auth/postgresql');
const elasticDB = require('../auth/elastic');
const validation = require('./validation');
const ACCOUNT_KEY_MAP = validation.ACCOUNT_KEY_MAP;
const TIME_OFFSET_MAP = validation.TIME_OFFSET_MAP;
const log = require('../../log');

class Account {
    constructor(data) {
        if (!!data.id) this.id = data.id;
        if (Math.abs(data.productData.income) + Math.abs(data.productData.expenditure) <= 0)
            log.warn('Model', 'Account-contructor', `no Money info : [income : ${data.productData.income}, expenditure : ${data.productData.expenditure}]`);
        const currentDate = Account.getGlobalDate();
        this.sqlData = Account.generateSQLObject(data, currentDate);
        this.elasticData = Account.generateElasticObject(data, currentDate);
    }

    static generateSQLObject(data, currentDate) {
        const result = {
            writer : data.writer || data.agency,
            category : data.category || 'Reservation',
            currency : data.productData.currency || 'KRW',
            income : Account.moneyPreprocess(data.productData.income),
            expenditure : Account.moneyPreprocess(data.productData.expenditure),
            cash : data.cash,
            memo : data.account_memo || '',
            created_date : currentDate,
            reservation_id : data.reservation_id,
            card_number : data.card_number || '',
            sub_category: data.sub_category || '',
            contents : data.contents || ''
        };
        if (!!data.account_id) result.id = data.account_id;
        return result;
    }

    static generateElasticObject(data, currentDate) {
        const result = {
            id : data.account_id,
            writer : data.writer || data.agency,
            category : data.category || 'Reservation',
            sub_category : data.sub_category || '',
            card_number : data.card_number || '',
            date : data.date || currentDate,
            currency : data.productData.currency || 'KRW',
            income : data.productData.income,
            expenditure : data.productData.expenditure,
            cash : data.cash,
            memo : data.account_memo || '',
            memo_history : [],
            contents : data.contents || '',
            created_date: currentDate,
            star : false,
            reservation : {
                id : data.reservation_id,
                agency : data.agency || '',
                tour_date : data.date,
                nationality : (data.nationality || 'unknown').toUpperCase(),
                adult : data.adult,
                kid : data.kid,
                infant : data.infant,
                product : {
                    name : data.productData.name,
                    alias : data.productData.alias,
                    category : data.productData.category,
                    area : data.productData.area
                },
                options : data.options || {}
            },
            operation : data.operationData
        };
        if (!!data.account_memo) {
            result.memo_history.push({
                writer : result.writer,
                memo : result.memo,
                date : result.created_date
            })
        }
        if (!!data.prev_memo) {
            result.memo_history.push({
                writer : data.prev_writer,
                memo : data.prev_memo,
                date : data.prev_created_date
            })
        }
        return result;
    }

    static getGlobalDate() {
        // return new Date().toISOString().slice(0,-2);
        return new Date(new Date() - ((validation.TIME_OFFSET_MAP['UTC+9']) * 60000)).toISOString().slice(0,-2);
    }

    static getTimeOffset(utc) {
        return TIME_OFFSET_MAP[utc.toUpperCase()];
    }

    static getLocalDate(date, utc) {
        if (typeof date === 'string') return new Date(new Date(date) - (Number(this.getTimeOffset(utc)) * 60000)).toISOString().slice(0,-2);
        return new Date(date - (Number(this.getTimeOffset(utc)) * 60000)).toISOString().slice(0,-2);
    }

    static moneyPreprocess(money) {
        const result = Number(money);
        if (!result || isNaN(result) || result < 0) return 0;
        return result;
    }

    static reverseMoneyProcess(account) {
        if (account.income > 0) {
            account.expenditure = account.income;
            account.income = 0
        } else {
            account.income = account.expenditure;
            account.expenditure = 0;
        }
        return account;
    }

    /**
     * validation for account Object
     * @param account {Object} account object
     * @returns {PromiseLike<T | never> | Promise<T | never>}
     */
    static async validation(account) {
        const val = await validation.validAccountCheck(account);
        if (!val.result) log.warn('Model', 'Account - validation', `account validation failed. detail : ${JSON.stringify(val.detail)}`);
        else log.debug('Model', 'Account - validation', `account validation success`);
        return val;
    }

    /**
     * process account data from productData
     * @param prev_account {Object} previous account object
     * @param data {Object} overall data object
     * @returns {*}
     */
    static reverseAccountDataProcessing(prev_account, data) {
        prev_account.prev_writer = prev_account.writer;
        prev_account.prev_created_date = this.getLocalDate(prev_account.created_date, data.timezone || 'UTC+9');
        prev_account.prev_memo = prev_account.memo;
        prev_account.date = data.date;
        prev_account.agency = data.agency;
        if (!!data.category) prev_account.category =  data.category;
        if (!!data.sub_category) prev_account.sub_category = data.sub_category;
        if (!!data.contents) prev_account.contents = data.contents + ` / ${prev_account.id} 의 수정회계`;
        else prev_account.contents = `${prev_account.id} 의 수정회계`;
        if (!!data.card_number) prev_account.card_number = data.card_number;
        if (!!data.cash) prev_account.cash = data.cash;
        if (!!data.nationality)prev_account.nationality = data.nationality;
        if (!!data.writer) prev_account.writer = data.writer;
        if (!!data.account_memo) prev_account.account_memo = data.account_memo += ` / reverseAccount 인 ${prev_account.id} 의 정보 : [category : ${prev_account.category}], [sub_category : ${prev_account.sub_category}], [contents : ${prev_account.contents}]`;
        prev_account.productData = {
            category : data.category || prev_account.category,
            currency : prev_account.currency,
            income : prev_account.income,
            expenditure : prev_account.expenditure,
            name : data.productData.name,
            alias : data.productData.alias,
            area : data.productData.area
        };
        prev_account.created_date = Account.getGlobalDate();
        prev_account.cash = data.cash;
        return prev_account;
    }

    /**
     * get account data from SQL using reservation id.
     * if multiple account data is present, oldest account will be selected.
     * @param data {Object} raw data object
     * @param testObj {Object} only for test purpose. "isTest" : flag for test, "fail" : flag that one of the functions should fail, "detail" : detailed object for fail function information
     * @returns {Promise<any | never>}
     */
    static processReverseAccount(data, testObj) {
        if (testObj.isTest && testObj.fail && testObj.target === 'account' && testObj.detail.processReverseAccount) return Promise.resolve(false);
        const queryColumns = 'account.id, account.writer, category, sub_category, contents, currency, income, expenditure, cash, account.memo, reservation_id, account.created_date';
        const query = `SELECT ${queryColumns} FROM reservation, account WHERE reservation.id = account.reservation_id AND reservation.id = '${data.previous_reservation_id}'`;
        return new Promise((resolve, reject) => {
            sqlDB.query(query, (err, result) => {
                if (err) {
                    log.warn('Model', 'processReverseAccount', `query from Account failed : ${query}`);
                    return false;
                }
                log.debug('Model','processReverseAccount',`query from Account success! target reservation id : ${data.previous_reservation_id}`);
                resolve(result.rows[0])})})
            .then(existSQLAccount => {
                if (!existSQLAccount) {
                    log.warn('Model', 'processReverseAccount', `Account load from SQL failed`);
                    return false;
                } else {
                    const tempAccount = new Account(Account.reverseAccountDataProcessing(existSQLAccount, data));
                    tempAccount.sqlData = Account.reverseMoneyProcess(tempAccount.sqlData);
                    tempAccount.elasticData = Account.reverseMoneyProcess(tempAccount.elasticData);
                    if (tempAccount.id) delete tempAccount.id;
                    log.debug('Model', 'processReverseAccount', 'reverse Account process success!');
                    return tempAccount;
                }
            });
    };

    /**
     * insert account Object to postgreSQL database
     * @param account {Object}
     * @param testObj {Object} only for test purpose. "isTest" : flag for test, "fail" : flag that one of the functions should fail, "detail" : detailed object for fail function information
     * @returns {Promise<any | never>}
     */
    static insertSQL(account, testObj) {
        if (testObj.isTest && testObj.fail && testObj.target === 'account' && testObj.detail.insertSQL) return Promise.resolve(false);
        const text = accountCreateQuery(account);
        const query = `INSERT INTO account (${text.keys}) VALUES (${text.values}) RETURNING *`;
        return new Promise((resolve, reject) => {
            sqlDB.query(query, (err, result) => {
                if (err) {
                    log.warn('Model','Account-insertSQL',`insert SQL failed query : ${query}`);
                    resolve(false);
                }
                result.rows[0].id = 'a' + result.rows[0]._id;
                log.debug('Model','Account-insertSQL', `insert to SQL success : ${result.rows[0].id}`);
                resolve(result.rows[0]);
            });
        });
    }

    /**
     * Insert data to Elastic search
     * @param account {Object} account object
     * @param testObj {Object} only for test purpose. "isTest" : flag for test, "fail" : flag that one of the functions should fail, "detail" : detailed object for fail function information
     * @returns {Promise<any>}
     */
    static insertElastic(account, testObj) {
        if (testObj.isTest && testObj.fail && testObj.target === 'account' && testObj.detail.insertElastic) return Promise.resolve(false);
        return new Promise((resolve, reject)=> {
            elasticDB.create({
                index : 'account',
                type : '_doc',
                id : account.id,
                body: account
            },(err, resp) => {
                if (err) {
                    log.warn('Model','Account-insertElastic', `insert Elastic failed : ${account.id}`);
                    resolve(false);
                } else {
                    log.debug('Model','Account-insertElastic', `insert to Elastic success : ${account.id}`);
                    resolve(true);
                }
            });
        });
    }

    /**
     * get elastic Data with query
     * @param query {Object} query string. example : {id : "a1409"}
     * @returns {Promise<any>}
     */
    static getElastic(query) {
        const result = {exist:false, score:{}, result:{}};
        return new Promise((resolve, reject) => {
            elasticDB.search({
                index:'account',
                type:'_doc',
                body:{
                    query : { match : query }
                }
            }, (err, resp) => {
                if (err || resp.timed_out) {
                    log.warn('Model', 'Reservation-searchElastic', `query from Elastic failed : ${query}`);
                    throw new Error(`Failed : searchElastic : ${JSON.stringify(err)}`);
                }
                if (resp._shards.successful <= 0) resolve(result);
                result.exist = true;
                resp.hits.hits.forEach(item => {
                    result.result[item._source.id] = item._source;
                    result.score[item._source.id] = item._score;
                });
                resolve(result.result);
            });
        })
    }
}

function accountCreateQuery(object) {
    let tempKeys = "";
    let tempValues = "";
    let value;
    Object.keys(object).forEach((key, index) => {
        value = object[key];
        if (ACCOUNT_KEY_MAP.includes(key) && key !== 'id') {
            if (typeof value === 'object') {
                if (!value) tempValues += null + ", ";
                else tempValues += "'" + JSON.stringify(value) + "'" + ", "
            }
            else if (typeof value === 'string') { tempValues += "'" + value + "'" + ", "}
            else { tempValues += value + ", "}
            tempKeys += key + ", ";
        }
    });
    return {keys: tempKeys.slice(0, -2), values: tempValues.slice(0, -2)};
}

module.exports = Account;