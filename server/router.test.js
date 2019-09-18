const app = require('./app');
const supertest = require('supertest')(app);
const chai = require('chai');
const expect = chai.expect;
const Reservation = require('./models/reservation');
const RESERVATION_CREATE_TEST_CASE = require('./models/validationTestFile/test_validation_v2Reservation_create.json');
const RESERVATION_UPDATE_TEST_CASE = require('./models/validationTestFile/test_validation_v2Reservation_update.json');
const ACCOUNT_TEST_CASE = require('./models/validationTestFile/test_validation_v2Account.json');
const TEST_CASE_RESULT = require('./models/validationTestFile/test_validation_result.json');

describe('v2Reservation CREATE test, ', function() {
    this.timeout(10000);
    const RCT_RESULT = TEST_CASE_RESULT.rct;
    Object.keys(RESERVATION_CREATE_TEST_CASE).forEach(test_case => {
        it(`test case : ${test_case}`, (done) => {
            supertest.post('/v2/reservation')
                .send(RESERVATION_CREATE_TEST_CASE[test_case])
                .set('Accept', 'application/json')
                // .expect(201)
                .then(res => {
                    let resTask = JSON.parse(res.text).reservationTask;
                    let taskResult = RCT_RESULT[test_case].reservationTask;
                    // console.log(`${test_case} : ${JSON.stringify(resTask)} // ${JSON.stringify(taskResult)}`);
                    Object.keys(taskResult).forEach(key => {
                        if (key === 'validationDetail') {
                            Object.keys(taskResult.validationDetail).forEach(subKey => {
                                expect(resTask.validationDetail[subKey]).to.equal(taskResult.validationDetail[subKey]);
                                // console.log(`response : ${resTask[key][subKey]} :: result : ${taskResult[key][subKey]}`);
                            })
                        } else {
                            expect(resTask[key]).to.equal(taskResult[key]);
                            // console.log(`response : ${resTask[key]} :: result : ${taskResult[key]}`);
                        }
                    });
                    done()
                }).catch(err => console.log(err));
        });
    });
});

describe('v2Account test, ', function() {
    this.timeout(10000);
    before(function() {
        Object.keys(ACCOUNT_TEST_CASE).forEach(test_case => {
            if (TEST_CASE_RESULT.at[test_case].reservationTask.type === 'UPDATE') {
                Reservation.undoCancelSQL(ACCOUNT_TEST_CASE[test_case].reservation_id);
                Reservation.undoCancelElastic(ACCOUNT_TEST_CASE[test_case].reservation_id);
            }
        });
    });
    const AT_RESULT = TEST_CASE_RESULT.at;
    Object.keys(ACCOUNT_TEST_CASE).forEach(test_case => {
        if (AT_RESULT[test_case].reservationTask.type === 'UPDATE'){
            it(`test case : ${test_case}`, (done) => {
                supertest.put('/v2/reservation')
                    .send(ACCOUNT_TEST_CASE[test_case])
                    .set('Accept', 'application/json')
                    .then(res => {
                        let resTask = JSON.parse(res.text).reservationTask;
                        let accTask = JSON.parse(res.text).accountTask;
                        let taskResult = {res:AT_RESULT[test_case].reservationTask, acc:AT_RESULT[test_case].accountTask};
                        // console.log(`${test_case} : ${JSON.stringify(JSON.parse(res.text))} // ${JSON.stringify(JSON.parse(taskResult.res))}`);
                        Object.keys(taskResult.res).forEach(key => {
                            expect(resTask[key]).to.equal(taskResult.res[key]);
                        });
                        Object.keys(taskResult.acc).forEach(key => {
                            expect(accTask[key]).to.equal(taskResult.acc[key]);
                            // console.log(`response : ${resTask[key]} :: result : ${taskResult[key]}`);
                        });
                        done()
                    }).catch(err => console.log(err));
            });
        } else {
            it(`test case : ${test_case}`, (done) => {
                supertest.post('/v2/reservation')
                    .send(ACCOUNT_TEST_CASE[test_case])
                    .set('Accept', 'application/json')
                    // .expect(201)
                    .then(res => {
                        let resTask = JSON.parse(res.text).reservationTask;
                        let accTask = JSON.parse(res.text).accountTask;
                        let taskResult = {res:AT_RESULT[test_case].reservationTask,acc:AT_RESULT[test_case].accountTask};
                        // console.log(`${test_case} : ${JSON.stringify(resTask)} // ${JSON.stringify(taskResult)}`);
                        Object.keys(taskResult.res).forEach(key => {
                            expect(resTask[key]).to.equal(taskResult.res[key]);
                        });
                        Object.keys(taskResult.acc).forEach(key => {
                            if (key === 'validationDetail') {
                                Object.keys(taskResult.acc.validationDetail).forEach(subKey => {
                                    expect(accTask.validationDetail[subKey]).to.equal(taskResult.acc.validationDetail[subKey]);
                                    // console.log(`response : ${resTask[key][subKey]} :: result : ${taskResult[key][subKey]}`);
                                })
                            } else {
                                expect(accTask[key]).to.equal(taskResult.acc[key]);
                                // console.log(`response : ${resTask[key]} :: result : ${taskResult[key]}`);
                            }
                        });
                        done()
                    }).catch(err => console.log(err));
            });
        }
    });
});