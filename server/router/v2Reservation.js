const sqlDB = require('../auth/postgresql');
const fbDB = require('../auth/firebase').database;
const Reservation = require('../models/reservation');
const Product = require('../models/product');
const Pickup = require('../models/pickups');
const accountRouter = require('./v2Account');
const log = require('../../log');
const env = require('../../package.json').env;
sqlDB.connect();

exports.post = (req, res) => {
    if (!req.get('Content-Type')) return res.status(400).json({message:"Content-Type should be json", task:{}});
    postRouterHandler(req, res)
        .catch(err => {
            log.error('Router', 'RESERVATION export-POST', `unhandled error occurred! error : ${err}`);
            res.status(500).send('unhandled RESERVATION POST error')
        });
};

exports.delete = (req, res) => {
    if (!req.get('Content-Type')) return res.status(400).json("Content-Type should be json");
    deleteRouterHandler(req, res)
        .catch(err => {
            log.error('Router', 'RESERVATION export-UPDATE', `unhandled error occurred! error : ${err}`);
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
function postRouterHandler(req, res) {
    let data = req.body;
    let testObj;
    if (req.body.hasOwnProperty('testObj')) testObj = req.body.testObj;
    else testObj = testManager(req, env);
    if (!data.message_id) data.message_id = "NM-" + new Date().getTime();
    data.requestType = 'POST';
    data.reservationResult = false;
    let reservation;
    let reservationTask = {type : 'CREATE', pickupDataFound : false, priceGroupFound : false, validation : false, validationDetail : {}};
    return Pickup.getPickup(data.pickup)
        .then(pickupData => {
            data.pickupData = pickupData;
            reservationTask.pickupDataFound = true;
            return Product.productDataExtractFromFB(data)})
        .then(productData => {
            if (!productData) {
                log.warn('Router', 'reservationHandler', `productData load failed. product : ${data.product}`)
                return {
                    result : false,
                    type: 'POST',
                    reservationResult : false,
                    reservationTask : reservationTask,
                    detail : ''
                };
            } else {
                reservationTask.priceGroupFound = true;
                data.productData = productData;
                log.debug('Router', 'reservationHandler', `productData load success. product id : ${productData.id}`);
                reservation = new Reservation(data);
                return Reservation.validationCreate(reservation)
            }})
        .then(validCheck => {
            if (!validCheck.result) {
                const tempResult = {type:'POST', reservationResult:false, reservationTask:reservationTask};
                tempResult.reservationTask.validationDetail = validCheck.detail;
                return tempResult;}
            else {
                return createReservation(reservation, data, testObj)
            }})
        .then(resultData => {
            if (!resultData.reservationResult) return res.status(500).json({
                message:'reservationHandler failed',
                reservationTask:resultData.reservationTask
            });
            req.body = resultData;
            log.debug('Router', 'v2Reservation', 'all task done successfully [POST]. goto v2Account router');
            return accountRouter.post(req, res);
        });
}

/**
 * Reservation create function and insert to SQL, FB, EL
 * if FB insert fail, SQL data will be canceled.
 * if EL insert fail, SQL data will be canceled and FB data will be deleted.
 * @param reservation {Object} reservation object
 * @param data {Object} raw requested data
 * @param testObj {Object} only for test purpose. "isTest" : flag for test, "fail" : flag that one of the functions should fail, "detail" : detailed object for fail function information
 * @returns {Promise<any>}
 */
function createReservation(reservation, data, testObj) {
    let task = {type:'CREATE', router:'reservation', validation:true, insertSQL:false, insertFB:false, insertElastic:false, deleteFB:false, deleteSQL:false};
    return Reservation.insertSQL(reservation.sqlData, testObj)
        .then(result => {
            if (!result) return false;
            task.insertSQL = true;
            log.debug('Router', 'createReservation', `insertSQL success! reservation id : ${result.id}`);
            data.reservation_id = result.id;
            reservation.fbData.id = result.id;
            reservation.sqlData.id = result.id;
            reservation.elasticData.id = result.id;
            return Reservation.insertFB(reservation.fbData, data, testObj)})
        .then(resultData => {
            if (!resultData) return false;
            data = resultData;
            if (data.teamIdArr) {reservation.elasticData.team_id = data.teamIdArr[0];} 
            else {reservation.elasticData.team_id = data.team_id;}
            task.insertFB = true;
            return Reservation.insertElastic(reservation.elasticData, testObj)})
        .then(result => {
            data.reservationTask = task;
            if (!result) {
                return failureManager(reservation, data, task, 'POST', testObj).then(failureTask => {
                    data.reservationTask = failureTask;
                    return data;
                });
            }
            data.reservationTask.insertElastic = true;
            data.reservationResult = true;
            log.debug('Router', 'createReservation', `all process success!`);
            return data;})
        .catch(err => {
            log.warn('Router', 'createReservation', `createReservation unhandled error. task : ${task}`);
            return err;
        })
}

/**
 * Reservation edit function and update SQL, delete and create EL, FB
 * For next createReservation task, reservation id is deleted in reservation object.
 * if update fail is present for SQL / FB / Elastic, only log will be called because original data will not be modified due to error.
 * @param req {Object} requested object
 * @pram rew {Object} response object
 * @returns {Promise<boolean | never | never>}
 */
function deleteRouterHandler(req, res) {
    const reservation_id = req.body.reservation_id;
    const data = req.body;
    let testObj;
    if (data.hasOwnProperty('testObj')) testObj = data.testObj;
    else testObj = testManager(req, env);
    let task = {type:'UPDATE',router:'reservation', validation:true, checkSQLcanceled:false, cancelSQL:false, cancelElastic:false};
    return Reservation.checkSQLcanceled(reservation_id, testObj)
        .then(result => {
            if (!result) return false;
            task.checkSQLcanceled = true;
            return Reservation.cancelSQL(reservation_id, testObj)})
        .then(result => {
            if (!result) return false;
            task.cancelSQL = true;
            req.body.previous_reservation_id = reservation_id;
            return Reservation.cancelElastic(reservation_id, testObj)})
        .then(result => {
            data.reservationTask = task;
            if (!result) {
                return failureManager(reservation_id, data, task, 'CANCEL_RESERVATION', testObj).then(failureTask => {
                    data.reservationTask = failureTask;
                    return res.status(500).json({
                        message:'reservationHandler failed',
                        reservationTask : data.reservationTask
                    });
                })
            }
            data.reservationTask.cancelElastic = true;
            data.reservationResult = true;
            log.debug('Router', 'Reservation-deleteRouterHandler', 'all process success!');
            req.body = data;
            return accountRouter.delete(req, res);})
        .catch(err => {
            log.warn('Router', 'Reservation-deleteRouterHandler', `Reservation-deleteRouterHandler unhandled error. task : ${task}`);
            return err;
        });
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
    log.debug('Router', 'Reservation - failureManager', `type : ${JSON.stringify(type)}, task : ${JSON.stringify(task)}`)
    if (type === 'POST') {
        if (!task.insertElastic && task.insertFB) {
            return Reservation.deleteFB(reservation.fbData, data, testObj)
                .then(result => {
                    if (!result) return false;
                    task.deleteFB = true;
                    log.debug('Router', 'Reservation-failureManager', `deleteFB success! type : ${type}. task : ${task}`);
                    return Reservation.deleteSQL(reservation.sqlData.id, testObj)})
                .then(result => {
                    if (!result) return task;
                    task.deleteSQL = true;
                    log.debug('Router', 'Reservation-failureManager', `deleteSQL success! type : ${type}. task : ${task}`);
                    return task;
                });
        } else if (!task.insertFB && task.insertSQL) {
            return Reservation.deleteSQL(reservation.sqlData.id, testObj)
                .then(result => {
                    if (!result) return task;
                    task.deleteSQL = true;
                    log.debug('Router', 'Reservation-failureManager', `deleteSQL success! type : ${type}. task : ${task}`);
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