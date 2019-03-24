const sqlDB = require('../auth/postgresql');
const fbDB = require('../auth/firebase').database;
const elasticDB = require('../auth/elastic');
const validation = require('./validation');
const log = require('../../log');
const TIME_OFFSET_MAP = {'UTC0':0,'UTC+1':-60,'UTC+2':-120,'UTC+3':-180,'UTC+4':-240,'UTC+5':-300,'UTC+6':-360, 'UTC+7':-420,'UTC+8':-480,'UTC+9':-540,'UTC+10':-600,'UTC+11':-660,'UTC+12':-720,'UTC-1':60,'UTC-2':120,'UTC-3':180,'UTC-4':240,'UTC-5':300,'UTC-6':360,'UTC-7':420,'UTC-8':480,'UTC-9':540,'UTC-10':600,'UTC-11':660};
const RESERVATION_KEY_MAP = validation.RESERVATION_KEY_MAP;

const BUS_PEOPLE_MAX_NUMBER = 40;
sqlDB.connect();

class Team {
    constructor() {
        this.notification = '';
        this.guides = { id : '', name : '',};
        this.reservations = {};
    }
}

class Reservation {
    constructor(data) {
        if (data.adult + data.kid + data.infant <= 0) log.info('INFO', 'Reservation people number', 'Total number of people is zero', {message_id:data.message_id});
        const currentDate = Reservation.getGlobalDate();
        this.sqlData = Reservation.generatePostgreSQLObject(data, currentDate);
        this.elasticData = Reservation.generateElasticObject(data, currentDate);
    }

    /**
     * generate object which will be saved in Elastic search
     * @param data {Object} reservation data
     * @param currentDate {String} Time information without timezone information which is made in server.
     */
    static generateElasticObject(data, currentDate){
        const result = {
            id : data.reservation_id,
            message_id : data.message_id,
            writer : data.writer,
            product : {
                id : data.productData.id,
                name : data.productData.name,
                alias : data.productData.alias,
                category : data.productData.category,
                area : data.productData.area,
                geos : Reservation.locationPreprocess(data.productData.geos)
            },
            agency : data.agency,
            name : data.name,
            nationality : data.nationality,
            tour_date : data.date,
            pickup : data.pickup,
            options : Reservation.optionPreprocess(data.options),
            adult : Reservation.peopleNumberPreprocess(data.adult),
            kid : Reservation.peopleNumberPreprocess(data.kid),
            infant : Reservation.peopleNumberPreprocess(data.infant),
            phone : Reservation.phoneNumberPreprocess(data.phone),
            email : data.email,
            messenger : data.messenger,
            memo : data.reservation_memo,
            canceled : data.canceled,
            modified_date : currentDate,
            timezone : data.timezone,
        };
        if (!data.created_date) {
            result.created_date = currentDate;
        } else { result.created_date = data.reservation_created_date }
        if (!!data.timezone) result.timezone = 'UTC+9';
        result.total = result.adult + result.kid + result.infant;
        return result;
    }

    /**
     * Generate data for postgreSQL.
     * @param data {Object} Reservation data
     * @param currentDate {String} Time information without timezone information which is made in server.
     * @returns {{message_id: *, agency_id: *, writer_id: (*|boolean|string|Function), date: (*|string), option: {}, adult: (number|*), kid: (number|*), infant: (number|*), canceled: (boolean|string), reserved_date: (string|boolean|*)}}
     */
    static generatePostgreSQLObject(data, currentDate) {
        const result = {
            message_id: data.message_id,
            writer : data.writer,
            product_id : data.productData.id,
            agency : data.agency,
            tour_date : data.date,
            options : Reservation.optionPreprocess(data.options),
            adult : Reservation.peopleNumberPreprocess(data.adult),
            kid : Reservation.peopleNumberPreprocess(data.kid),
            infant : Reservation.peopleNumberPreprocess(data.infant),
            canceled : data.canceled,
            modified_date : currentDate,
        };
        if (!!data.reservation_id) {
            result.id = data.reservation_id;
            result.created_date = currentDate;
        } else { result.created_date = data.reservation_created_date }
        return result;
    }

    static generateFirebaseObject(data) {
        return {
            id : data.reservation_id,
            name : data.name,
            nationality : data.nationality,
            agency : data.agency,
            writer : data.writer,
            pickup : data.pickup,
            adult : data.adult,
            kid : data.kid,
            infant : data.infant,
            options : data.options,
            phone : data.phone,
            email : data.email,
            messenger : data.messenger,
            memo : data.reservation_memo,
            g : data.g || false,
            o : data.o || false
        };
    }

    static getGlobalDate() {
        return new Date().toISOString().slice(0,-2);
    }

    static getTimeOffset(utc) {
        return TIME_OFFSET_MAP[utc.toUpperCase()];
    }

    static locationPreprocess(object) {
        let temp = object;
        if (typeof object === 'string') temp = JSON.parse(object);
        return {
            place : temp.place,
            location : {
                lat : Number(temp.location.lat),
                lng : Number(temp.location.lng)
            }
        }
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
     * Validation for updating reservation before delete / insert data from / to databases.
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
     * Validation for creating reservation before insert data to databases.
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

    /**
     * insert data to postgreSQL
     * @param reservation
     * @returns {Promise<any>}
     */
    static insertSQL(reservation) {
        const text = reservationCreateQuery(reservation)
        return new Promise((resolve, reject)=> {
            const query = `INSERT INTO reservation (${text.keys}) VALUES (${text.values}) RETURNING *`;
            sqlDB.query(query, (err, result) => {
                const bool = (result.command === 'INSERT' && result.rowCount === 1);
                if (err || !bool) {
                    log.warn('WARN', 'SQL DB insert fail', 'data insert to SQL failed', {reservation_id : reservation.id});
                    throw new Error('Reservation insert to SQL failed');
                }
                resolve(result.rows[0]);
            });
        });
    }

    /**
     * Update postgreSQL only changes "canceled" column to true.
     * @param reservation {Object} reservation object to be deleted.
     * @returns {Promise<any>}
     */
    static cancelSQL(reservation) {
        return new Promise((resolve, reject) => {
            const query = `UPDATE reservation SET canceled = true WHERE id = ${reservation.id}`;
            sqlDB.query(query, (err, result) => {
                const bool = (result.command === 'UPDATE' && result.rowCount === 1);
                if (err || !bool) {
                    log.warn('WARN', 'SQL DB cancel fail', 'data update from SQL failed - make "cancel" column to TRUE', {reservation_id : reservation.id});
                    throw new Error('Reservation update from SQL failed');
                }
                resolve(result.rows[0]);
            });
        });
    }

    /**
     * make new Team for operation of Firebase.
     * @param reservation {Object} reservation object
     * @param data {Object} tongjjabaegi object from Clinet server or BOT.
     * @returns {admin.database.ThenableReference}
     */
    static newTeamBuild(reservation, data){
        const team = new Team();
        team.reservations[reservation.id] = reservation;
        return fbDB.ref.child(data.date).child(reservation.productData.id).child('teams').push(team);
    }

    /**
     * team building function when product is not private and
     * total people number of reservation is smaller than maximum people number of bus.
     * @param reservation {Object} reservation object
     * @param data {Object} tongjjabaegi object from Clinet server or BOT.
     * @param operation {Object} operation data from firebase. starts with team data.
     * @returns {admin.database.ThenableReference}
     */
    static regularTeamBuild(reservation, data, operation) {
        if (!operation.teams) operation.teams = [];
        const fbReservation = Reservation.generateFirebaseObject(data);
        const reservedPeopleNumber = data.adult + data.kid + data.infant;
        let peopleCount;
        for (let teamId in operation.teams) {
            let tempReservation;
            peopleCount = 0;
            for (let reservationId in operation.teams[teamId].reservations) {
                tempReservation = operation.teams[teamId][reservationId];
                peopleCount += (tempReservation.adult + tempReservation.kid + tempReservation.infant);
            }
            if (peopleCount + reservedPeopleNumber <= BUS_PEOPLE_MAX_NUMBER) {
                return fbDB.ref.child(data.date).child(reservation.productData.id)
                    .child('teams').child(teamId).child('reservations').child(reservation.id).update(fbReservation);
            }
        }
        return Reservation.newTeamBuild(reservation, data);
    }

    /**
     * Insert data to Firebase
     * @param reservation {Object} new reservation object
     * @param data {Object} tongjjabaegi data from Client server or BOT.
     */
    static insertFB(reservation, data) {
        const reservedPeopleNumber = data.adult + data.kid + data.infant;
        return new Promise((resolve, reject) => {
            fbDB.ref.child(data.date).child(reservation.productData.id).once('value', (snapshot) => {
                const operation = snapshot.val();
                if (reservation.productData.name.match(/private/i)) {
                    resolve(Reservation.newTeamBuild(reservation, data));
                } else if (reservedPeopleNumber > BUS_PEOPLE_MAX_NUMBER) {
                    log.debug('DEBUG', 'Reservation people number', 'maximum people number exceeded in one reservation');
                    reject(`maximum people number exceeded in one reservation : ${reservation.id}`);
                    //todo : make function for large number reservation here.
                } else {
                    resolve(Reservation.regularTeamBuild(reservation, data, operation));
                }
            });
        }).catch(err => {throw new Error(err)})
    }

    /**
     * cancel FB : delete previous data in firebase.
     * @param reservation {Object} reservation object
     * @param data {Object} tonjjabaegi data from Clinet server of BOT.
     */
    static cancelFB(reservation, data) {
        const operationArr = reservation.operation.split('/');
        const date = operationArr[0];
        const productId = operationArr[1];
        const teamId = operationArr[2];
        const reservationId = operationArr[3];
        return new Promise((resolve, reject) => {
            fbDB.ref.child(date).child(productId).child('teams').child(teamId)
                .child('reservations').child(reservationId).remove(err => {
                if (err) throw new Error(`reservation removed failed in firebase : ${reservationId}`);
                resolve(true)})})
            .then((result) => {
                if (result) return Reservation.insertFB(reservation, data);
            });
    }

    /**
     * Insert data to Elastic search
     * @param reservation {Object} reservation object
     * @returns {Promise<any>}
     */
    static insertElastic(reservation) {
        return new Promise((resolve, reject)=> {
            elasticDB.create({
                index : 'ktour_reservation',
                type : '_doc',
                id : reservation.id,
                body: reservation
            },(err, resp) => {
                if (err || resp.result !== 'created' || resp._shards.successful <= 0) {
                    log.warn('WARN', 'DB fail', 'insert into Elastic', {reservation_id : reservation.id});
                    throw new Error('Failed : insertElastic');
                }
                resolve(true);
            });
        });
    }

    /**
     * cancel Elastic : only change "canceled" column to true.
     * @param reservation {Object} reservation object
     * @returns {Promise<any>}
     */
    static cancelElastic(reservation) {
        return new Promise((resolve, reject) => {
            elasticDB.delete({
                index : 'ktour_reservation',
                type : '_doc',
                id : reservation.id
            }, (err, resp) => {
                if (err || resp.result !== 'deleted' || resp._shards.successful <= 0) {
                    log.warn('WARN', 'DB fail', 'delete from Elastic', {reservation_id : reservation.id});
                    throw new Error('Failed : cancelElastic')}
                resolve(resp)})})
            .then(() => {
                reservation.canceled = false;
                return Reservation.insertElastic(reservation);
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
                    log.warn('WARN', 'Search DB fail', 'query from Elastic', {query : query});
                    throw new Error('Failed : searchElastic',err);
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
            return {keys: tempKeys.slice(0, -2), values: tempValues.slice(0, -2)};
        }
    });
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

const example = {
    create : {
        product : '남쁘아',
        message_id : 'NM-201902171930',
        agency : 'Klook',
        writer : 'Ktour || Formicae',
        date : new Date(2019,2,18),
        pickup : 'Myeongdong',
        name : 'YeyakName',
        nationality : 'Korea',
        adult : 6,
        kid : 2,
        infant : 4,
        cash : true,
        timezone : 'UTC+9',
        options : {
            0 : {name : '번지점프', number : 2},
            1 : {name : '배', number : 3}
        },
        phone : '+10-5184-8886',
        email : 'anywhere@naver.com',
        messenger : 'noone@nate.com',
        reservation_memo : 'pre-paid(reservation)',
        account_memo : 'pre-paid(account)'
    },
    update : {
        reservation_id : 'r221',
        operation : '2019-02-22/p53/team3/r221',
        product : '남쁘아',
        agency : 'Klook',
        writer : 'Ktour || Formicae',
        canceled : false,
        date : new Date(2019,2,22),
        pickup : 'Myeongdong',
        name : 'YeyakName',
        area : 'Busan',
        adult : 6,
        kid : 2,
        infant : 4,
        cash : false,
        timezone : 'UTC+9',
        team_notification : 'this is an example data',
        nationality : 'Korea',
        options : {
            0 : {name : 'Ski', number : 4},
            1 : {name : '루지', number : 7}
        },
        phone : '+10-5184-8886',
        email : 'anywhere@naver.com',
        messenger : 'noone@nate.com',
        reservation_memo : 'pre-paid(reservation)',
        account_memo : 'pre-paid(account)'
    }
}
// const data = new Reservation(example);
// console.log('elastic : ',data.elastic);
// console.log('postgreSQL : ',data.sql);
// sqlDB.query('SELECT * FROM reservation WHERE id = 104', (err, result) => {
//     console.log(result.rows[0])
// })
const product = {
    name : '통영루지_스키',
    alias : 'Busan_통영_루지_스키',
    category : 'CATEGORY-39',
    currency : 'KRW',
    income : 45000,
    expenditure : 0,
    area : 'BUSAN',
    geos : {
        place : '통영',
        location : { lat : 35.11, lng : 96.84 }
    }
};
example.create.productData = product;
example.update.productData = product;
const kk = new Reservation(example.create);
// console.log(kk.elasticData);
// console.log(kk.sqlData);
const Account = require('./account');
const pp = new Account(example.create)
pp.elasticData.id = 'testId2935'
pp.elasticData.reservation.id = 'testI12391u60';
console.log(pp.elasticData)

module.exports = Reservation;



