const sqlDB = require('../auth/postgresql');
const fbDB = require('../auth/firebase').database;
const Reservation = require('../models/reservation');
const Product = require('../models/product');
const accountRouter = require('./v2Account');
const log = require('../../log');
sqlDB.connect();

exports.post = (req, res) => {
    if (!req.get('Content-Type')) return res.status(400).send("Content-Type should be json");
    console.log('post request!');
    routerHandler(req, res, 'POST').catch(err => { res.status(500).send(`POST error :${err.message}`)});
};

exports.update = (req, res) => {
    if (!req.get('Content-Type')) return res.status(400).send("Content-Type should be json");
    console.log('update reqeust!');
    routerHandler(req, res, 'UPDATE').catch(err => { res.status(500).send(`POST error :${err.message}`)});
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
    return pickupPlaceFinder(data)
        .then(location => {
            data.pickupData = location;
            return productFinder(data)})
        .then(productData => {
            data.productData = productData;
            log.debug('Router', 'reservationHandler', 'productData load success');
            const reservation = new Reservation(data);
            log.debug('Router','reservationHandler','reservation object had been created without error')
            return reservationHandler(reservation, data, requestType)})
        .then(result => {
            if (!result) throw new Error('reservationHandler failed');
            req.body = result;
            if (requestType === 'POST') return accountRouter.post(req, res);
            else return accountRouter.update(req, res);
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
 * @param action {String} GET / POST / EDIT
 * @returns {Promise<boolean | never | never>}
 */
function reservationHandler(reservation, data, action) {
    if (action === 'POST') { return Reservation.validationCreate(reservation, false)
        .then(validCheck => {
            if (!validCheck) throw new Error(`ValidDataCheck create failed [Reservation - ${action}], [${reservation.mail_id},${reservation.id}]`);
            return createReservation(reservation, data)})}
    else { return Reservation.validationUpdate(reservation, false)
        .then(validCheck => {
            if (!validCheck) throw new Error(`ValidDataCheck update failed [Reservation - ${action}], [${reservation.mail_id},${reservation.id}]`);
            return updateReservation(reservation, data)
        })}
}

/**
 * Reservation create function and insert to SQL, FB, EL
 * if FB insert fail, SQL data will be canceled.
 * if EL insert fail, SQL data will be canceled and FB data will be deleted.
 * @param reservation {Object} reservation object
 * @param data {Object} raw requested data
 * @returns {Promise<boolean | never>}
 */
function createReservation(reservation, data) {
    let task = {insertSQL:false, cancelSQL:false, cancelFB:false, insertFB:false, updateElastic:false, insertElastic:false};
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
        .then(result => {
            if (!result) return false;
            task.insertFB = true;
            return Reservation.insertElastic(reservation.elasticData)})
        .then(result => {
            if (!result) {
                if (!task.insertFB) {
                    return Reservation.cancelSQL(reservation.sqlData).then(result => {
                        if (!result) return false;
                        task.cancelSQL = true;
                        log.debug('Router', 'createReservation', `cancelSQL success! this procedure is done due to insertFB failure. task : ${task}`);
                        return false;
                    });
                } else if (!task.insertElastic) { return Reservation.cancelFB(reservation.fbData, data).then(result => {
                        if (!result) return false;
                        task.cancelFB = true;
                        log.debug('Router', 'createReservation', `cancelFB success! this procedure is done due to insertElastic failure. task : ${task}`);
                        return Reservation.cancelSQL(reservation.sqlData)})
                    .then(result => {
                        if (!result) return false;
                        task.cancelSQL = true;
                        log.debug('Router', 'createReservation', `cancelSQL success! this procedure is done due to insertElastic failure. task : ${task}`);
                        return false;
                    });
                }
            } else {
                log.debug('Router', 'createReservation', `all process success!`);
                data.createReservationTask = task;
                return data;
            }
        })
}

/**
 * Reservation edit function and update SQL, delete and create EL, FB
 * For next createReservation task, reservation id is deleted in reservation object.
 * if update fail is present for SQL / FB / Elastic, only log will be called because original data will not be modified due to error.
 * @param reservation {Object} reservation
 * @param data {Object} raw requested data
 * @returns {Promise<boolean | never | never>}
 */
function updateReservation(reservation, data) {
    return Promise.resolve(Reservation.updateSQL(data.reservation_id))
        .then(result => {
            if (!result) return false;
            data.canceled_reservation_id = data.reservation_id;
            return Reservation.updateElastic(data.reservation_id)})
        .then(result => {
            if (!result) return false;
            log.debug('Router', 'updateReservation', `all process success!`);
            return data;
        });
}