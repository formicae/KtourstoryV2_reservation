const sqlDB = require('../auth/postgresql');
const fbDB = require('../auth/firebase').database;
const Reservation = require('../models/reservation');
const Product = require('../models/product');
const accountRouter = require('./v2Account');
const log = require('../../log');
const env = require('../../package.json').env;
sqlDB.connect();

exports.post = (req, res) => {
    if (!req.get('Content-Type')) return res.status(400).json({message:"Content-Type should be json", task:{}});
    routerHandler(req, res, 'POST')
        .catch(err => {
            log.error('Router', 'RESERVATION export-POST', `unhandled error occurred! error : ${err}`);
            res.status(500).send('unhandled RESERVATION POST error')
        });
};

exports.update = (req, res) => {
    if (!req.get('Content-Type')) return res.status(400).json("Content-Type should be json");
    routerHandler(req, res, 'UPDATE')
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
 * @param requestType {String} POST || UPDATE
 * @returns {Promise<T | never>}
 */
function routerHandler(req, res, requestType) {
    let data = req.body;
    const testObj = testManager(req, env);
    if (!data.message_id) data.message_id = "NM-" + new Date().getTime();
    data.reservationResult = false;
    return Reservation.pickupPlaceFinder(data)
        .then(location => {
            data.pickupData = location;
            return Product.productDataExtractFromFB(data)})
        .then(productData => {
            if (!productData) return {
                type:requestType,
                reservationResult : false,
                reservationTask : {
                    type : requestType === 'POST' ? 'CREATE' : 'UPDATE',
                    validation : false,
                    validationDetail : {tour_date:false}
                }
            };
            data.productData = productData;
            data.requestType = requestType;
            log.debug('Router', 'reservationHandler', `productData load success. product id : ${productData.id}`);
            const reservation = new Reservation(data);
            return reservationHandler(reservation, data, requestType, testObj)})
        .then(resultData => {
            if (!resultData.reservationResult) return res.status(500).json({
                message:'reservationHandler failed',
                reservationTask:resultData.reservationTask
            });
            req.body = resultData;
            if (requestType === 'POST') {
                log.debug('Router', 'v2Reservation', 'all task done successfully [POST]. goto v2Account router');
                return accountRouter.post(req, res);
            } else {
                log.debug('Router', 'v2Reservation', 'all task done successfully [UPDATE]. goto v2Account router');
                return accountRouter.update(req, res);
            }
        });
}

/**
 * Reservation handler for inserting data to SQL, EL, FB
 * @param reservation {Object} reservation
 * @param data {Object} raw requested data
 * @param requestType {String} POST / PUT
 * @param testObj {Object} only for test purpose. "isTest" : flag for test, "fail" : flag that one of the functions should fail, "detail" : detailed object for fail function information
 * @returns {Promise<boolean | never | never>}
 */
function reservationHandler(reservation, data, requestType, testObj) {
    const tempResult = {type:requestType, reservationResult:false, reservationTask:{validation:false}};
    if (requestType === 'POST') { return Reservation.validationCreate(reservation)
        .then(validCheck => {
            if (!validCheck.result) {
                tempResult.reservationTask.type = 'CREATE';
                tempResult.reservationTask.validationDetail = validCheck.detail;
                return tempResult;}
            return createReservation(reservation, data, requestType, testObj)})}
    else { return Reservation.validationUpdate(reservation)
        .then(validCheck => {
            if (!validCheck.result) {
                tempResult.reservationTask.type = 'UPDATE';
                tempResult.reservationTask.validationDetail = validCheck.detail;
                return tempResult;}
            return updateReservation(reservation, data, requestType, testObj)
        })}
}

/**
 * Reservation create function and insert to SQL, FB, EL
 * if FB insert fail, SQL data will be canceled.
 * if EL insert fail, SQL data will be canceled and FB data will be deleted.
 * @param reservation {Object} reservation object
 * @param data {Object} raw requested data
 * @param requestType {String} request type : POST / UPDATE
 * @param testObj {Object} only for test purpose. "isTest" : flag for test, "fail" : flag that one of the functions should fail, "detail" : detailed object for fail function information
 * @returns {Promise<boolean | never>}
 */
function createReservation(reservation, data, requestType, testObj) {
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
                return failureManager(reservation, data, task, requestType, testObj).then(failureTask => {
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
 * @param reservation {Object} reservation
 * @param data {Object} raw requested data
 * @param requestType {String} request type POST / UPDATE
 * @param testObj {Object} only for test purpose. "isTest" : flag for test, "fail" : flag that one of the functions should fail, "detail" : detailed object for fail function information
 * @returns {Promise<boolean | never | never>}
 */
function updateReservation(reservation, data, requestType, testObj) {
    let task = {type:'UPDATE',router:'reservation', validation:true, checkSQLcanceled:false, cancelSQL:false, cancelElastic:false};
    return Reservation.checkSQLcanceled(data.reservation_id, testObj)
        .then(result => {
            if (!result) return false;
            task.checkSQLcanceled = true;
            return Reservation.cancelSQL(data.reservation_id, testObj)})
        .then(result => {
            if (!result) return false;
            task.cancelSQL = true;
            data.previous_reservation_id = data.reservation_id;
            return Reservation.cancelElastic(data.reservation_id, testObj)})
        .then(result => {
            data.reservationTask = task;
            if (!result) {
                return failureManager(reservation, data, task, requestType, testObj).then(failureTask => {
                    data.reservationTask = failureTask;
                    return data;
                })
            }
            data.reservationTask.cancelElastic = true;
            data.reservationResult = true;
            log.debug('Router', 'updateReservation', 'all process success!');
            return data;})
        .catch(err => {
            log.warn('Router', 'updateReservation', `updateReservation unhandled error. task : ${task}`);
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

// pickupPlaceFinder({pickup:'Seomyun'}).then(result=>console.log(result))