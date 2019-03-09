const app = require('./app');
const supertest = require('supertest')(app);
const Product = require('./models/product');
const chai = require('chai');
const expect = chai.expect;
const TEST_REQUEST = {
    GET : [{"mail_id":"test case GET - 1","product_id":"Busan_Regular_태감송해","agency_id":"LE","timezone":"UTC+9","reserved_name":"Youngmo - GET 1","nationality":"PHILIPPINES","tour_date":"2018-06-14T23:46:22","pickup":"Myungdong","name":"태감오해","option":{"pay":"later"},"adult":3,"kid":0,"infant":0,"memo":"This is Test data for update data","phone":"+639065532345","email":"-","messenger":"Whatsapp+639065532345","canceled":false,"cancel_comment":"not canceled","currency":"Won","category":"test","card_income":300000,"card_expenditure":0,"cash_income":0,"cash_expenditure":0,"writer":"youngmo"},
        {"mail_id":"test case GET - 2","product_id":"Busan_Regular_통영","agency_id":"UH","timezone":"UTC+9","reserved_name":"Youngmo GET 2","nationality":"Korea","tour_date":"2018-10-02T12:22:30","pickup":"Dongdaemun","name":"통영루지","option":{"pay":"later"},"adult":3,"kid":0,"infant":0,"memo":"This is Test data for create data","phone":"+639065532345","email":"adfadv@naver.com","messenger":"Whatsapp+639065532345","canceled":false,"cancel_comment":"not canceled","currency":"$","category":"test","card_income":3000,"card_expenditure":0,"cash_income":0,"cash_expenditure":0,"writer":"youngmo"},
        {"mail_id":"test case GET - 3","product_id":"Seoul_Summer_진도","agency_id":"MMF","timezone":"UTC+9","reserved_name":"Youngmo - GET 3","nationality":"PHILIPPINES","tour_date":"2018-07-11T23:55:46","pickup":"Myungdong","name":"벛꽃랜덤","option":{"pay":"later"},"adult":42,"kid":0,"infant":0,"memo":"This is Test data for create data","phone":"+639065532345","email":"req35fdfa@naver.com","messenger":"Whatsapp+639065532345","canceled":false,"cancel_comment":"not canceled","currency":"Won","category":"test","card_income":8200000,"card_expenditure":0,"cash_income":0,"cash_expenditure":0,"writer":"youngmo"}
    ],
    POST : [{"mail_id":"test case POST - 1","product_id":"Busan_Regular_태감송해","agency_id":"LE","timezone":"UTC+9","reserved_name":"Yougnmo - POST 1","nationality":"Japan","tour_date":"2018-06-14T23:46:22","pickup":"Myungdong","name":"태감오해","option":{"pay":"later"},"adult":3,"kid":0,"infant":0,"memo":"This is Test data for update data","phone":"+639065532345","email":"-","messenger":"Whatsapp+639065532345","canceled":false,"cancel_comment":"not canceled","currency":"Won","category":"test","card_income":300000,"card_expenditure":0,"cash_income":0,"cash_expenditure":0,"writer":"youngmo"},
        {"mail_id":"test case POST - 2","product_id":"Busan_Regular_통영","agency_id":"UH","timezone":"UTC+9","reserved_name":"Youngmo - POST 2","nationality":"PHILIPPINES","tour_date":"2018-10-02T05:22:52","pickup":"Dongdaemun","name":"통영루지","option":{"pay":"later"},"adult":3,"kid":0,"infant":0,"memo":"This is Test data for create data","phone":"+639065532345","email":"adfadv@naver.com","messenger":"Whatsapp+639065532345","canceled":false,"cancel_comment":"not canceled","currency":"$","category":"test","card_income":3000,"card_expenditure":0,"cash_income":0,"cash_expenditure":0,"writer":"youngmo"},
        {"mail_id":"test case POST - 3","product_id":"Seoul_Summer_진도","agency_id":"MMF","timezone":"UTC+9","reserved_name":"Youngmo - POST 3","nationality":"PHILIPPINES","tour_date":"2018-07-11T23:55:46","pickup":"Myungdong","name":"벛꽃랜덤","option":{"pay":"later"},"adult":42,"kid":0,"infant":0,"memo":"This is Test data for create data","phone":"+639065532345","email":"req35fdfa@naver.com","messenger":"Whatsapp+639065532345","canceled":false,"cancel_comment":"not canceled","currency":"Won","category":"test","card_income":8200000,"card_expenditure":0,"cash_income":0,"cash_expenditure":0,"writer":"youngmo"}
    ],
    EDIT : [{"id":112,"mail_id":"test case UPDATE - 1","product_id":"Busan_Regular_태감송해","agency_id":"LE","timezone":"UTC+9","reserved_name":"Youngmo - EDIT 1","nationality":"PHILIPPINES","tour_date":"2018-06-14T23:46:22","pickup":"Myungdong","name":"태감오해","option":{"pay":"later"},"adult":3,"kid":0,"infant":0,"memo":"This is Test data for update data","phone":"+639065532345","email":"-","messenger":"Whatsapp+639065532345","canceled":false,"cancel_comment":"not canceled","currency":"Won","category":"test","card_income":300000,"card_expenditure":0,"cash_income":0,"cash_expenditure":0,"writer":"youngmo"},
        {"id":113,"mail_id":"test case UPDATE - 2","product_id":"Busan_Regular_통영","agency_id":"UH","timezone":"UTC+9","reserved_name":"Youngmo EDIT 2","nationality":"Korea","tour_date":"2018-10-02T06:22:39","pickup":"Dongdaemun","name":"통영루지","option":{"pay":"later"},"adult":3,"kid":0,"infant":0,"memo":"Cancel","phone":"+639065532345","email":"adfadv@naver.com","messenger":"Whatsapp+639065532345","canceled":true,"cancel_comment":"not canceled","currency":"$","category":"test","card_income":3000,"card_expenditure":0,"cash_income":0,"cash_expenditure":0,"writer":"youngmo"},
        {"id":114,"mail_id":"test case UPDATE - 3","product_id":"Seoul_Summer_진도","agency_id":"MMF","timezone":"UTC+9","reserved_name":"Youngmo EDIT 3","nationality":"PHILIPPINES","tour_date":"2018-07-11T23:55:46","pickup":"Myungdong","name":"벛꽃랜덤","option":{"pay":"later"},"adult":42,"kid":0,"infant":0,"memo":"Cancel ","phone":"+639065532345","email":"req35fdfa@naver.com","messenger":"Whatsapp+639065532345","canceled":true,"cancel_comment":"not canceled","currency":"Won","category":"test","card_income":8200000,"card_expenditure":0,"cash_income":0,"cash_expenditure":0,"writer":"youngmo"}
    ]
};

function testCaseGet(count, done){
    supertest.get('/v2/reservation')
        .query(TEST_REQUEST.GET[count])
        .expect(201)
        .expect(res => { expect(res.text).to.equal('Reservation saved properly : GET')})
        .end(done);
}

function testCasePost(count, done){
    supertest.post('/v2/reservation')
        .send(TEST_REQUEST.POST[count])
        .expect(201)
        .expect(res => { expect(res.text).to.equal('Reservation saved properly : POST')})
        .end(done);
}

function testCaseEdit(count, done){
    supertest.get('/v2/reservation/edit')
        .query(TEST_REQUEST.EDIT[count])
        .expect(201)
        .expect(res => { expect(res.text).to.equal('Reservation saved properly : EDIT')})
        .end(done);
}

describe('v2Reservation router', () => {
    for (let count=1; count<3; count++){
        it (`GET test case ${count}`, (done) => {
            testCaseGet(count, done);
        });
    }
    for (let count=1; count<3; count++){
        it (`POST test case ${count}`, (done) => {
            testCasePost(count, done);
        });
    }
    for (let count=1; count<3; count++){
        it (`Edit test case ${count}`, (done) => {
            testCaseEdit(count, done);
        });
    }
});
//
// // describe('v2Reservation router [GET]', () => {
// //     let request;
// //     beforeEach(() => request = supertest(app).get('http://127.0.0.1:3000/v2/reservation'));
// //     Object.keys(TEST_REQUEST.GET).forEach(key => {
// //         it(`test case ${key}`, (done) => {
// //             request.query(TEST_REQUEST.GET[key])
// //                 .expect('Content-Type', 'text/html; charset=utf-8')
// //                 .set('Connection', 'keep-alive')
// //                 .expect(201)
// //                 .expect(res => {
// //                     expect(res.text).to.equal('Reservation saved properly : GET');
// //                     done();
// //                 });
// //         });
// //     });
// // });
//
// describe('v2Reservation router [POST]', () => {
//     let request;
//     it('GET v2 Reservation', (done) => {
//         supertest.post('/v2/reservation')
//             .send(TEST_REQUEST.POST['1'])
//             .set('Content-Type', 'application/json')
//             .set('Accept', 'application/json')
//             .expect(201)
//             .expect((res) => {
//                 expect(res.text).to.equal('Reservation saved properly : POST');
//             })
//             .end(done)
//     });
// });
//
// describe('v2Reservation router [EDIT]', () => {
//     let request;
//     beforeEach(() => request = supertest.get('/v2/reservation/edit'));
//     Object.keys(TEST_REQUEST.EDIT).forEach(key => {
//         it('UPDATE v2 Reservation', (done) => {
//             request.query(TEST_REQUEST.EDIT[key])
//                 .expect('Content-Type', 'text/html; charset=utf-8')
//                 .expect(201)
//                 .expect(res => {
//                     expect(res.text).to.equal('Reservation saved properly : EDIT');
//                     done();
//                 });
//         });
//     });
// });
//
//
// // let request;
// // describe('v2Reservation router [POST]', () => {
// //     beforeEach(() => request = supertest(app).post('/v2/reservation'));
// //     Object.keys(TEST_REQUEST.POST).forEach(key => {
// //         it('GET v2 Reservation', (done) => {
// //             request.set('Accept', 'application/json; charset=utf-8')
// //                 .set('Content-Type', 'application/json; charset=utf-8')
// //                 .send(TEST_REQUEST.POST['1'])
// //                 // .set('Accept', 'application/json')
// //                 // .expect(201)
// //                 .expect((res) => {
// //                     expect(res.text).to.equal('Reservation saved properly : POST');
// //                     console.log('target data : ',TEST_REQUEST.POST[key])
// //                     done();
// //                 })
// //         });
// //     });
// // });
// //
// // beforeEach(() => request = supertest(app).get('/v2/reservation/edit'));
// // describe('v2Reservation router [EDIT]', () => {
// //     Object.keys(TEST_REQUEST.EDIT).forEach(key => {
// //         it('UPDATE v2 Reservation', (done) => {
// //             request.query(TEST_REQUEST.EDIT[key])
// //                 .expect('Content-Type', 'text/html; charset=utf-8')
// //                 .expect(201)
// //                 .expect(res => {
// //                     expect(res.text).to.equal('Reservation saved properly : EDIT');
// //                     done();
// //                 });
// //         });
// //     });
// // });