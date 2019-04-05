const Product = require('../../models/product');
const sqlDB = require('../../auth/postgresql');
const fbDB = require('../../auth/firebase').database;
const testV1OperationData = require('../testFiles/v1OperationData_12_19.json');
const productIdExceptions = new Map([['Busan_Private_Private','부산프라이빗'],['Seoul_Private_Private','서울프라이빗'],['Seoul_Regular_에버', '서울에버'], ['Busan_Regular_에버', '부산에버'], ['Seoul_Ski_남이엘리시안', '남이엘리']])
const fs = require('fs');

class V2ReservationConverter {
    constructor(v1Data) {
        this.fbData = V2ReservationConverter.generateFBObject(v1Data);
        this.elasticData = V2ReservationConverter.generateElasticObject(v1Data);
        this.sqlData = V2ReservationConverter.generateSQLObject(v1Data);
    }
    static generateFBObject(v1Data){
        const date = v1Data.date;
        const result = {};
        result[date] = {};
        const promiseArr = [];
        const keyArr = [];
        let reservation;
        let v2ProductData;
        return V2ReservationConverter.findV2Product(v1Data.info.name)
            .then(v2Data => {
                v2ProductData = v2Data;
                result[date][v2Data.id] = {
                    product_name : v2Data.name,
                    product_alias : v2Data.alias,
                    area : v2Data.area,
                    teams : {id : {}}
                };
                reservation = result[date][v2Data.id];
                if (v1Data.teams) {
                    Object.keys(v1Data.teams).forEach(key => {
                        reservation.teams[key] = {
                            id: key,
                            notification: v1Data.teams[key].memo,
                            guides: [],
                            reservations: {}
                        }
                        //todo : 2019.03.24 여기에서 FB의 participant를 참조하여 guide의 id, name을 추가하는
                        //       코드를 짜서 넣어야 함. (현재는 participant등이 완성되지 않아서 하나마나임
                        Object.keys(v1Data.teams.reservations).forEach(r_id => {
                            keyArr.push({team_id: key, v1_r_id: r_id});
                            promiseArr.push(V2ReservationConverter.findV2Reservation(v1Data.teams[key]));
                        })
                    });
                }
                return Promise.all(promiseArr)}).then(promiseResult => {
                for (let i=0;i<promiseResult.length;i++){
                    let team_id = keyArr[i].team_id;
                    let v1_reservation_id = keyArr[i].v1_r_id;
                    let v1Reservation = v1Data.teams[team_id].reservations[v1_reservation_id];
                    reservation.teams[team_id][promiseResult[i].id] = {
                        id : promiseResult[i].id,
                        agency_code : promiseResult[i].agency_code,
                        name : v2ProductData.name,
                        nationality : v1Reservation.nationality,
                        agency : promiseResult[i].agency,
                        writer : promiseResult[i].writer,
                        pickup : v1Reservation.pickupPlace,
                        adult : promiseResult[i].adult,
                        kid : promiseResult[i].kid,
                        infant : promiseResult[i].infant,
                        options: {}
                    };
                    if (promiseResult[i].options) {
                        reservation.teams[team_id][promiseResult[i].id].options = promiseResult[i].options
                    }
                }
                return result;
            })
    }

    static generateElasticObject(v1Data){

    }

    static generateSQLObject(v1Data){
        let v1ProductName = v1Data.product.split('_')[2];
        if (v1ProductName.match(/-/i)) {
            const temp = v1ProductName.split('-');
            v1ProductName = temp[0] + temp[1];
        }
        if (productIdExceptions.has(v1Data.product)) v1ProductName = productIdExceptions.get(v1Data.product);
        return V2ReservationConverter.findV2Product(v1ProductName)
            .then(product => {
                const result = {
                    message_id : v1Data.id,
                    writer : "writer unknown",
                    product_id : product.id,
                    agency : v1Data.agency,
                    agency_code : v1Data.agencyCode.trim(),
                    tour_date : Product.getLocalDate(v1Data.date, 'UTC+9'),
                    options : {},
                    adult : v1Data.adult,
                    kid : v1Data.kid,
                    infant : v1Data.infant,
                    canceled : false,
                    created_date : Product.getLocalDate(v1Data.reservedDate + ' ' + v1Data.reservedTime,'UTC+9'),
                    modified_date : Product.getLocalDate(v1Data.reservedDate + ' ' + v1Data.reservedTime,'UTC+9')
                }
                if (v1Data.options) result.options = v1Data.options;
                return result;
            });
    }

    static findV2Product(v1ProductName) {
        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM product WHERE alias = '${v1ProductName}'`;
            sqlDB.query(query, (err, result) => {
                if (err) throw new Error('find V2 productId failed in SQL');
                resolve(result.rows[0]);
            })
        })
    }

    static findV2Reservation(v1ReservationData) {
        const localDate = Product.getLocalDate(v1ReservationData.date);
        const createdDate = Product.getLocalDate(v1ReservationData.reservedDate + ' ' + v1ReservationData.reservedTime);
        return new Promise((resolve, reject) => {
            const tourDate = new Date(v1ReservationData.date)
            const query = `SELECT * FROM reservation WHERE date = '${localDate}' and created_date = ${createdDate}`;
            sqlDB.query(query, (err, result) => {
                if (err) throw new Error('findV2Reservation in SQL');
                resolve(result.rows[0])
            })
        })
    }
}

function testConvert(v1Operation){
    const result = {};
    const promiseArr = [];
    let i=0;
    Object.keys(v1Operation).forEach(opKey => {
        Object.keys(v1Operation[opKey].teams).forEach(teamId => {
            if (v1Operation[opKey].teams[teamId].reservations) {
                Object.keys(v1Operation[opKey].teams[teamId].reservations).forEach(rsvId => {
                    promiseArr.push(V2ReservationConverter.generateSQLObject(v1Operation[opKey].teams[teamId].reservations[rsvId]));
                })
            }
        })
    });
    return Promise.all(promiseArr).then(promiseResult => {
        promiseResult.forEach(each => {
            result[i++] = (each);
            console.log(JSON.stringify(each))
        });
        // fs.writeFile('server/models/dataFiles/testV2ReservationForValidation.json', JSON.stringify(result), err => {
        //     console.log('done')
        // });
        return result;
    })
}
testConvert(testV1OperationData);
// V2ReservationConverter.findV2ProductId('레송감국').then(result => console.log(`result : ${result}`));