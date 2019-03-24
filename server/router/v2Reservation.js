const sqlDB = require('../auth/postgresql');
const Reservation = require('../models/reservation');
const Product = require('../models/product');
const accountRouter = require('./v2Account');
const log = require('../../log');
sqlDB.connect();

exports.post = (req, res) => {
    if (!req.get('Content-Type')) return res.status(400).send("Content-Type should be json");
    routerHandler(req, res, 'POST').catch(err => { res.status(500).send(`POST error :${err.message}`)});
};

exports.update = (req, res) => {
    if (!req.get('Content-Type')) return res.status(400).send("Content-Type should be json");
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
    return productFinder(data)
        .then(productData => {
            data.productData = productData;
            const reservation = new Reservation(data);
            return reservationHandler(reservation, data, requestType)})
        .then(result => {
            if (!result) throw new Error('reservationHandler failed');
            req.body = result;
            if (requestType === 'POST') return accountRouter.post(req, res);
            else return accountRouter.update(req, res);
        });
}

function productFinder(data) {
    let product;
    return Product.getProduct(data.product)
        .then(result => {
            product = result;
            if (result.sales.__proto__ === [].__proto__) {
                result.sales.forEach(item => {
                    if (item.default) return item })
            } else if (result.sales.__proto__ === {}.__proto__) {
                Object.keys(result.sales).forEach(key => {
                    if (result.sales[key].default) return result.sales[key] })
            }})
        .then(targetItem => {
            return {
                id : product.id,
                name : targetItem.name,
                alias : product.alias,
                category : product.category,
                area : product.area,
                geos : product.geos,
                currency : targetItem.currency,
                income : incomeCalculation(data, product, targetItem),
                expenditure : 0
            };
        });
}

function incomeCalculation(data, product, targetItem) {
    let income = 0;
    if (targetItem.sales.__proto__ === [].__proto__) {
        targetItem.sales.forEach(priceItem => income += priceCalculation(priceItem, data));
    } else if (targetItem.sales.__proto__ === {}.__proto__) {
        Object.keys(targetItem.sales).forEach(key => income += priceCalculation(targetItem.sales[key], data))
    }
    if (Object.keys(data.options).length > 0) {
        data.options.forEach(targetOption => {
            product.options.forEach(productOption => {
                if (productOption.name === targetOption.name) income += productOption.price * targetOption.number;
            });
        });
    }
    return income;
}

function priceCalculation(item, data) {
    if (item.type === 'adult' && !!Number(data.adult)) return item.net * data.adult;
    else if (item.type === 'adolescent' && !!Number(data.adolescent)) return item.net * data.adolescent;
    else if (item.type === 'child' && !!Number(data.kid)) return item.net * data.kid;
    else if (item.type === 'infant' && !!Number(data.infant)) return item.net * data.infant;
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
    let fail = {sql:false, fb:false, elastic:false};
    return Reservation.insertSQL(reservation.sqlData)
        .then(result => {
            if (!result) {
                fail.sql = true;
                return false;
            }
            data.reservation_id = result.id;
            data.elasticData.id = result.id;
            reservation.id = result.id;
            return Reservation.insertFB(reservation, data)})
        .then(result => {
            if (!result && !fail.sql) fail.fb = true;
            if (fail.sql) return Reservation.cancelSQL(reservation);
            return Reservation.insertElastic(reservation.elasticData)})
        .then(result => {
            if (!result && !fail.fb) fail.elastic = true;
            if (fail.fb) return Reservation.cancelFB(reservation, data).then(() => {return Reservation.cancelSQL(reservation)});
            return data;
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
    let fail = {sql:false, fb:false, elastic:false};
    return Promise.resolve(Reservation.cancelSQL(reservation))
        .then(result => {
            if (!result) {
                fail.sql = true;
                return false;
            }
            data.canceled_reservation_id = result.id;
            return Reservation.cancelFB(reservation, data)})
        .then(result => {
            if (!result && !fail.sql) fail.fb = true;
            if (fail.sql) log.warn('WARN', 'SQL update fail', 'Reservation data update from SQL failed', {reservation_id : reservation.id});
            return Reservation.cancelElastic(reservation)})
        .then(result => {
            if (!result && !fail.fb) fail.elastic = true;
            if (fail.fb) log.warn('WARN', 'FB update fail', 'Reservation data delete / create from / to FB failed', {reservation_id : reservation.id});
            if (fail.elastic) log.warn('WARN', 'Elastic update fail', 'Reservation data delete / create from / to Elastic failed', {reservation_id : reservation.id});
            delete reservation.sqlData.id;
            delete reservation.elasticData.id;
            return createReservation(reservation, data);
        })
}