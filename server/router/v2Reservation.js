const sqlDB = require('../databaseAuth/postgresql');
const Reservation = require('../models/reservation');
const Exceptor = require('../../exceptor');
const Account = require('../models/account');
const url = require('url');
const querystring = require("querystring");
sqlDB.connect();

/**
 *
 * @param reservation {Object} reservation object
 * @param data {Object} raw requested data
 * @param isUpdate {boolean} boolean for edit
 * @returns {Promise<boolean | never>}
 */
function createReservation(reservation, data, isUpdate) {
    let account;
    return Promise.resolve().then(() => {
            if (isUpdate) return reservation;
            return Reservation.insertSQL(reservation)})
        .then(result => {
            if (!result) throw new Error(`No result from Reservation - insertSQL`);
            if (isUpdate && reservation.canceled) return Account.makeReverseData(reservation.id, data);
            else return new Account(result, data)})
        .then(object => {
            account = object;
            if (isUpdate && !reservation.canceled) return true;
            return Account.validation(account, false)})
        .then(validCheck => {
            if (!validCheck) {
                Exceptor.report(Exceptor.TYPE.VALID_CHECK_FAIL_ACCOUNT, 'ValidDataCheck failed');
                throw new Error(`ValidDataCheck failed [Account] ${reservation.id}`);
            }
            if ((isUpdate && !reservation.canceled) || account.insertInhibition) return true;
            return Account.insertSQL(account)})
        .then(result => {
            if (!result) throw new Error(`No result from Account - insertSQL`);
            return Reservation.insertFB(reservation)})
        .then(result => {
            if (!result) throw new Error(`No result from Reservation - insertFB`);
            return Reservation.insertElastic(reservation)})
        .then(result => {
            if (!result) throw new Error(`No result from Reservation - insertElastic`);
            return result;
        });
}

/**
 *
 * @param reservation {Object} reservation
 * @param data {Object} raw requested data
 * @param currentDate {Date} current date
 * @returns {Promise<boolean | never | never>}
 */
function editReservation(reservation, data) {
    let newReservation;
    return Promise.resolve(Reservation.updateSQL(reservation))
        .then(result => {
            if (!result) throw new Error(`No result from Reservation - updateSQL`);
            newReservation = new Reservation(result);
            return Reservation.cancelFB(result)})
        .then(result => {
            if (!result) throw new Error(`No result from Reservation - cancelFB`);
            return Reservation.cancelElastic(reservation.id)})
        .then(result => {
            if (!result) throw new Error(`No result from Reservation - cancelElastic`);
            return newReservation})
        .then(reservation => {
            return createReservation(reservation, data, true);
        })
}

/**
 *
 * @param data {Object} data should include privateTour
 * @returns {Promise<any>}
 */
function checkPrivateTour(data) {
    return new Promise((resolve, reject) => {
        if (data.privateTour) {
            Exceptor.report(Exceptor.TYPE.PRIVATE_TOUR, `Private Tour`);
            resolve(true);
        } else { resolve(false) }
    });
}

/**
 *
 * @param reservation {Object} reservation
 * @param data {Object} raw requested data
 * @param currentDate {Date} current date
 * @param action {String} GET / POST / EDIT
 * @returns {Promise<boolean | never | never>}
 */
function reservationHandler(reservation, data, action){
    return checkPrivateTour(reservation)
        .then(isPrivate => {
            if (isPrivate) throw new Error(`Private tour : reservation = ${JSON.stringify(reservation)}`);
            if (action === 'EDIT') { return Reservation.validationUpdate(reservation, false)}
            else { return Reservation.validationCreate(reservation, false)}})
        .then(validCheck => {
            if (!validCheck) {
                Exceptor.report(Exceptor.TYPE.VALID_CHECK_FAIL_RESERVATION, `ValidDataCheck failed ${action}`);
                throw new Error(`ValidDataCheck failed [Reservation - ${action}], [${reservation.mail_id},${reservation.id}]`);
            }
            if (action === 'GET' || action === 'POST') {
                return createReservation(reservation, data, false);
            } else if (action === 'EDIT') {
                return editReservation(reservation, data);
            }
        });
}

exports.get = (req, res) => {
    const data = url.parse(req.url, true).query;
    const obj = querystring.parse(data);
    const reservation = new Reservation(data);
    // console.log('GET request!', reservation);
    reservationHandler(reservation, data, 'GET')
        .then(result => { res.status(201).send('Reservation saved properly : GET')})
        .catch(err => { res.status(500).send(`GET error :${err.message}`)});
};

exports.post = (req, res) => {
    const data = req.body;
    const reservation = new Reservation(data);
    // console.log('Post request!', reservation);
    if (!req.get('Content-Type')) {
        Exceptor.report(Exceptor.TYPE.UNKNOWN_CONTENT_TYPE, 'Content-Type should be json');
        return res.status(400).send("Content-Type should be json")
    }
    reservationHandler(reservation, data, 'POST')
        .then(result => { res.status(201).send('Reservation saved properly : POST')})
        .catch(err => { res.status(500).send(`POST error :${err.message}`)});
};

exports.edit = (req, res) => {
    const data = url.parse(req.url, true).query;
    const reservation = new Reservation(data);
    // console.log('EDIT request! data : ', reservation);
    reservationHandler(reservation, data, 'EDIT')
        .then(result => { res.status(201).send('Reservation saved properly : EDIT')})
        .catch(err => { res.status(500).send(`EDIT error :${err.message}`)});
};