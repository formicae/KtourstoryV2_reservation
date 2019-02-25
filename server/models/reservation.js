const sqlDB = require('../databaseAuth/postgresql');
const fbDB = require('../databaseAuth/firebase').database;
const elasticDB = require('../databaseAuth/elastic');
const validation = require('./validation');
const TIME_OFFSET_MAP = {'UTC0':0,'UTC+1':-60,'UTC+2':-120,'UTC+3':-180,'UTC+4':-240,'UTC+5':-300,'UTC+6':-360, 'UTC+7':-420,'UTC+8':-480,'UTC+9':-540,'UTC+10':-600,'UTC+11':-660,'UTC+12':-720,'UTC-1':60,'UTC-2':120,'UTC-3':180,'UTC-4':240,'UTC-5':300,'UTC-6':360,'UTC-7':420,'UTC-8':480,'UTC-9':540,'UTC-10':600,'UTC-11':660};
const RESERVATION_KEY_MAP = validation.RESERVATION_KEY_MAP;
const Exceptor = require('../../exceptor');

class Reservation {
    constructor(data) {
        const currentDate = Reservation.getGlobalDate();
        if (!!data.id) this.id = data.id;
        this.mail_id = (!data.mail_id) ? 'NM-' + new Date().getTime() : data.mail_id;
        this.product_id = (!data.product_id) ? '' : data.product_id;
        this.agency_id = (!data.agency_id) ? '' : data.agency_id;
        this.reserved_name = (!data.reserved_name) ? '' : data.reserved_name;
        this.nationality = (!data.nationality) ? '' : data.nationality;
        if (!!data.timezone) { this.timezone = data.timezone }
        else if (!!data.timezone) {this.timezone = data.timezone }
        else { data.timezone = 'UTC+9' }
        this.operation_date = (!data.operation_date) ? 'No operation_date' : Reservation.getLocalDate(data.operation_date, data.timezone);
        this.pickup_place = (!data.pickup_place) ? '' : data.pickup_place;
        this.option = Reservation.optionPreprocess(data.option);
        this.adult = Reservation.peopleNumberPreprocess(data.adult);
        this.child = Reservation.peopleNumberPreprocess(data.child);
        this.infant = Reservation.peopleNumberPreprocess(data.infant);
        this.memo = (!data.memo) ? '' : data.memo;
        this.phone = Reservation.phoneNumberPreprocess(data.phone);
        this.email = (!data.email) ? '' : data.email;
        this.messenger = (!data.messenger) ? '' : data.messenger;
        this.canceled = (!data.canceled) ? false : Boolean(data.canceled);
        this.reserved_date = (!data.reserved_date) ? currentDate : data.reserved_date;
        this.modify_date = (!data.modify_date) ? currentDate : data.modify_date;
        this.cancel_comment = (!data.cancel_comment) ? '' : data.cancel_comment;
        if (data.adult + data.child + data.infant <= 0) {
            Exceptor.report(Exceptor.TYPE.NO_PEOPLE_NUMBER_INFO, 'Total number of people is zero');
        }
    }

    /**
     * generate object which will be saved in Elastic search
     * @param reservation {Object} reservation data which is already saved in postgreSQL
     * @param product {Object} product data
     */
    static generateElasticObject(reservation, product){
        return {
            id : Number(reservation.id),
            mail_id : reservation.mail_id,
            product : {
                id : Number(reservation.product_id),
                name : product.name,
                category : product.category,
                area : product.area,
                geos : product.geos
            },
            agency : reservation.agency,
            reserved_name : reservation.reservation_id,
            nationality : reservation.nationality,
            operation_date : reservation.operation_date,
            pickup_place : reservation.pickup_place,
            option : reservation.option,
            adult : Number(reservation.adult),
            child : Number(reservation.child),
            infant : Number(reservation.infant),
            memo : reservation.memo,
            phone : reservation.phone,
            email : reservation.email,
            messenger : reservation.messenger,
            canceled : reservation.canceled,
            reserved_date : reservation.reserve_date,
            modify_date : reservation.modify_date,
            timezone : reservation.timezone,
            cancel_comment : reservation.cancel_comment
        }
    }

    static getGlobalDate() {
        return new Date().toISOString().slice(0,-2);
    }

    static getTimeOffset(utc) {
        return TIME_OFFSET_MAP[utc.toUpperCase()];
    }

    static getLocalDate(date, utc) {
        if (typeof date === 'string') return new Date(new Date(date) - (Number(Reservation.getTimeOffset(utc)) * 60000));
        return new Date(date - (Number(Reservation.getTimeOffset(utc)) * 60000));
    }

    static optionPreprocess(option) {
        if (!option) return {};
        if (typeof option === 'string') return JSON.parse(option);
        return option;
    }

    static peopleNumberPreprocess(numPeople) {
        const result = Number(numPeople);
        if (!result || isNaN(result)) return 0;
        if (result < 0) return 0;
        return result;
    }

    static phoneNumberPreprocess(phone) {
        if (!phone || typeof phone !== 'string') return '';
        let result = phone.trim();
        if (phone.charAt(0) === "0") result = phone.slice(1, phone.length);
        if (phone.charAt(0) !== "+") result = "+" + result;
        return result;
    }

    /**
     *
     * @param reservation {Object} reservation object
     * @param detail {Boolean} false : only validation result. true : include details
     * @returns {PromiseLike<T | never> | Promise<T | never>}
     */
    static validationUpdate(reservation, detail) {
        return validation.validReservationUpdateCheck(reservation)
            .then(validation => {
                console.log('validationUpdate - result : ',validation.result);
                if (!detail) return validation.result;
                else return validation;
            });
    }

    /**
     *
     * @param reservation {Object} reservation object
     * @param detail {Boolean} false : only validation result. true : include details
     * @returns {PromiseLike<T | never> | Promise<T | never>}
     */
    static validationCreate(reservation, detail) {
        return validation.validReservationCreateCheck(reservation)
            .then(validation => {
                console.log('validationCreate - result : ',validation.result);
                if (!detail) return validation.result;
                else return validation;
            });
    }

    static insertSQL(reservation) {
        return reservationCreateQuery(reservation)
            .then(text => {
                return new Promise((resolve, reject)=> {
                    const query = `INSERT INTO reservation (${text.keys}) VALUES (${text.values}) RETURNING *`;
                    sqlDB.query(query, (err, result) => {
                        const bool = (result.command === 'INSERT' && result.rowCount === 1);
                        if (err || !bool) throw new Error('Reservation insert to SQL failed');
                        resolve(result.rows[0]);
                    });
                });
            });
    }

    static updateSQL(reservation) {
        reservation.modify_date = Reservation.getGlobalDate();
        return reservationUpdateQuery(reservation)
            .then(text => {
                return new Promise((resolve, reject) => {
                    const query = `UPDATE reservation SET ${text} WHERE id = ${reservation.id} RETURNING *`;
                    sqlDB.query(query, (err, result) => {
                        const bool = (result.command === 'UPDATE' && result.rowCount === 1);
                        if (err || !bool) throw new Error('Reservation update from SQL failed');
                        resolve(result.rows[0]);
                    });
                });
            })
    }

    static insertFB(reservation) {
        return new Promise((resolve, reject) => {
            // todo : create data to Firebase
            resolve(true);
        })
    }
    static cancelFB(reservation) {
        return new Promise((resolve, reject) => {
            // todo : delete reservation data from Firebase - operation
            const date = reservation.operation_date.toISOString().slice(0,10);
            // fbDB.ref('_operation').child(date).push()
            resolve(true);
        })
    }

    static insertElastic(reservation) {
        return new Promise((resolve, reject)=> {
            elasticDB.create({
                index: 'ktour_story',
                type: 'reservation',
                id: reservation.id,
                body: reservation
            },(err, resp) => {
                if (err || resp.result !== 'created' || resp._shards.successful <= 0) {
                    Exceptor.report(Exceptor.TYPE.NETWORK_ERR, `Elastic search insert failed. reservation id : ${reservation.id}`);
                    throw new Error('Failed : insertElastic');
                }
                resolve(true);
            });
        });
    }

    static cancelElastic(id) {
        return new Promise((resolve, reject) => {
            elasticDB.delete({
                index:'ktour_story',
                type:'reservation',
                id:id
            }, (err, resp) => {
                if (err || resp.result !== 'deleted' || resp._shards.successful <= 0) {
                    Exceptor.report(Exceptor.TYPE.NETWORK_ERR, `Elastic search delete failed. reservation id : ${reservation.id}`);
                    throw new Error('Failed : cancelElastic');
                }
                resolve(true);
            });
        })
    }

    /**
     * search data from Elasticsearch and return corresponding data
     * ex) {'product.name':'태감오해'}, {'nationality':'HONG KONG'}
     * @param query {Object} query for searching data. key of query must be string.
     * @returns {Promise<any>}
     */
    static searchElastic(query) {
        const result = {exist:false, score:{}, result:{}};
        return new Promise((resolve, reject) => {
            elasticDB.search({
                index:'ktour_story',
                type:'reservation',
                body:{
                    query : { match : query }
                }
            }, (err, resp) => {
                if (err || resp.timed_out) {
                    Exceptor.report(Exceptor.TYPE.NETWORK_ERR, `Elastic search search failed. query : ${query}`);
                    throw new Error('Failed : searchElastic');
                }
                if (resp._shards.successful <= 0) resolve(result);
                result.exist = true;
                resp.hits.hits.forEach(item => {
                    result.result[item._source.id] = item._source;
                    result.score[item._source.id] = item._score;
                });
                resolve(result);
            });
        })
    }

}

function reservationUpdateQuery(object) {
    let result = "";
    return new Promise((resolve, reject) => {
        let value;
        Object.keys(object).forEach((key, index) => {
            value = object[key];
            if (RESERVATION_KEY_MAP.includes(key)) {
                result += key + " = "
                if (typeof value === 'object') { result += "'" + JSON.stringify(value) + "'" + ", "}
                else if (typeof value === 'string') { result += "'" + value + "'" + ", "}
                else { result += value + ", "}
            }
            if (index === Object.keys(object).length - 1) {
                resolve(result.slice(0,-2))
            }
        });
    })
}

function reservationCreateQuery(object) {
    let tempKeys = "";
    let tempValues = "";
    return new Promise((resolve, reject) => {
        let value;
        Object.keys(object).forEach((key, index) => {
            value = object[key];
            if (RESERVATION_KEY_MAP.includes(key) && key !== 'id') {
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

function testById() {
    const TEST_FILE = require('./test files/v2TEST_ReservationData.json');
    const testReservation = TEST_FILE['106'];
    console.log(testReservation);
    Reservation.validationCreate(testReservation, true)
        .then(result => console.log('validation result : ',result));
}
// testById()

function dataBaseToTestData() {
    const tempJSON = {};
    sqlDB.query(`SELECT * FROM reservation WHERE id >= 85 and id <= 107`, (err, result) => {
        const data = result.rows;
        for (let i=0; i<data.length; i++){
            tempJSON[data[i].id] = data[i];
        };
        console.log(JSON.stringify(tempJSON));
    });
}

function makeElasticObject(){
    const v2Reservation = require('./test files/v2TEST_ReservationData.json');
    const product = require('./test files/v2ProductData.json');
    const elasticObj = {};
    Object.keys(v2Reservation).forEach(id => {
        if (v2Reservation[id].product_id.match(/_/) && v2Reservation[id].product_id.length > 10){
            // console.log(v2Reservation[id].product_id, id)
            elasticObj[id] = Reservation.generateElasticObject(v2Reservation[id], product[v2Reservation[id].product_id]);
        }
    });
    console.log(JSON.stringify(elasticObj));
}

// Reservation.searchElastic({"product.area":"Busan"}).then(result => console.log(result))

module.exports = Reservation;



