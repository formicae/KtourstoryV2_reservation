const sqlDB = require('../auth/postgresql');
const fbDB = require('../auth/firebase').database;
const elasticDB = require('../auth/elastic');
const validation = require('./validation');
const log = require('../../log');
const TIME_OFFSET_MAP = {'UTC0':0,'UTC+1':-60,'UTC+2':-120,'UTC+3':-180,'UTC+4':-240,'UTC+5':-300,'UTC+6':-360, 'UTC+7':-420,'UTC+8':-480,'UTC+9':-540,'UTC+10':-600,'UTC+11':-660,'UTC+12':-720,'UTC-1':60,'UTC-2':120,'UTC-3':180,'UTC-4':240,'UTC-5':300,'UTC-6':360,'UTC-7':420,'UTC-8':480,'UTC-9':540,'UTC-10':600,'UTC-11':660};
const RESERVATION_KEY_MAP = validation.RESERVATION_KEY_MAP;

const BUS_PEOPLE_MAX_NUMBER = 43;
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
        if (data.adult + data.kid + data.infant <= 0) log.warn('Model', 'Reservation-constructor', 'total summation number of adult, kid, infant is 0');
        const currentDate = Reservation.getGlobalDate();
        this.sqlData = Reservation.generatePostgreSQLObject(data, currentDate);
        this.fbData =  Reservation.generateFirebaseObject(data);
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
            writer : data.writer || data.agency,
            product : {
                id : data.productData.id,
                name : data.productData.name,
                alias : data.productData.alias,
                category : data.productData.category,
                area : data.productData.area,
                geos : this.locationPreprocess(data.productData.geos),
                bus : data.productData.bus
            },
            agency : data.agency || '',
            agency_code : data.agency_code || '',
            name : data.name || '',
            nationality : (data.nationality || 'unknown').toUpperCase(),
            tour_date : data.date,
            pickup : {
                place : data.pickup || '',
                location : data.pickupData
            },
            options : data.options || [],
            adult : this.peopleNumberPreprocess(data.adult),
            kid : this.peopleNumberPreprocess(data.kid),
            infant : this.peopleNumberPreprocess(data.infant),
            phone : this.phoneNumberPreprocess(data.phone),
            email : data.email || '',
            messenger : data.messenger || '',
            guide_memo : data.guide_memo || '',
            operation_memo : data.operation_memo || '',
            memo_history : [],
            canceled : data.canceled || false,
            modified_date : currentDate,
            timezone : data.timezone || 'UTC+9',
            language : data.language,
            star : false,
            team_id : data.team_id
        };
        if (!!data.operation_memo) {
            if (data.operation_memo.match('중국어')) result.language = 'CHINESE';
        }
        if (data.requestType === 'POST') {result.created_date = currentDate } 
        else { result.created_date = data.reservation_created_date }
        if (data.memo_history) {result.memo_history = data.memo_history;}
        if (!!result.operation_memo) {
            result.memo_history.push({
                writer : result.writer,
                memo : result.operation_memo,
                date : result.created_date
            })
        }
        result.total = result.adult + result.kid + result.infant;
        return result;
    }

    /**
     * Generate data for postgreSQL.
     * @param data {Object} Reservation data
     * @param currentDate {String} Time information without timezone information which is made in server.
     * @returns {Object}
     */
    static generatePostgreSQLObject(data, currentDate) {
        const result = {
            message_id: data.message_id,
            writer : data.writer || data.agency,
            product_id : data.productData.id,
            agency : data.agency,
            agency_code : data.agency_code,
            tour_date : data.date,
            options : data.options || {},
            adult : this.peopleNumberPreprocess(data.adult),
            kid : this.peopleNumberPreprocess(data.kid),
            infant : this.peopleNumberPreprocess(data.infant),
            nationality : (data.nationality || 'unknown').toUpperCase(),
            canceled : data.canceled,
            modified_date : currentDate,
        };
        if (!!data.reservation_id) { result.id = data.reservation_id }
        if (!!data.operation_memo) {
            if (!!data.operation_memo.match('중국어')) result.language = 'CHINESE';
        }
        if (data.requestType === 'POST') { result.created_date = currentDate }
        else {result.created_date = data.reservation_created_date}
        return result;
    }

    static generateFirebaseObject(data) {
        const result = {
            id : data.reservation_id,
            name : data.name || '',
            nationality : (data.nationality || 'unknown').toUpperCase(),
            agency : data.agency || '',
            agency_code : data.agency_code || '',
            writer : data.writer || '',
            pickup : data.pickup || '',
            adult : this.peopleNumberPreprocess(data.adult),
            kid : this.peopleNumberPreprocess(data.kid),
            infant : this.peopleNumberPreprocess(data.infant),
            options : data.options || [],
            phone : data.phone || '',
            email : data.email || '',
            messenger : data.messenger || '',
            guide_memo : data.guide_memo || '',
            operation_memo : data.operation_memo || '',
            g : data.g || false,
            o : data.o || false,
            language : data.language || 'English'
        };
        if (!!data.operation_memo.match('중국어')) result.language = 'CHINESE';
        return result;
    }

    static getGlobalDate() {
        // return new Date().toISOString().slice(0,-2);
        return new Date(new Date() - ((validation.TIME_OFFSET_MAP['UTC+9']) * 60000)).toISOString().slice(0,-2);
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
                lat : Number(temp.location.lat) ? Number(temp.location.lat) : 35.4,
                lon : Number(temp.location.lon) ? Number(temp.location.lon) : 127.58
            }
        }
    }

    static peopleNumberPreprocess(numPeople) {
        const result = Number(numPeople);
        if (!result || isNaN(result)) return 0;
        return result;
    }

    static phoneNumberPreprocess(phone) {
        if (!phone || typeof phone !== 'string') return '';
        let result = phone.trim();
        if (phone.charAt(0) === "0") result = phone.slice(1, phone.length);
        if (phone.charAt(0) !== "+") result = "+" + result;
        return result;
    }

    static pickupPlaceFinder(data){
        return new Promise((resolve, reject) => {
            fbDB.ref('geos').once('value', (snapshot) => {
                const geos = snapshot.val();
                if (!geos) resolve({lat:0.00,lon:0.00});
                else {
                    Object.keys(geos.areas).forEach(key => {
                        geos.areas[key].pickups.forEach(area => {
                            if (area.name === data.pickup) resolve(area.location);
                            area.incoming.forEach(incoming => {
                                if (incoming === data.pickup) resolve(area.location);
                            });
                        })
                    });
                    resolve({lat:0.00,lon:0.00});
                }
            })
        })
    }

    /**
     * Validation for updating reservation before delete / insert data from / to databases.
     * @param reservation {Object} reservation object
     * @returns {PromiseLike<T | never> | Promise<T | never>}
     */
    static async validationUpdate(reservation) {
        const val = await validation.validReservationUpdateCheck(reservation);
        if (!val.result) log.warn('Model', 'Reservation - validationUpdate', `reservation update validation failed. detail : ${JSON.stringify(val.detail)}`);
        else log.debug('Model', 'Reservation - validationUpdate', `reservation update validation success`);
        return val;
    }

    /**
     * Validation for creating reservation before insert data to databases.
     * @param reservation {Object} reservation object
     * @returns {PromiseLike<T | never> | Promise<T | never>}
     */
    static async validationCreate(reservation) {
        const val = await validation.validReservationCreateCheck(reservation);
        if (!val.result) log.warn('Model', 'Reservation - validationCreate', `reservation create validation failed. detail : ${JSON.stringify(val.detail)}`);
        else log.debug('Model', 'Reservation - validationCreate', `reservation create validation success`);
        return val;
    }

    /**
     * insert data to postgreSQL
     * @param reservation {Object} reservation object
     * @param testObj {Object} only for test purpose. "isTest" : flag for test, "fail" : flag that one of the functions should fail, "detail" : detailed object for fail function information
     * @returns {Promise<any>}
     */
    static insertSQL(reservation, testObj) {
        return new Promise((resolve, reject)=> {
            if (testObj.isTest && testObj.fail && testObj.target === 'reservation' && testObj.detail.insertSQL) resolve(false);
            const text = reservationQueryProcessing(reservation, 'create');
            const query = `INSERT INTO reservation (${text.keys}) VALUES (${text.values}) RETURNING *`;
            sqlDB.query(query, (err, result) => {
                if (err) {
                    log.warn('Model', 'Reservation-insertSQL', `data insert to SQL failed : ${reservation.id}`);
                    resolve(false);
                }
                log.debug('Model','Reservation-insertSQL', `${ result.rows[0].id = 'r' + result.rows[0]._id} data insert to SQL success`);
                result.rows[0].id = 'r' + result.rows[0]._id;
                resolve(result.rows[0]);
            });
        });
    }

    /**
     * Delete reservation from postgreSQL due to FB / Elastic database failure.
     * @param reservation_id {String} reservation id to be deleted.
     * @param testObj {Object} only for test purpose. "isTest" : flag for test, "fail" : flag that one of the functions should fail, "detail" : detailed object for fail function information
     * @returns {Promise<any>}
     */
    static deleteSQL(reservation_id, testObj) {
        return new Promise((resolve, reject) => {
            if (testObj.isTest && testObj.fail && testObj.target === 'reservation' && testObj.detail.deleteSQL) resolve(false);
            const query = `DELETE FROM reservation WHERE id = '${reservation_id}' RETURNING *`;
            sqlDB.query(query, (err, result) => {
                if (err) {
                    log.warn('Model', 'Reservation-deleteSQL', 'delete reservation from SQL failed');
                    resolve(false);
                }
                log.debug('Model','Reservation-deleteSQL', 'data delete from SQL success')
                resolve(result.rows[0]);
            })
        });
    }

    static getSQL(reservation_id) {
        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM reservation WHERE id = '${reservation_id}'`;
            sqlDB.query(query, (err, result) => {
                if (err) {
                    log.warn('Model', 'Reservation-getSQL', 'get reservation from SQL failed');
                    resolve(false);
                }
                log.debug('Model','Reservation-getSQL', 'get data from SQL success')
                resolve(result.rows[0]);
            });
        });
    }

    /**
     * Update postgreSQL only changes "canceled" column to true.
     * @param reservation_id {String} reservation id
     * @param testObj {Object} only for test purpose. "isTest" : flag for test, "fail" : flag that one of the functions should fail, "detail" : detailed object for fail function information
     * @returns {Promise<any>}
     */
    static cancelSQL(reservation_id, testObj) {
        return new Promise((resolve, reject) => {
            if (testObj.isTest && testObj.fail && testObj.target === 'reservation' && testObj.detail.cancelSQL) resolve(false);
            const query = `UPDATE reservation SET canceled = true, modified_date = '${Reservation.getGlobalDate()}' WHERE id = '${reservation_id}' RETURNING *`;
            sqlDB.query(query, (err, result) => {
                if (err) {
                    log.warn('Model', 'Reservation-cancelSQL', `data update from SQL failed - make "cancel" column to TRUE. query : ${query}`);
                    resolve(false);
                } else {
                    log.debug('Model', 'Reservation-cancelSQL', 'data update from SQL success - make "cancel" column to TRUE');
                    resolve(result.rows[0]);
                }
            });
        });
    }

    /**
     * only for router test purpose.
     * @param reservation_id {String} reservation id
     */
    static undoCancelSQL(reservation_id) {
        return new Promise((resolve, reject) => {
           sqlDB.query(`UPDATE reservation SET canceled = false WHERE id = '${reservation_id}' RETURNING *`, (err, result) => {
               if (err) resolve(false);
               if (result.rows[0]) {
                   console.log(`undoCancelSQL - ${reservation_id} result : success`)
                   resolve(true);
               }
           })
        });
    }

    /**
     * check if reservation is canceled
     * @param reservation_id {String} reservation id ex) r1199
     * @param testObj {Object} only for test purpose. "isTest" : flag for test, "fail" : flag that one of the functions should fail, "detail" : detailed object for fail function information
     * @returns {Promise<any>}
     */
    static checkSQLcanceled(reservation_id, testObj) {
        return new Promise((resolve, reject) => {
            if (testObj.isTest && testObj.fail && testObj.target === 'reservation' && testObj.detail.checkSQLcanceled) resolve(false);
            const query = `SELECT canceled from reservation where id = '${reservation_id}'`;
            sqlDB.query(query, (err, result) => {
                if (err || !result.rows) {
                    log.warn('Model', 'Reservation-checkSQLcanceled', 'get "canceled" information from SQL failed');
                    resolve(false);
                }
                const tempResult = result.rows[0].canceled;
                if (typeof tempResult === 'boolean' && !!tempResult) {
                    log.warn('Router', 'Reservation-checkSQLcanceled', `reservation ${reservation_id} is already canceled in SQL!`);
                    resolve(false);
                }
                log.debug('Router', 'Reservation-checkSQLcanceled', `reservation ${reservation_id} is not canceled yet`);
                resolve(true);
            });
        });
    }

    /**
     * make new Team for operation of Firebase.
     * @param reservation {Object} reservation object
     * @param data {Object} tongjjabaegi object from Clinet server or BOT.
     * @returns {Promise<any>}
     */
    static newTeamBuild(reservation, data){
        return new Promise((resolve, reject) => {
            const team = new Team();
            team.reservations[reservation.id] = reservation;
            fbDB.ref('operation').child(data.date).child(data.productData.id).child('teams').push(team, err => {
                if (err) {
                    log.warn('Model', 'newTeamBuild', `operation team push failed`);
                    resolve(false);
                }
            }).then(result => {
                log.debug('Model', 'newTeamBuild', `new team build for reservation id ${reservation.id} success`);
                let path = result.path.pieces_;
                data.operation = path[1] + '/' + path[2] + '/' + path[4] + '/' + reservation.id;
                data.team_id = path[4];
                fbDB.ref('operation').child(data.date).child(data.productData.id).child('teams').child(path[4])
                    .update({id:path[4]}).then(() => {resolve(data);})
            });
        })
    }

    /**
     * team building function when teamId does not have any reservation.
     * @param reservation {Object} reservation obeject
     * @param data {Object} overall data
     * @param teamId {String} team id
     */
    static async emptyTeamRebuild(reservation, data, teamId) {
        const reservationObj = {};
        reservationObj[reservation.id] = reservation;
        const result = await fbDB.ref('operation').child(data.date).child(data.productData.id).child('teams').child(teamId).update({reservations:reservationObj});
        data.operation = data.date + '/' + data.productData.id + '/'+ teamId + '/' + reservation.id;
        data.team_id = teamId;
        return data;
    }

    /**
     * team building function when product is not private and
     * total people number of reservation is smaller than maximum people number of bus.
     * @param reservation {Object} reservation object
     * @param data {Object} tongjjabaegi object from Clinet server or BOT.
     * @param operation {Object} operation data from firebase. starts with team data.
     * @returns {Promise<any>}
     */
    static regularTeamBuild(reservation, data, operation) {
        let peopleCount;
        let tempReservation;
        const reservedPeopleNumber = Number(reservation.adult) + Number(reservation.kid) + Number(reservation.infant);
        return new Promise((resolve, reject) => {
            if (!operation.teams) {
                log.debug('Model', 'regularTeamBuild', `no teams in operation --> newTeamBuild : ${reservation.id}`);
                resolve(this.newTeamBuild(reservation, data));
            }
            for (let teamId in operation.teams) {
                peopleCount = 0;
                if (!operation.teams[teamId].reservations) {
                    resolve(this.emptyTeamRebuild(reservation, data, teamId));
                }
                for (let r_id in operation.teams[teamId].reservations) {
                    tempReservation = operation.teams[teamId].reservations[r_id];
                    peopleCount += Number(tempReservation.adult) + Number(tempReservation.kid) + Number(tempReservation.infant);
                }
                if (peopleCount + reservedPeopleNumber <= BUS_PEOPLE_MAX_NUMBER) {
                    log.debug('Model', 'regularTeamBuild', `reservation ${reservation.id} is added to the teams : ${teamId}`);
                    return fbDB.ref('operation').child(data.date).child(data.productData.id)
                        .child('teams').child(teamId).child('reservations').child(reservation.id).update(reservation, err => {
                            if (err) {
                                log.warn('Model', 'regularTeamBuild', `operation reservation push failed`);
                                resolve(false);
                            }
                            data.operation = data.date + '/' + data.productData.id + '/'+ teamId + '/' + reservation.id;
                            data.team_id = teamId;
                            resolve(data);
                        });
                }
            }
            log.debug('Model', 'regularTeamBuild', `reservation ${reservation.id} will be added after newTeamBuild`);
            resolve(this.newTeamBuild(reservation, data));
        })
    }

    static bigTeamBuild(reservation, data) {
        let promiseArr = [];
        return new Promise((resolve ,reject) => {
            let subPeopleObj = Reservation.peopleDistribute(reservation.id, reservation.adult, reservation.kid, reservation.infant, {}, 1);
            Object.keys(subPeopleObj).forEach(key => {
                let tempReservation = reservation;
                tempReservation.id = key;
                tempReservation.adult = subPeopleObj[key].adult;
                tempReservation.kid = subPeopleObj[key].kid;
                tempReservation.infant = subPeopleObj[key].infant;
                let team = new Team();
                team.reservations[key] = tempReservation;
                promiseArr.push(this.bigTeamBuildPromiseArray(data, team, tempReservation.id));
            });
            // todo : bus name, cost, size should be updated in team information later!
            // todo : guide id / name should be updated in team information later!
            Promise.all(promiseArr).then(result => {
                if (result.includes(false)) {
                    log.warn('Model', 'regularTeamBuild', `BIG reservation insert failed : ${result}`);
                    resolve(false);
                }
                data.operation = result.map(data => data[0]);
                data.teamIdArr= result.map(data => data[1]);
                log.debug('Model', 'regularTeamBuild', `BIG reservation success`);
                resolve(data);
            });
        })
    }

    /**
     * build promise array for big team insert to firebase
     * @param data {Object} raw data from router
     * @param team {Object} team object
     * @param reservationId {String} reservation ID for big team.
     * @returns {Promise<any>}
     */
    static bigTeamBuildPromiseArray(data, team, reservationId) {
        return new Promise((resolve, reject) => {
            fbDB.ref('operation').child(data.date).child(data.productData.id).child('teams').push(team, err => {
                if (err) {
                    log.warn('Model', 'bigTeamBuildPromiseArray', `BIG reservation insert failed : ${team.reservation}`);
                    resolve(false);
                }
            }).then(result => {
                let path = result.path.pieces_;
                let operation = path[1] + '/' + path[2] + '/' + path[4] + '/' + reservationId;
                resolve([operation, path[4]]);
            });
        })
    }

    /**
     * distribute people to the bus
     * @param id {String} reservation id
     * @param adult {Number} number of adult
     * @param kid {Number} number of kid
     * @param infant {Number} number of infant
     * @param obj {Object} result object
     * @param count {Number} counter for subReservation naming
     * @returns {*}
     */
    static peopleDistribute(id, adult, kid, infant, obj, count) {
        let curPeople = (adult + kid + infant);
        if (curPeople > BUS_PEOPLE_MAX_NUMBER) {
            if (adult >= BUS_PEOPLE_MAX_NUMBER) {
                obj[`${id}-${count}`] = {adult:BUS_PEOPLE_MAX_NUMBER, kid:0, infant:0};
                return this.peopleDistribute(id, adult - BUS_PEOPLE_MAX_NUMBER, kid, infant, obj, count + 1);
            } else if (kid >= BUS_PEOPLE_MAX_NUMBER) {
                obj[`${id}-${count}`] = {adult:0, kid:BUS_PEOPLE_MAX_NUMBER, infant:0};
                return this.peopleDistribute(id, adult, kid - BUS_PEOPLE_MAX_NUMBER, infant, obj, count + 1);
            } else if (infant >= BUS_PEOPLE_MAX_NUMBER) {
                obj[`${id}-${count}`] = {adult:0, kid:0, infant:BUS_PEOPLE_MAX_NUMBER};
                return this.peopleDistribute(id, adult, kid, infant - BUS_PEOPLE_MAX_NUMBER, obj, count + 1);
            } else {
                obj[`${id}-${count}`] = {adult:parseInt(adult / 2) , kid:parseInt(kid / 2), infant : parseInt(infant / 2)};
                return this.peopleDistribute(id, adult - parseInt( adult / 2), kid - parseInt( kid / 2), infant - parseInt( infant / 2), obj, count + 1);
            }
        } else {
            obj[`${id}-${count}`] = {adult:adult, kid : kid, infant : infant};
            return obj;
        }
    }

    /**
     * Insert data to Firebase.
     * returns data with path of firebase where data had been stored.
     * @param reservation {Object} new reservation object
     * @param data {Object} tongjjabaegi data from Client server or BOT.
     * @param testObj {Object} only for test purpose. "isTest" : flag for test, "fail" : flag that one of the functions should fail, "detail" : detailed object for fail function information.
     */
    static insertFB(reservation, data, testObj) {
        return new Promise((resolve, reject) => {
            if (testObj.isTest && testObj.fail && testObj.target === 'reservation' && testObj.detail.insertFB) resolve(false);
            const reservedPeopleNumber = reservation.adult + reservation.kid + reservation.infant;
            fbDB.ref('operation').child(data.date).child(data.productData.id).once('value', (snapshot) => {
                const operation = snapshot.val();
                if (!operation) {
                    log.debug('Model', 'Reservation-insertFB', `no matching operation in firebase --> newTeamBuild : ${reservation.id}`);
                    resolve(this.newTeamBuild(reservation, data));
                } else if (data.productData.name.match(/private/i)) {
                    log.debug('Model', 'Reservation-insertFB', `private tour --> newTeamBuild : ${reservation.id}`);
                    resolve(this.newTeamBuild(reservation, data));
                } else if (reservedPeopleNumber > BUS_PEOPLE_MAX_NUMBER) {
                    log.debug('Model','Reservation-insertFB', `bigTeamBuild : ${reservation.id}`);
                    resolve(this.bigTeamBuild(reservation, data))
                } else {
                    log.debug('Model', 'Reservation-insertFB', `regularTeamBuild : ${reservation.id}`);
                    resolve(this.regularTeamBuild(reservation, data, operation));
                }
            });
        });
    }

    static insertFBforConvert(reservation, date) {
        return new Promise((resolve, reject) => {
            fbDB.ref('operation').child(date).update(reservation, err => {
                if (err) {
                    console.log('insertFBforConvert error : ', date);
                    resolve(false);
                }
                resolve(true);
            })
        })
    }
    
    static findFbObj(date, product_id, team_id, reservation_id) {
        return new Promise((resolve, reject) => {
            fbDB.ref('operation').child(date).child(product_id).child('teams').child(team_id).child('reservations').child(reservation_id).once('value', (snapshot) => {
                resolve(snapshot.val());
            })
        })
    }
    
    static findFBTeamId(date, product_id, reservation_id) {
        return new Promise((resolve, reject) => {
            fbDB.ref('operation').child(date).child(product_id).child('teams').once('value', (snapshot) => {
                let data = snapshot.val();
                Object.keys(data).forEach(team_id => {
                    Object.keys(data[team_id].reservations).forEach(r_id => {
                        if (r_id === reservation_id) resolve({reservation : data[team_id].reservations[r_id], team_id : team_id});
                    });
                });
                resolve(false);
            });
        })
    }

    /**
     * cancel FB : delete previous data in firebase.
     * for Regular reservation & New team reservation case, type of data.operation is 'string'
     * for Big reservation case, type of data.operation is 'object'
     * @param reservation {Object} reservation object
     * @param data {Object} tonjjabaegi data from Clinet server of BOT.
     * @param testObj {Object} only for test purpose. "isTest" : flag for test, "fail" : flag that one of the functions should fail, "detail" : detailed object for fail function information
     * @returns {*}
     */
    static async deleteFB(reservation, data, testObj) {
        if (testObj.isTest && testObj.fail && testObj.target === 'reservation' && testObj.detail.deleteFB) return false;
        if (typeof data.operation === 'string') {
            const operationArr = data.operation.split('/');
            const date = operationArr[0],
                productId = operationArr[1],
                teamId = operationArr[2],
                reservationId = operationArr[3] || reservation.id;
            return await this.fbDeleteProcess(date, productId, teamId, reservationId);
        } else {
            const promiseArr = [];
            data.operation.forEach(operation => {
                const operationArr = operation.split('/');
                const date = operationArr[0],
                    productId = operationArr[1],
                    teamId = operationArr[2],
                    reservationId = operationArr[3] || reservation.id;
                promiseArr.push(this.fbDeleteProcess(date, productId, teamId, reservationId));
            });
            return Promise.all(promiseArr).then(result => {
                if (result.includes(false)) {
                    log.warn('Model', 'deleteFB - bigTeamReservation', `firebase reservation delete failed! ${reservation.id}. result : ${result}`);
                    return false;
                }
                log.debug('Model', 'deleteFB - bigTeamReservation', `all of firebase reservation delete success! number of deleted reservation : ${result.length}`);
                return true;
            })
        }
    }

    static fbDeleteProcess(date, productId, teamId, reservationId) {
        return new Promise((resolve, reject) => {
            fbDB.ref('operation').child(date).child(productId).child('teams').child(teamId)
                .child('reservations').child(reservationId).remove(err => {
                if (err) {
                    log.warn('Model', 'Reservation-deleteFB', `delete reservation from FB failed : ${reservationId}`);
                    resolve(false);
                } else {
                    log.debug('Model', 'Reservation-deleteFB', `delete reservation from FB success : ${reservationId}`);
                    resolve(true);
                }
            });
        });
    }

    /**
     * Insert data to Elastic search
     * @param reservation {Object} reservation object
     * @param testObj {Object} only for test purpose. "isTest" : flag for test, "fail" : flag that one of the functions should fail, "detail" : detailed object for fail function information
     * @returns {Promise<boolean>}
     */
    static insertElastic(reservation, testObj) {
        return new Promise((resolve, reject)=> {
            if (testObj.isTest && testObj.fail && testObj.target === 'reservation' && testObj.detail.insertElastic) resolve(false);
            if (reservation._id) delete reservation._id;
            elasticDB.create({
                index : 'reservation',
                type : '_doc',
                id : reservation.id,
                body: reservation
            },(err, resp) => {
                if (err) {
                    log.warn('Model', 'Reservation-insertElastic', `insert into Elastic failed : ${reservation.id}`);
                    console.log('error : ', JSON.stringify(err))
                    resolve(false);
                } else {
                    log.debug('Model', 'Reservation-cancelElastic', `insert to Elastic success : ${reservation.id}`);
                    resolve(true);
                }
            });
        });
    }

    /**
     * cancel Elastic : only change "canceled" column to true.
     * @param reservation_id {String} reservation id
     * @param testObj {Object} only for test purpose. "isTest" : flag for test, "fail" : flag that one of the functions should fail, "detail" : detailed object for fail function information
     * @returns {Promise<boolean>}
     */
    static cancelElastic(reservation_id, testObj) {
        return new Promise((resolve, reject) => {
            if (testObj.isTest && testObj.fail && testObj.target === 'reservation' && testObj.detail.cancelElastic) resolve(false);
            elasticDB.update({
                index : 'reservation',
                type : '_doc',
                id : reservation_id,
                body : {
                    doc : {
                        canceled : true,
                        modified_date : Reservation.getGlobalDate()
                    }
                }
            }, (err, resp) => {
                if (err) {
                    log.warn('Model', 'Reservation-cancelElastic', `update from Elastic failed : ${reservation_id}`);
                    resolve(false);
                } else {
                    log.debug('Model', 'Reservation-cancelElastic', `update from Elastic success : ${reservation_id}`);
                    resolve(true);
                }
            });
        });
    }

    /**
     * only for router test purpose.
     * @param reservation_id {String} reservation id
     * @returns {Promise<any>}
     */
    static undoCancelElastic(reservation_id) {
        return new Promise((resolve, reject) => {
            elasticDB.update({
                index : 'reservation',
                type : '_doc',
                id : reservation_id,
                body : {
                    doc : {
                        canceled : false
                    }
                }
            }, (err, resp) => {
                if (err) resolve(false);
                if (!!resp) {
                    console.log(`undoCancelElastic - ${reservation_id} result : success`)
                    resolve(true);
                }
            });
        })
    }

    /**
     * delete Elastic data
     * @param reservation_id {String} reservation id
     * @param testObj {Object} only for test purpose. "isTest" : flag for test, "fail" : flag that one of the functions should fail, "detail" : detailed object for fail function information
     * @returns {*}
     */
    static deleteElastic(reservation_id, testObj) {
        if (testObj.isTest && testObj.fail && testObj.target === 'reservation' && testObj.detail.deleteElastic) return Promise.resolve(false);
        return new Promise((resolve, reject) => {
            elasticDB.delete({
                index : 'reservation',
                type : '_doc',
                id : reservation_id,
            }, (err, resp) => {
                if (err) {
                    log.warn('Model', 'Reservation-deleteElastic', `delete from Elastic failed : ${reservation_id}`);
                    resolve(false);
                }
                log.debug('Model', 'Reservation-deleteElastic', `delete from Elastic success : ${reservation_id}`);
                resolve(true);
            })
        })
    }

    /**
     * search data from Elasticsearch and return corresponding data
     * ex) {'product.name':'태감오해'}, {'nationality':'HONG KONG'}
     * @param query {Object} query for searching data. key of query must be string.
     * @returns {Promise<any>}
     */
    static searchElastic(query) {
        const result = [];
        return new Promise((resolve, reject) => {
            elasticDB.search({
                index:'reservation',
                type:'_doc',
                body:{
                    query : { match : JSON.parse(JSON.stringify(query)) }
                }
            }, (err, resp) => {
                if (err || resp.timed_out) {
                    log.warn('Model', 'Reservation-searchElastic', `query from Elastic failed : ${query}`);
                    throw new Error(`Failed : searchElastic : ${JSON.stringify(err)}`);
                }
                if (resp._shards.successful <= 0) resolve(result);
                resp.hits.hits.forEach(item => {
                    result.push(item._source);
                });
                resolve(result);
            });
        })
    }
}

function reservationQueryProcessing(object, type) {
    let tempKeys = "";
    let tempValues = "";
    let tempUpdateResult = "";
    let value;
    Object.keys(object).forEach(key => {
        value = object[key];
        if (RESERVATION_KEY_MAP.includes(key) && key !== 'id') {
            if (type === 'create') {
                if (typeof value === 'object') { tempValues += "'" + JSON.stringify(value) + "'" + ", "}
                else if (typeof value === 'number') {tempValues += value + ", "}
                else if (typeof value === 'boolean' || key === 'canceled') { tempValues += Boolean(value) + ", "}
                else { tempValues += "'" + value + "'" + ", "}
                tempKeys += key + ", ";
            } else if (type === 'update') {
                tempUpdateResult += key + " = ";
                if (typeof value === 'object') { tempUpdateResult += "'" + JSON.stringify(value) + "'" + ","}
                else if (typeof value === 'number') { tempUpdateResult += value + ", "}
                else if (typeof value === 'boolean' || key === 'canceled') { tempUpdateResult += Boolean(value) + ", "}
                else { tempUpdateResult += "'" + value + "'" + ", "}
            }
        }
    });
    if (type === 'create') return {keys: tempKeys.slice(0, -2), values: tempValues.slice(0, -2)};
    else if (type === 'update') return tempUpdateResult.slice(0,-2);
}
// Reservation.searchElastic({language:'CHINESE'}).then(result => console.log(result))
// Reservation.findFB('2019-07-09','p356', 'r38464').then(result => console.log('result : ',result))

module.exports = Reservation;