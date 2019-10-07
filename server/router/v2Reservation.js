const sqlDB = require('../auth/postgresql');
const fbDB = require('../auth/firebase').database;
const Reservation = require('../models/reservation');
const Product = require('../models/product');
const Pickup = require('../models/pickups');
const Nationality = require('../models/nationality');
const accountRouter = require('./v2Account');
const log = require('../../log');
const env = require('../../package.json').env;
sqlDB.connect();

exports.post = (req, res) => {
    if (!req.get('Content-Type')) {
        log.warn('Router', 'RESERVATION export-POST', 'wrong Content-Type');
        return res.status(400).json({message: "Content-Type should be json"});
    } else if (!req.body.hasOwnProperty('reservationRouterAuth') || !req.body.reservationRouterAuth) {
        log.warn('Router', 'RESERVATION export-POST', 'unAuthorized request');
        return res.status(401).json({message:'reservation router unauthorized!'});
    }
    return postRouterHandler(req, res)
        .catch(err => {
            log.error('Router', 'RESERVATION export-POST', `unhandled error occurred! error`);
            res.status(500).send(`unhandled RESERVATION POST error`)
        });
};

exports.delete = (req, res) => {
    if (!req.get('Content-Type')) {
        log.warn('Router', 'RESERVATION export-DELETE', 'wrong Content-Type');
        return res.status(400).json({message: "Content-Type should be json"});
    } else if (!req.body.hasOwnProperty('reservationRouterAuth') || !req.body.reservationRouterAuth) {
        log.warn('Router', 'RESERVATION export-DELETE', 'unAuthorized request');
        return res.status(401).json({message:'reservation router unauthorized!'});
    }
    return deleteRouterHandler(req, res)
        .catch(err => {
            log.error('Router', 'RESERVATION export-UPDATE', `unhandled error occurred! error`);
            res.status(500).send(`unhandled RESERVATION UPDATE error`)
        });
};

/**
 * router handler for reservation POST / UPDATE.
 * product data is being included in "data" before reservationHandler call.
 * After reservationHandler is finished, account router is being called.
 * @param req {Object} request object from express
 * @param res {Object} response object from express
 * @returns {Promise<T | never>}
 */
async function postRouterHandler(req, res) {
    let data = req.body;
    let testObj;
    if (req.body.hasOwnProperty('testObj')) testObj = req.body.testObj;
    else testObj = testManager(req, env);
    if (!data.message_id) data.message_id = "NM-" + new Date().getTime();
    data.requestType = 'POST';
    data.reservationResult = false;
    let reservationTask = {type : 'CREATE', router:'reservation', pickupDataFound : false, priceGroupFound : false};
    let nationalityData = await Nationality.getNationality(data.nationality);
    if (nationalityData.result) data.nationality = nationalityData.data;
    let pickupData = await Pickup.getPickup(data.pickup);
    data.pickupData = pickupData;
    if (!pickupData) {
        return res.status(400).json(rRRM('POST', data, reservationTask, false, 1));
    } else {
        if (pickupData.hasOwnProperty('pickupPlace')) reservationTask.pickupDataFound = true;
        let productData = await Product.productDataExtractFromFB(data);
        data.productData = productData.priceGroup;
        data.productData.detail = productData.detail;
        if (!productData.result) {
            return res.status(400).json(rRRM('POST', data, reservationTask, false, 2));
        } else {
            reservationTask.priceGroupFound = true;
            log.debug('Router', 'reservationHandler', `productData load success. product id : ${productData.id}`);
            const reservation = new Reservation(data);
            let validCheck = await Reservation.validationCreate(reservation);
            reservationTask.validation = validCheck.result;
            reservationTask.validationDetail = validCheck.detail;
            if (!validCheck.result) {
                return res.status(400).json(rRRM('POST', data, reservationTask, false, 3));
            } else {
                let resultData = await createReservation(res, reservation, data, reservationTask, testObj);
                if (resultData.reservationResult) {
                    req.body = resultData;
                    rRRM('POST', data, resultData.reservationTask, resultData.reservationResult, null);
                    return accountRouter.post(req, res);
                }
            }
        }
    }
}

/**
 * Reservation create function and insert to SQL, FB, EL
 * if FB insert fail, SQL data will be canceled.
 * if EL insert fail, SQL data will be canceled and FB data will be deleted.
 * @param res {Object} response object of express
 * @param reservation {Object} reservation object
 * @param data {Object} raw requested data
 * @param reservationTask {Object} reservation task object
 * @param testObj {Object} only for test purpose. "isTest" : flag for test, "fail" : flag that one of the functions should fail, "detail" : detailed object for fail function information
 * @returns {Promise<Object>}
 */
async function createReservation(res, reservation, data, reservationTask, testObj) {
    Object.entries({insertSQL:false, insertFB:false, insertElastic:false, deleteFB:false, deleteSQL:false})
        .forEach(temp => reservationTask[temp[0]] = temp[1]);
    let sqlReservation = await Reservation.insertSQL(reservation.sqlData, testObj);
    if (!sqlReservation) {
        return res.status(500).json(rRRM('POST', data, reservationTask,false, 4))
    } else {
        reservationTask.insertSQL = true;
        log.debug('Router', 'createReservation', `insertSQL success! reservation id : ${sqlReservation.id}`);
        data.reservation_id = sqlReservation.id;
        reservation.fbData.id = sqlReservation.id;
        reservation.sqlData.id = sqlReservation.id;
        reservation.elasticData.id = sqlReservation.id;
        let firebaseData = await Reservation.insertFB(reservation.fbData, data, testObj);
        if (!firebaseData) {
            let failureTask = await failureManager(reservation, data, reservationTask, 'POST', testObj);
            return res.status(500).json(rRRM('POST', data, failureTask, false, 5));
        } else {
            reservationTask.insertFB = true;
            data = firebaseData;
            if (data.teamIdArr) {reservation.elasticData.team_id = data.teamIdArr[0];}
            else {reservation.elasticData.team_id = data.team_id;}
            let elasticResult = await Reservation.insertElastic(reservation.elasticData, testObj);
            if (!elasticResult) {
                let failureTask = await failureManager(reservation, data, reservationTask, 'POST', testObj);
                return res.status(500).json(rRRM('POST', data, failureTask, false, 6));
            } else {
                reservationTask.insertElastic = true;
                data.reservationResult = true;
                data.reservationTask = reservationTask;
                log.debug('Router', 'createReservation', `all process success!`);
                return data;
            }
        }
    }
}

/**
 * Reservation edit function and update SQL, delete and create EL, FB
 * For next createReservation task, reservation id is deleted in reservation object.
 * if update fail is present for SQL / FB / Elastic, only log will be called because original data will not be modified due to error.
 * @param req {Object} requested object
 * @param res {Object} response object
 * @returns {Promise<boolean | never | never>}
 */
async function deleteRouterHandler(req, res) {
    const reservation_id = req.body.reservation_id;
    const data = req.body;
    let testObj;
    if (data.hasOwnProperty('testObj')) testObj = data.testObj;
    else testObj = testManager(req, env);
    let reservationTask = {type:'UPDATE',router:'reservation', validation:true, checkSQLcanceled:false, cancelSQL:false, cancelElastic:false};
    let notCanceledYet = await Reservation.checkSQLcanceled(reservation_id, testObj);
    if (!notCanceledYet) {
        res.status(400).json(rRRM('DELETE', data, reservationTask, false, 7))
    } else {
        reservationTask.checkSQLcanceled = true;
        let canceledSQLReservation = await Reservation.cancelSQL(reservation_id, testObj);
        if (!canceledSQLReservation) {
            res.status(500).json(rRRM('DELETE', data, reservationTask, false, 8))
        } else {
            req.body.previous_reservation_id = reservation_id;
            let cancelElasticResult = await Reservation.cancelElastic(reservation_id, testObj);
            if (!cancelElasticResult) {
                res.status(500).json(rRRM('DELETE', data, reservationTask, false, 9))
            } else {
                reservationTask.cancelElastic = true;
                data.reservationTask = reservationTask;
                data.reservationResult = true;
                rRRM('DELETE', data, reservationTask, true, null);
                req.body = data;
                return accountRouter.delete(req, res);
            }
        }
    }
}

/**
 * abbreviation description : reservation Router Response Manager
 * @param requestType {String} request type (e.g. POST, DELETE)
 * @param data {Object} reservation raw object
 * @param reservationResult {Boolean} reservation task success boolean
 * @param reservationTask {Object} reservation task object
 * @param errorNumber {Number} error number
 */
function rRRM(requestType, data, reservationTask, reservationResult, errorNumber) {
    let result = {
        type : requestType,
        requester : data.requester,
        reservationResult : reservationResult,
        reservationTask : reservationTask
    };
    if (reservationResult) {
        if (requestType === 'POST') {
            log.debug('Router', 'v2Reservation-postRouterHandler', 'all task done successfully [POST]. goto v2Account router');
        } else {
            log.debug('Router', 'v2Reservation-deleteRouterHandler', 'all task done successfully [DELETE]. goto v2Account router');
        }
    } else {
        result.errorNumber = errorNumber;
        if (errorNumber === 1) {
            log.warn('Router', 'reservationHandler', `errorNumber : ${errorNumber} / pickupData load failed. product : ${JSON.stringify(data.pickupData)}`);
            Object.entries({
                message:'reservationHandler failed in searching pickupData',
                detail : data.pickupData
            }).forEach(temp => result[temp[0]] = temp[1]);
        } else if (errorNumber === 2) {
            log.warn('Router', 'reservationHandler', `errorNumber : ${errorNumber} / productData load failed. product : ${data.product}`);
            Object.entries({
                message : `reservationHandler failed in productData matching. product : ${data.product}}`,
                detail : data.productData.detail
            }).forEach(temp => result[temp[0]] = temp[1]);
        } else if (errorNumber === 3) {
            log.warn('Router', 'reservationHandler', `errorNumber : ${errorNumber} / reservation validation failed in ${requestType}. detail : ${JSON.stringify(reservationTask.validationDetail)}`);
            result.message = `reservationHandler failed in validation in ${requestType}. detail : ${JSON.stringify(reservationTask.validationDetail)}`;
        } else if (errorNumber === 4) {
            log.warn('Router', 'createReservation', `errorNumber : ${errorNumber} / reservation insert into SQL failed. message_id : ${data.message_id}`);
            result.message = `reservation insert into SQL failed. message_id : ${data.message_id}`;
        } else if (errorNumber === 5) {
            log.warn('Router', 'createReservation', `errorNumber : ${errorNumber} / reservation insert into Firebase failed. reservation id : ${data.reservation_id}`);
            result.message = `reservation insert into Firebase failed. reservation id : ${data.reservation_id}`;
        } else if (errorNumber === 6) {
            log.warn('Router', 'createReservation', `errorNumber : ${errorNumber} / reservation insert into Elastic failed. reservation id : ${data.reservation_id}`);
            result.message = `reservation insert into Elastic failed. reservation id : ${data.reservation_id}`;
        } else if (errorNumber === 7) {
            log.warn('Router', 'deleteRouterHandler', `errorNumber : ${errorNumber} / reservation is already canceled. reservation id : ${data.reservation_id}`);
            result.message = `reservation is already canceled. reservation id : ${data.reservation_id}`;
        } else if (errorNumber === 8) {
            log.warn('Router', 'deleteRouterHandler', `errorNumber : ${errorNumber} / SQL reservation cancel failed. reservation id : ${data.reservation_id}`);
            result.message = `SQL reservation cancel failed. reservation id : ${data.reservation_id}`;
        } else if (errorNumber === 9) {
            log.warn('Router', 'deleteRouterHandler', `errorNumber : ${errorNumber} / Elastic reservation cancel failed. reservation id : ${data.reservation_id}`);
            result.message = `Elastic reservation cancel failed. reservation id : ${data.reservation_id}`;
        }
    }
    return result;
}

/**
 * operating process when some of functions failed
 * @param reservation {Object} reservation object
 * @param data {Object} raw requested data
 * @param task {Object} task for Router
 * @param type {String} request type (POST or UPDATE)
 * @param testObj {Object} test object
 * @returns {*}
 */
function failureManager(reservation, data, task, type, testObj) {
    log.debug('Router', 'Reservation - failureManager', `type : ${JSON.stringify(type)}, task : ${JSON.stringify(task)}`);
    if (type === 'POST') {
        if (!task.insertElastic && task.insertFB) {
            return Reservation.deleteFB(reservation.fbData, data, testObj)
                .then(result => {
                    if (!result) return false;
                    task.deleteFB = true;
                    log.debug('Router', 'Reservation-failureManager', `deleteFB success! type : ${type}. task : ${JSON.stringify(task)}`);
                    return Reservation.deleteSQL(reservation.sqlData.id, testObj)})
                .then(result => {
                    if (!result) return task;
                    task.deleteSQL = true;
                    log.debug('Router', 'Reservation-failureManager', `deleteSQL success! type : ${type}. task : ${JSON.stringify(task)}`);
                    return task;
                });
        } else if (!task.insertFB && task.insertSQL) {
            return Reservation.deleteSQL(reservation.sqlData.id, testObj)
                .then(result => {
                    if (!result) return task;
                    task.deleteSQL = true;
                    log.debug('Router', 'Reservation-failureManager', `deleteSQL success! type : ${type}. task : ${JSON.stringify(task)}`);
                    return task;
                });
        } else { return Promise.resolve(task); }
    } else {
        return Promise.resolve(task);
    }
}

/**
 * generate test object for reservation considering product release status
 * @param req {Object} requested object from router
 * @param env {Object} environmental object from package.json
 * @returns {Object}
 */
function testManager(req, env){
    const result = {isTest:false, fail:false, detail:{
            insertSQL:false, deleteSQL:false, cancelSQL:false,
            insertFB:false, deleteFB:false,
            insertElastic:false, cancelElastic:false, deleteElastic:false
        }};
    const obj = req.body.testObj;
    if (!obj || obj.target !== 'reservation') return result;
    result.isTest = true;
    result.fail = obj.fail;
    Object.keys(obj.detail).forEach(key => {
        if (!!result.detail.key) result.detail[key] = obj.detail[key];
    });
    return result;
}