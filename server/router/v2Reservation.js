const sqlDB = require('../auth/postgresql');
const fbDB = require('../auth/firebase').database;
const Reservation = require('../models/reservation');
const Product = require('../models/product');
const accountRouter = require('./v2Account');
const log = require('../../log');
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
 * @returns {PromiseLike<boolean | never>}
 */
function routerHandler(req, res, requestType) {
    let data = req.body;
    data.reservationResult = false;
    return pickupPlaceFinder(data)
        .then(location => {
            data.pickupData = location;
            return productFinder(data)})
        .then(productData => {
            data.productData = productData;
            log.debug('Router', 'reservationHandler', `productData load success. product id : ${productData.id}`);
            const reservation = new Reservation(data);
            return reservationHandler(reservation, data, requestType)})
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

function pickupPlaceFinder(data){
    return new Promise((resolve, reject) => {
        fbDB.ref('v2Geos').once('value', (snapshot) => {
            const geos = snapshot.val();
            Object.keys(geos.areas).forEach(key => {
                geos.areas[key].pickups.forEach(area => {
                    if (area.name === data.pickup) resolve(area.location);
                    area.incoming.forEach(incoming => {
                        if (incoming === data.pickup) resolve(area.location);
                    });
                })
            });
            resolve({lat:0.00,lon:0.00});
        })
    })
}

function productFinder(data) {
    let product;
    let result;
    return Product.getProduct(data.product)
        .then(productData => {
            product = productData;
            productData.sales.forEach(item => { if (item.default) {
                result = {
                    id : product.id,
                    name : item.name,
                    alias : product.alias,
                    category : product.category,
                    area : product.area,
                    geos : product.geos,
                    currency : item.currency,
                    income : incomeCalculation(data, product, item),
                    expenditure : 0
                }}});
            return result;
        })
}

function incomeCalculation(data, product, targetItem) {
    let income = 0;
    targetItem.sales.forEach(priceItem => {
        let price = priceCalculation(priceItem, data);
        income += price;
    });
    if (!!data.options && !!product.options) {
        if (data.options.length > 0 && product.options.length > 0) {
            data.options.forEach(option => {
                product.options.forEach(productOption => {
                    if (productOption.name === option.name) income += productOption.price * option.number;
                });
            });
        }
    }
    return income;
}

function priceCalculation(item, data) {
    if (item.type === 'adult' && !!Number(data.adult)) return Number(item.net * data.adult) || 0;
    else if (item.type === 'adolescent' && !!Number(data.adolescent)) return Number(item.net * data.adolescent) || 0;
    else if (item.type === 'kid' && !!Number(data.kid)) return Number(item.net * data.kid) || 0;
    else if (item.type === 'infant' && !!Number(data.infant)) return Number(item.net * data.infant) || 0;
    else return 0;
}

/**
 * Reservation handler for inserting data to SQL, EL, FB
 * @param reservation {Object} reservation
 * @param data {Object} raw requested data
 * @param requestType {String} POST / PUT
 * @returns {Promise<boolean | never | never>}
 */
function reservationHandler(reservation, data, requestType) {
    const tempResult = {type:requestType, reservationResult:false, reservationTask:{validation:false}};
    if (requestType === 'POST') { return Reservation.validationCreate(reservation)
        .then(validCheck => {
            if (!validCheck.result) {
                tempResult.reservationTask.validationDetail = validCheck.detail;
                return tempResult;}
            return createReservation(reservation, data, requestType)})}
    else { return Reservation.validationUpdate(reservation)
        .then(validCheck => {
            if (!validCheck.result) {
                tempResult.reservationTask.validationDetail = validCheck.detail;
                return tempResult;}
            return updateReservation(reservation, data, requestType)
        })}
}

/**
 * Reservation create function and insert to SQL, FB, EL
 * if FB insert fail, SQL data will be canceled.
 * if EL insert fail, SQL data will be canceled and FB data will be deleted.
 * @param reservation {Object} reservation object
 * @param data {Object} raw requested data
 * @param requestType {String} request type : POST / UPDATE
 * @returns {Promise<boolean | never>}
 */
function createReservation(reservation, data, requestType) {
    let task = {type:'CREATE', router:'reservation', validation:true, insertSQL:false, insertFB:false, insertElastic:false, deleteFB:false, deleteSQL:false};
    return Reservation.insertSQL(reservation.sqlData)
        .then(result => {
            if (!result) return false;
            task.insertSQL = true;
            log.debug('Router', 'createReservation', `insertSQL success! reservation id : ${result.id}`);
            data.reservation_id = result.id;
            reservation.fbData.id = result.id;
            reservation.sqlData.id = result.id;
            reservation.elasticData.id = result.id;
            return Reservation.insertFB(reservation.fbData, data)})
        .then(resultData => {
            if (!resultData) return false;
            data = resultData;
            task.insertFB = true;
            return Reservation.insertElastic(reservation.elasticData)})
        .then(result => {
            data.reservationTask = task;
            if (!result) {
                return failureManager(reservation, data, task, requestType).then(failureTask => {
                    data.reservationTask = failureTask;
                    return data;
                });
            }
            data.reservationTask.insertElastic = true;
            data.reservationResult = true;
            log.debug('Router', 'createReservation', `all process success!`);
            return data;
        })
}

/**
 * Reservation edit function and update SQL, delete and create EL, FB
 * For next createReservation task, reservation id is deleted in reservation object.
 * if update fail is present for SQL / FB / Elastic, only log will be called because original data will not be modified due to error.
 * @param reservation {Object} reservation
 * @param data {Object} raw requested data
 * @param requestType {String} request type POST / UPDATE
 * @returns {Promise<boolean | never | never>}
 */
function updateReservation(reservation, data, requestType) {
    let task = {type:'UPDATE',router:'reservation', validation:true, cancelSQL:false, cancelElastic:false};
    return Reservation.checkSQLcanceled(data.reservation_id)
        .then(result => {
            if (typeof result.canceled === 'boolean' && !!result.canceled) {
                log.warn('Router', 'updateReservation', `reservation ${data.reservation_id} is already canceled in SQL!`);
                task.validation = false;
                task.validationDetail = {canceled:result.canceled, message:'already canceled reservation'};
                return false;
            }
            return Reservation.cancelSQL(data.reservation_id)})
        .then(result => {
            if (!result) return false;
            task.cancelSQL = true;
            data.previous_reservation_id = data.reservation_id;
            return Reservation.cancelElastic(data.reservation_id)})
        .then(result => {
            data.reservationTask = task;
            if (!result) {
                return failureManager(reservation, data, task, requestType).then(failureTask => {
                    data.reservationTask = failureTask;
                    return data;
                })
            }
            data.reservationTask.cancelElastic = true;
            data.reservationResult = true;
            log.debug('Router', 'updateReservation', 'all process success!');
            return data;
        })
}

function failureManager(reservation, data, task, type) {
    log.debug('Router', 'Reservation - failureManager', `type : ${JSON.stringify(type)}, task : ${JSON.stringify(task)}`)
    if (type === 'POST') {
        if (!task.insertElastic && task.insertFB) {
            return Reservation.deleteFB(reservation.fbData, data)
                .then(result => {
                    if (!result) return false;
                    task.deleteFB = true;
                    log.debug('Router', 'Reservation-failureManager', `deleteFB success! type : ${type}. task : ${task}`);
                    return Reservation.deleteSQL(reservation.sqlData.id)})
                .then(result => {
                    if (!result) return task;
                    task.deleteSQL = true;
                    log.debug('Router', 'Reservation-failureManager', `deleteSQL success! type : ${type}. task : ${task}`);
                    return task;
                });
        } else if (!task.insertFB && task.insertSQL) {
            return Reservation.deleteSQL(reservation.sqlData.id)
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