const chai = require("chai");
const expect = chai.expect;
const TEST_RESERVATION_FILE = require('./models/test files/v2TEST_ReservationData.json');
const TEST_ACCOUNT_FILE = require('./models/test files/v2TEST_AccountData.json');
const RESERVATION_VALID_TEST_RESULT_MAP = {
    result : {'85': false, '86': true, '87': true, '88': false, '89': true, '90': false, '91': true, '92': true, '93': true, '94': true, '95': true, '96': true, '97': true, '98': false, '99': false, '100': false, '101': false, '102': false, '103': false, '104': false, '105': false, '106': false, '107': false},
    failCause : {
        '85' : 'productCheck',
        '88' : 'productCheck',
        '90' : 'productCheck',
        '98': 'operation_date',
        '99': 'productCheck',
        '100': 'operation_date',
        '101': 'agency_id',
        '102': 'totalPeopleNumberCheck',
        '103': 'totalPeopleNumberCheck',
        '104': 'agency_id',
        '105': 'productCheck',
        '106': 'operation_date',
        '107': 'productCheck'
    }
};
const ACCOUNT_VALID_TEST_RESULT_MAP = {
    result : {'1':true,'6':false,'13':true,'15':true,'16':true,'18':true,'20':true,'21':false,'22':true,'23':true,'24':false,'25':false,'26':false,'27':false},
    failCause : {
        '6': 'created',
        '21':'currency',
        '24':'totalMoneyCheck',
        '25':'totalMoneyCheck',
        '26':'created',
        '27':'currency'
    }
};

// describe('Reservation Validation [CREATE] ', () => {
//     Object.keys(TEST_RESERVATION_FILE).forEach(id => {
//         it(`reservation id : ${id}`, (done) => {
//             Reservation.validationCreate(TEST_RESERVATION_FILE[id], true)
//                 .then(validation => {
//                     // if (!validation.result) console.log(`Test result : [${id}] / ${validation}`)
//                     expect(validation.result).to.equal(RESERVATION_VALID_TEST_RESULT_MAP.result[id]);
//                     if (!validation.result) expect(validation.detail[RESERVATION_VALID_TEST_RESULT_MAP.failCause[id]]).to.equal(false);
//                     done();
//                 }).catch(err => {console.log(err)});
//         });
//     });
// });
//
// describe('Reservation Validation [UPDATE] ', () => {
//     Object.keys(TEST_RESERVATION_FILE).forEach(id => {
//         it(`reservation id : ${id}`, (done) => {
//             Reservation.validationUpdate(TEST_RESERVATION_FILE[id], true)
//                 .then(validation => {
//                     expect(validation.result).to.equal(RESERVATION_VALID_TEST_RESULT_MAP.result[id]);
//                     if (!validation.result) expect(validation.detail[RESERVATION_VALID_TEST_RESULT_MAP.failCause[id]]).to.equal(false);
//                     done();
//                 }).catch(err => console.log(err));
//         });
//     });
// });
//
// describe('Account Validation [CREATE] ', () => {
//     Object.keys(TEST_ACCOUNT_FILE).forEach(id => {
//         it(`account id : ${id}`, (done) => {
//             Account.validation(TEST_ACCOUNT_FILE[id], true)
//                 .then(validation => {
//                     expect(validation.result).to.equal(ACCOUNT_VALID_TEST_RESULT_MAP.result[id]);
//                     if (!validation.result) expect(validation.detail[ACCOUNT_VALID_TEST_RESULT_MAP.failCause[id]]).to.equal(false);
//                     done();
//                 }).catch(err => console.log(err));
//         });
//     });
// });