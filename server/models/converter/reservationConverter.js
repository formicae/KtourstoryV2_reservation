const Product = require('../../models/product');
const Reservation = require('../../models/reservation');
const sqlDB = require('../../auth/postgresql');
const fbDB = require('../../auth/firebase').database;
const V1_V2_PRODUCT_EXCEPTIONAL_NAME_MAP = new Map([
    ['Busan_Regular_부산 Scenic', '부산Scenic'],
    ['Seoul_Regular_에버', '서울에버'],
    ['Seoul_Regular_전주railbike', '전주'],
    ['Seoul_Spring_벚꽃랜덤', '서울벚꽃랜덤'],
    ['Seoul_Spring_진해', '서울진해'],
    ['Seoul_Summer_진도', '서울진도'],
    ['Seoul_Spring_보성녹차축제', '서울보성녹차'],
    ['Seoul_Ski_남이엘리시안', '남이엘리'],
    ['Busan_Private_Private(B)', '부산프라이빗'],
    ['Seoul_Spring_서울-광양구례', '서울광양구례'],
    ['Busan_Spring_부산-광양구례', '부산광양구례'],
    ['Busan_Summer_진도부산출발', '부산진도'],
    ['Seoul_Regular_민속촌-레일', '민속촌레일'],
    ['Busan_Regular_대구EWORLD', '대구이월드'],
    ['Busan_Regular_해인사-일루미아', '일루미아'],
    ['Seoul_Regular_민속촌레일광명', '민속촌레일광명'],
    ['Busan_Regular_통영루지', '통영'],
    ['Busan_Spring_대구벚꽃(주)', '대구벚꽃주'],
    ['Busan_Spring_대구벚꽃(야)', '대구벚꽃야'],
    ['Busan_Regular_동부산 에덴루지', '동부산에덴루지'],
    ['Seoul_Private_Private', '서울프라이빗'],
    ['Seoul_Mud_머드서울', '머드'],
    ['Seoul_Mud_머드-공연일', '머드공연일'],
    ['Seoul_Summer_포항불꽃축제', '서울포항불꽃'],
    ['Busan_Summer_포항불꽃-부산', '부산포항불꽃'],
    ['Seoul_Summer_봉화은어축제', '봉화은어'],
    ['Seoul_Autumn_대천Skybike', '대천스카이바이크'],
    ['Seoul_Autumn_포천사과', '포천'],
    ['Seoul_Strawberry_포천딸기', '포천'],
    ['Seoul_Summer_여름포천', '포천'],
    ['Seoul_Autumn_설악산단풍', '설악단풍'],
    ['Seoul_Autumn_덕유산_closed', '덕유산'],
    ['Busan_Spring_부산-보성녹차', '부산보성녹차'],
    ['Seoul_Autumn_단풍랜덤', '서울단풍랜덤'],
    ['Busan_Autumn_단풍랜덤부산', '부산단풍랜덤'],
    ['Seoul_Mud_머드-편도', '머드편도'],
    ['Seoul_Mud_머드-편도ticket주중', '머드편도'],
    ['Seoul_Mud_머드-편도ticket주말', '머드편도'],
    ['Seoul_Summer_남맥', '남맥'],
    ['Seoul_Autumn_일산패키지투어', '일산'],
    ['Seoul_Ski_비발디(레슨)', '비발디레슨'],
    ['Seoul_Regular_캐베-미드', '캐배미드'],
    ['Seoul_Regular_캐베-골드', '캐배골드'],
    ['Seoul_Regular_해돋이', '서울해돋이'],
    ['Seoul_Regular_민속촌-우주', '민속촌우주'],
    ['Seoul_Regular_스킨케어', '스킨케어'],
    ['Busan_Regular_서부산', '서부산'],
    ['Busan_Regular_안동', '안동'],
    ['Busan_Autumn_부산 핑크뮬리', '부산핑크뮬리']
]);
const CHECK_RESERVATION_KEY_MAP = ['message_id', 'writer', 'product_id', 'agency', 'agency_code', 'tour_date', 'adult', 'kid', 'infant', 'canceled'];
const fs = require('fs');

class v2ReservationConverter {
    constructor(v1OperationData) {
        this.data = v1OperationData;
    }

    static async generateSimpleFbData(v1ProductId, teamId, v1_r_id, v1Reservation, v2SqlReservation) {
        const result = {};
        const tour_date = v1Reservation.date;
        const v2Product = await this.findProduct(v1ProductId, v1ProductId.split('_')[2]);
        if (!v2Product) return console.log(` Error : no v2 product for v1 product : ${v1ProductId}`);
        const v2FbReservation = {
            id: v2SqlReservation.id,
            agency_code: v1Reservation.agency_code,
            name: v1Reservation.clientName,
            nationality: v1Reservation.nationality,
            agency: v2SqlReservation.agency,
            writer: v2SqlReservation.writer || v2SqlReservation.agency,
            pickup: v1Reservation.pickupPlace,
            adult: v2SqlReservation.adult,
            kid: v2SqlReservation.kid,
            infant: v2SqlReservation.infant,
            options: {},
            phone: v1Reservation.tel || '',
            email: v1Reservation.email || '',
            messenger: v1Reservation.messenger || '',
            memo: v1Reservation.memo || '',
            o: v1Reservation.oCheck || false,
            g: v1Reservation.gCheck || v1Reservation.oChekc || false
        };
        if (v2SqlReservation.options) v2FbReservation.options = v2SqlReservation.options;
        if (!v1Reservation.language) v2FbReservation.language = 'English'
        else if (v1Reservation.language === 'N/A') v2FbReservation.language = 'English';
        else v2FbReservation.language = v1Reservation.language;
        const data = {
            date: tour_date,
            productData: v2Product,
            operation: tour_date + '/' + v1ProductId + '/' + teamId + '/' + v2SqlReservation.id
        };
        if (!data.productData.bus) data.productData.bus = {company: 'busking', size: 43, cost: 0};
        result[tour_date] = {};
        result[tour_date][v1Product] = {};
        result[tour_date][v1Product].teams = {};
        result[tour_date][v1Product].teams[teamId] = {};
        result[tour_date][v1Product].teams[teamId].reservations = {};
        result[tour_date][v1Product].teams[teamId].reservations[v2FbReservation.id] = v2FbReservation;
        return {
            reservation : result,
            data: data
        };
    }

    /**
     * generate v2 Reservation object for Firebase and Elastic search with v1 Reservation Data and product ID
     * @param v1Data {Object} reservation data. v1Operation > [date] > [productName] > teams > [teamId] > reservations > [reservationId]
     * @param productId {String} v1 product name of v1 Reservation. example : Seoul_Regular_남쁘아
     * @returns {Promise<any | never>}
     */
    static generateFbElasticObject(v1Data, productId){
        const date = v1Data.date;
        const result = {elasticData:[], fbOverallData:{}};
        const fbData = {};
        fbData[date] = {};
        const promiseArr = [], keyArr = [];
        let reservation, productData;
        result.fbOverallData[date] = {};
        return this.findProduct(productId, productId.split('_')[2])
            .then(v2ProductData => {
                // try { console.log('product find result : ', productId, v2Data.id); }
                // catch { console.log('error : ',productId,productId.split('_')[2],JSON.stringify(v2Data)) }
                if (!v2ProductData) return [];
                productData = v2ProductData;
                fbData[date][v2ProductData.id] = {product_name: v2ProductData.name, product_alias: v2ProductData.alias, area: v2ProductData.area, teams: {}};
                if (!result.fbOverallData[date][v2ProductData.id]) result.fbOverallData[date][v2ProductData.id] = {};
                reservation = fbData[date][v2ProductData.id];
                if (v1Data.teams) {
                    Object.keys(v1Data.teams).forEach(key => {
                        if (!result.fbOverallData[date][v2ProductData.id].teams) result.fbOverallData[date][v2ProductData.id].teams = {};
                        result.fbOverallData[date][v2ProductData.id].teams[key] = {};
                        reservation.teams[key] = {id: key, notification: v1Data.teams[key].memo || {}, guides: v1Data.teams[key].guide || [], reservations: {}};
                        if (v1Data.teams[key].reservations) {
                            Object.keys(v1Data.teams[key].reservations).forEach(r_id => {
                                keyArr.push({team_id: key, v1_r_id: r_id});
                                // SQL에서 먼저 reservation id 를 만든 후에 firebase에 넣어야 하기 때문에 아래의 findV2Reservation이 필요 v2 product id를 찾는것이 목표.
                                promiseArr.push(v2ReservationConverter.findV2Reservation(v1Data.teams[key].reservations[r_id], v2ProductData, r_id));
                            });
                        }
                    });
                }
                return Promise.all(promiseArr)
            }).then(promiseResult => {
                if (promiseResult.length > 0) {
                    for (let i = 0; i < promiseResult.length; i++) {
                        let team_id = keyArr[i].team_id;
                        let v1_reservation_id = keyArr[i].v1_r_id;
                        if (v1Data.teams[team_id].reservations) {
                            let v1Reservation = v1Data.teams[team_id].reservations[v1_reservation_id];
                            reservation.teams[team_id].reservations[promiseResult[i].id] = {
                                id: promiseResult[i].id,
                                agency_code: promiseResult[i].agency_code,
                                name: v1Reservation.clientName,
                                nationality: v1Reservation.nationality,
                                agency: promiseResult[i].agency,
                                writer: promiseResult[i].writer || 'writer unknown',
                                pickup: v1Reservation.pickupPlace,
                                adult: promiseResult[i].adult,
                                kid: promiseResult[i].kid,
                                infant: promiseResult[i].infant,
                                options: {},
                                phone: v1Reservation.tel || '',
                                email: v1Reservation.email || '',
                                messenger: v1Reservation.messenger || '',
                                memo: v1Reservation.memo || '',
                                o: v1Reservation.oCheck || false,
                                g: v1Reservation.gCheck || v1Reservation.oChekc || false
                            };
                            if (promiseResult[i].options) {
                                reservation.teams[team_id].reservations[promiseResult[i].id].options = promiseResult[i].options
                            }
                            if (!v1Reservation.language) {
                                reservation.teams[team_id].reservations[promiseResult[i].id].language = 'English'
                            } else if (v1Reservation.language === 'N/A') {
                                reservation.teams[team_id].reservations[promiseResult[i].id].language = 'English';
                            } else {
                                reservation.teams[team_id].reservations[promiseResult[i].id].language = v1Reservation.language;
                            }
                            if (!productData.bus) productData.bus = {company: 'busking', size: 43, cost: 0};
                            result.elasticData.push(this.elasticDataMatch(v1Data.teams[team_id].reservations[v1_reservation_id], productData, promiseResult[i]));
                            if (!result.fbOverallData[date][productData.id].teams[team_id].reservations) result.fbOverallData[date][productData.id].teams[team_id] = {reservations: {}};
                            result.fbOverallData[date][productData.id].teams[team_id].reservations[promiseResult[i].id] = {
                                date: v1Data.date,
                                productData: productData,
                                operation: v1Data.date + '/' + productData.id + '/' + team_id + '/' + promiseResult[i].id
                            };

                        }
                    }
                    result.fbData = fbData;
                    return result;
                }
            });
    }

    /**
     *
     * @param v1Reservation {Object} v1 Reservation data
     * @param v2ProductData {Object} v2 Product Data from postgreSQL
     * @param v2SQLData {Object} v2 Reservation Data from postgreSQL
     * @returns {{product: {area: *, bus: {cost: number, size: number, company: string}, geos: {location: {lon: number, lat: number}, place: *}, name: *, alias: *, id: *, category: *}, agency: (*|Array|boolean), agency_code: string, timezone: string, kid: (*|number|Number|string|boolean), pickup: {location: {lon: number, lat: number}, place: string}, memo: *, message_id: *, language: (*|string|string), infant: (string|*|number|Number|boolean), modified_date: (*|*|string|boolean|String|*), canceled: boolean, total: *, nationality: (string|*), phone: string, messenger: (string|*), options: *, tour_date: *, id: *, writer: string, created_date: (*|*|boolean|Date|string|*), adult: (boolean|string|*|number|Number), email: *}}
     */
    static elasticDataMatch(v1Reservation, v2ProductData, v2SQLData) {
        const result = {
            id: v2SQLData.id,
            message_id: v1Reservation.id,
            writer: v1Reservation.writer || v1Reservation.agency,
            product : {
                id: v2ProductData.id,
                name: v2ProductData.name,
                bus: { company: 'busking', size: 43, cost: 0},
                alias: v2ProductData.alias,
                category: v2ProductData.category,
                area: v2ProductData.area,
                geos: { place: v2ProductData.alias, location: { lat: 0.0, lon: 0.0 }}
            },
            agency: v1Reservation.agency,
            agency_code: v1Reservation.agencyCode,
            name: v1Reservation.clientName,
            nationality: v1Reservation.nationality,
            tour_date: v1Reservation.date,
            pickup: { place: v1Reservation.pickupPlace, location:{ lat: 0.0, lon: 0.0 }},
            options : v2SQLData.options,
            adult: v1Reservation.adult,
            kid: v1Reservation.kid,
            infant: v1Reservation.infant,
            total: v1Reservation.adult + v1Reservation.kid + v1Reservation.infant,
            phone: v1Reservation.tel || '',
            email: v1Reservation.email || '',
            messenger: v1Reservation.messenger || '',
            memo: v1Reservation.memo || '',
            canceled: false,
            created_date: v2SQLData.created_date,
            modified_date: v2SQLData.modified_date,
            timezone : 'UTC+9',
            language : v1Reservation.language
        };
        if (v1Reservation.option) result.options.name = v1Reservation.option[0].option;
        if (!v1Reservation.language) {
            result.language = 'English'
        } else if (v1Reservation.language === 'N/A') {
            result.language = 'English'
        } else {
            result.language = v1Reservation.language
        }
        return result;
    };

    /**
     * generate v2 Reservation object with v1 Reservation data
     * @param v1Reservation {Object} v1 Reservation data. v1Operation > [date] > [productName] > teams > [teamId] > reservations > [reservationId]
     * @param canceled {Boolean} Boolean if reservation should be made in canceled
     * @returns {Promise<any | never>}
     */
    static generateSQLObject(v1Reservation , canceled){
        let v1ProductName = v1Reservation.product.split('_')[2];
        if (v1ProductName.match(/-/i)) {
            const temp = v1ProductName.split('-');
            v1ProductName = temp[0] + temp[1];
        }
        if (V1_V2_PRODUCT_EXCEPTIONAL_NAME_MAP.has(v1Reservation.product)) {
            v1ProductName = V1_V2_PRODUCT_EXCEPTIONAL_NAME_MAP.get(v1Reservation.product);
        }
        // return Product.getProduct()
        // todo : v1 Product를 모두 v2로 바꾼 후 firebase에 올려놓은 후에 진행해야 한다.
        return v2ReservationConverter.findProduct(v1Reservation.product, v1ProductName)
            .then(product => {
                if (product) {
                    const result = {
                        message_id : v1Reservation.id,
                        writer : v1Reservation.agency,
                        product_id : product.id,
                        agency : v1Reservation.agency,
                        agency_code : v1Reservation.agencyCode.trim(),
                        tour_date : Product.getLocalDate(v1Reservation.date, 'UTC+9'),
                        options : [],
                        adult : v1Reservation.adult,
                        kid : v1Reservation.kid,
                        infant : v1Reservation.infant,
                        canceled : canceled,
                        created_date : Product.getLocalDate(v1Reservation.reservedDate + ' ' + v1Reservation.reservedTime,'UTC+9'),
                        modified_date : Product.getLocalDate(v1Reservation.reservedDate + ' ' + v1Reservation.reservedTime,'UTC+9')
                    };
                    if (v1Reservation.option) {
                        v1Reservation.option.forEach(each => {
                            let temp = { name : each.option, number : each.people};
                            result.options.push(temp);
                        });
                    }
                    return result;
                } else {
                    console.log('Product not found : ',v1Reservation.product, v1ProductName);
                    return false;
                }

            });
    }

    /**
     * find v2 product from v1 product name
     * Important : PRODUCT_ID_EXCEPTIONS 는 v1 <-> v2 product 매칭이 되지 않는 것 때문에 임시방편으로 만들어 놓은 것이고,
     *             결과적으로 v1 <-> v2 간 product의 100% 매칭이 이루어 져야 한다.
     * @param rawName {String} example : Seoul_Regular_태감송해
     * @param v1ProductName {String} example : 태감송해
     * @returns {Promise<any>}
     */
    static findProduct(rawName, v1ProductName) {
        let target = v1ProductName;
        return new Promise((resolve, reject) => {
            if (V1_V2_PRODUCT_EXCEPTIONAL_NAME_MAP.has(rawName)) target = (V1_V2_PRODUCT_EXCEPTIONAL_NAME_MAP.get(rawName));
            const query = `SELECT * FROM product WHERE alias = '${target}'`;
            sqlDB.query(query, (err, result) => {
                if (err) throw new Error('find V2 productId failed in SQL');
                resolve(result.rows[0]);
            })
        })
    }

    /**
     * find v2 reservation object from postgreSQL with v1 data
     * @param v1ReservationData
     * @param v2Data {Object}
     * @param r_id {String} v1 reservation id (message_id in v2 Reservation)
     * @returns {Promise<any>}
     */
    static findV2Reservation(v1ReservationData, v2Data, r_id) {
        return new Promise((resolve, reject) => {
            const tourDate = new Date(v1ReservationData.date);
            const query = `SELECT * FROM reservation WHERE message_id = '${v1ReservationData.id}' and product_id = '${v2Data.id}' and adult=${v1ReservationData.adult} and kid=${v1ReservationData.kid} and infant=${v1ReservationData.infant} and agency_code = '${v1ReservationData.agencyCode.trim()}'`;
            sqlDB.query(query, (err, result) => {
                if (err) throw new Error(`findV2Reservation in SQL : ${r_id} ${tourDate}, ${v1ReservationData.date} ${v2Data.id} \n query : ${query}`);
                resolve(result.rows[0])
            })
        })
    }

    /**
     * convert v1 Operation data to v2 Reservation for postgreSQL
     * @param v1OperationBulkData {Object} v1 Operation data
     * @returns {Promise<[any, any, any, any, any, any, any, any, any, any] | never>}
     * @output {count : {v2 Reservation data}}
     */
    static async convertV1SqlData(v1OperationBulkData) {
        const result = {};
        let i = 0;
        for (let temp0 of Object.entries(v1OperationBulkData)) {
            let date = temp0[0];
            let v1Operation = temp0[1];
            for (let temp1 of Object.entries(v1Operation)) {
                let v1ProductId = temp1[0];
                let v1Team = temp1[1].teams;
                if (v1Team) {
                    for (let temp2 of Object.entries(v1Team)) {
                        let v1TeamId = temp2[0];
                        let v1ReservationObj = temp2[1].reservations;
                        if (v1ReservationObj) {
                            for (let temp3 of Object.entries(v1ReservationObj)) {
                                let v1ReservationId = temp3[0];
                                let v1Reservation = temp3[1];
                                if (v1Reservation) {
                                    let v2Reservtion = await v2ReservationConverter.generateSQLObject(v1Reservation, false);
                                    result[i] = v2Reservtion;
                                    console.log(`  [${v2Reservtion.message_id}] convert done!`);
                                    i += 1;
                                }
                            }
                        }
                    }
                }
            }
        }
        return result;
    }

    static async convertAndInsertV1OperationToSQLBulk(v1OperationBulkData) {
        let sqlGeneratePromiseArr = [];
        let checkReservationPromiseArr = [];
        let insertReservationProsmieArr = [];
        Object.keys(v1OperationBulkData).forEach(date => {
            Object.keys(v1OperationBulkData[date]).forEach(v1ProductId => {
                if (v1OperationBulkData[date][v1ProductId].teams) {
                    Object.keys(v1OperationBulkData[date][v1ProductId].teams).forEach(v1TeamId => {
                        if (v1OperationBulkData[date][v1ProductId].teams[v1TeamId].reservations) {
                            Object.keys(v1OperationBulkData[date][v1ProductId].teams[v1TeamId].reservations).forEach(v1_r_id => {
                                let v1Reservation = v1OperationBulkData[date][v1ProductId].teams[v1TeamId].reservations[v1_r_id];
                                sqlGeneratePromiseArr.push(this.generateSQLObject(v1Reservation, false));
                            })
                        }
                    })
                }
            });
        });
        return Promise.all(sqlGeneratePromiseArr)
            .then(resultArr => {
                console.log(' >> generate v2 reservation done');
                resultArr.forEach(v2Reservation => {
                    checkReservationPromiseArr.push(this.checkSameReservationExist(v2Reservation));
                });
                return Promise.all(checkReservationPromiseArr);})
            .then(checkArr => {
                console.log(' >> check v2 reservation done');
                checkArr.forEach(check => {
                    if (!check.result) {
                        insertReservationProsmieArr.push(Reservation.insertSQL(check.v2Reservation, {}));
                    } else {
                        console.log(`Pass - duplicate reservation : ${check.v2Reservation.message_id} --> ${check.data.id}`);
                    }
                });
                return Promise.all(insertReservationProsmieArr);
            })
    }

    static async convertAndInsertV1OperationToSQLWithOrder(v1OperationBulkData) {
        for (let temp0 of Object.entries(v1OperationBulkData)) {
            let date = temp0[0];
            let v1Operation = temp0[1];
            for (let temp1 of Object.entries(v1Operation)) {
                let v1ProductId = temp1[0];
                let v1Team = temp1[1].teams;
                if (v1Team) {
                    for (let temp2 of Object.entries(v1Team)) {
                        let v1TeamId = temp2[0];
                        let v1ReservationObj = temp2[1].reservations;
                        if (v1ReservationObj) {
                            for (let temp3 of Object.entries(v1ReservationObj)) {
                                let v1ReservationId = temp3[0];
                                let v1Reservation = temp3[1];
                                if (v1Reservation) {
                                    let v2Reservation = await v2ReservationConverter.generateSQLObject(v1Reservation, false);
                                    let checkDuplicate = await this.checkSameReservationExist(v2Reservation);
                                    if (!checkDuplicate.result) {
                                        let v2SQLReservation = await Reservation.insertSQL(v2Reservation, {});
                                        if (!v2SQLReservation) {
                                            this.taskManager('Error - 1', checkDuplicate.data.id, v1ReservationId, v1ProductId, v1Team, [], null, 'reservation insert to postgreSQL failed');
                                            return false;
                                        } else { this.taskManager('[1r]', v2SQLReservation.id, v1ReservationId, v1ProductId, v1TeamId, ['insertSQL'], 'success'); }
                                    } else { this.taskManager('Pass - 1', checkDuplicate.data.id, v1ReservationId, v1ProductId, v1TeamId, [], null, 'already same reservation exist in postgreSQL');}
                                }
                            }
                        }
                    }
                }
            }
        }
        console.log('all task done in convertAndInsertV1OperationToSQL');
        return true;
    }

    /**
     * convert v1 Operation data to Reservation data for firebase and Elastic search
     * @param v1OperationData {Object} v1 Operation data
     * @returns {Promise<[any, any, any, any, any, any, any, any, any, any] | never>}
     * @output {count : {v2 Reservation data}}
     */
    static convertFBElastic(v1OperationData) {
        const promiseArr = [];
        Object.keys(v1OperationData).forEach(date => {
            Object.keys(v1OperationData[date]).forEach(productId => {
                promiseArr.push(v2ReservationConverter.generateFbElasticObject(v1OperationData[date][productId], productId));
            });
        });
        return Promise.all(promiseArr).then(result => {
            const resultJSON = {};
            let i = 0;
            result.forEach(each => {resultJSON[i++] = (each)});
            return JSON.parse(JSON.stringify(resultJSON));
        });
    }

    static async insertElasticBulkData(v2ElasticBulkData) {
        for (let v2ElasticDataObj of Object.values(v2ElasticBulkData)) {
            for (let v2ElasticData of v2ElasticDataObj.elasticData) {
                let result = await Reservation.insertElastic(v2ElasticData, {});
                if (result) console.log(`  ${v2ElasticData.id} insert to Elastic success`);
                else console.log (`   error : ${v2ElasticData.id} insert to Elastic failed`);
            }
        }
    }

    /**
     * convert v1 Operation Data to v2 Reservation for firebase and insert to database
     * @param v1OperationData {Object} v1 Operation data
     * @returns {Promise<void | never>}
     */
    static convertAndInsertV1OperationToFB(v1OperationData) {
        const firebaseTaskArr = [];
        let data;
        let firebaseRemoveArr = [];
        Object.keys(v1OperationData).forEach(date => {
            firebaseRemoveArr.push(fbDB.ref('operation').child('date').remove());
        });
        return Promise.all(firebaseRemoveArr)
            .then(() => {
                return v2ReservationConverter.convertFBElastic(v1OperationData)})
            .then(result => {
                data = result;
                Object.keys(result).forEach(key => {
                    Object.keys(result[key].fbData).forEach(date => {
                        firebaseTaskArr.push(Reservation.insertFBforConvert(result[key].fbData[date], date));
                    })
                });
                return Promise.all(firebaseTaskArr)})
            .then(finalResult => {
                if (!finalResult.includes(false)) {
                    return this.insertElasticBulkData(data);
                };
            });
    }

    static checkSameReservationExist(v2Reservation) {
        return new Promise((resolve, reject) => {
            const text = reservationQueryProcessing(v2Reservation);
            const query = `SELECT id FROM reservation WHERE ${text}`;
            sqlDB.query(query, (err, result) => {
                if (err) resolve(console.log('checkSameReservationExist error : ', JSON.stringify(err)));
                resolve({
                    result : result.rowCount > 0,
                    data : result.rows[0],
                    v2Reservation : v2Reservation
                });
            })
        })
    }

    static taskManager(type, v2ReservationId, v1ReservationId, v1product, team, reservationTask, message, error) {
        const result = {
            type : type,
            v2_r_id: v2ReservationId,
            v1_product: v1product,
            team: team,
            reservation_task: reservationTask || [],
            message: message || '',
            error: error || null
        };
        console.log(`  >> (task) : ${JSON.stringify(result)}`);
        return result;
    }

    /**
     * main converter
     * @param v1OperationData {Object} v1 Operation data object
     * @returns {Promise<void>}
     */
    static async mainConverter(v1OperationData) {
        //     const taskObj = {};
    //     for (let temp0 of Object.entries(v1OperationData)) {
    //         let date = temp0[0];
    //         let v1Operation = temp0[1];
    //         for (let temp1 in Object.entries(v1Operation)) {
    //             let v1ProductId = temp1[0];
    //             let v1Product = temp1[1];
    //             if (v1Product.teams) {
    //                 for (let temp2 of Object.entries(v1Product.teams)) {
    //                     let v1TeamId = temp2[0];
    //                     let v1Team = temp2[1];
    //                     if (v1Team.reservations) {
    //                         for (let temp3 of Object.entries(v1Team.reservations)) {
    //                             let v1ReservationId = temp3[0];
    //                             let v1Reservation = temp3[1];
    //                             let v2Reservation = await this.generateSQLObject(v1Reservation, false);
    //                             let sqlCheck = this.checkSameReservationExist(v2Reservation);
    //                             if (sqlCheck.result) this.taskManager('Pass - 1', sqlCheck.data.id, v1ReservationId, v1ProductId, v1TeamId, [], null,'already same reservation exist in postgreSQL');
    //                             else {
    //                                 let v2SQLReservation = await Reservation.insertSQL(v2Reservation, {});
    //                                 let v2FbData = await this.generateSimpleFbData(date, v1ProductId, v1TeamId, v1ReservationId, v1Reservation, v2SQLReservation);
    //                                 await Reservation.insertFB(v2FbData.reservation, v2FbData.data, {});
    //                                 let v2ElasticData =
    //                                 await Reservation.insertElastic()
    //                             }
    //                         }
    //                     }
    //                 }
    //             }
    //         }
    //     }
        console.log(' >> SQL process');
        let isSQLDataInsertSuccess = await this.convertAndInsertV1OperationToSQLBulk(v1OperationData);
        if (!isSQLDataInsertSuccess) return console.log('SQL data insert failed!');
        console.log(' >> FB / Elastic process');
        let isFbElasticDataInsertSuccess =  await this.convertAndInsertV1OperationToFB(v1OperationData);
        if (!isFbElasticDataInsertSuccess) return console.log('FB / Elastic data insert failed!');
        return console.log('SQL / FB / Elastic data insert done!');
    }

    /**
     * convert v1 Operation Data to v2 Reservation for elasticSearch and write file to output path.
     * @param v1OperationData {Object} v1 Operation data
     * @param outputFilePath {String} output file path
     * @returns {Promise<any[] | never | never>}
     */
    static convertElasticToFile(v1OperationData, outputFilePath) {
        const elasticData = {};
        return v2ReservationConverter.convertFBElastic(v1OperationData)
            .then(result => {
                Object.keys(result).forEach(key => {
                    result[key].elasticData.forEach(reservation => {
                        elasticData[reservation.id] = reservation;
                    });
                });
                return writeFile(outputFilePath, elasticData, 'function : convertElasticToFile')
            })
    }
}

/**
 * file write
 * @param filePath {String} example : 'server/models/dataFiles/temporaryV2ReservationElasticFBData.json'
 * @param object {Object} object
 */
function writeFile(filePath, object, message) {
    return fs.writeFile(filePath, JSON.stringify(object), err => {
        if (err) console.log(`error : ${JSON.stringify(err)}`);
        else console.log(`done : ${message}`)
    });
}

function reservationQueryProcessing(object) {
    let result = "";
    Object.keys(object).forEach(key => {
        value = object[key];
        if (CHECK_RESERVATION_KEY_MAP.includes(key)) {
            if (typeof value === 'object') { result += (key + ' = ' + "'" + JSON.stringify(value) + "'" + " and ")}
            else if (typeof value === 'number') { result += (key + ' = ' + value + " and ")}
            else if (typeof value === 'boolean' || key === 'canceled') { result += (key + ' = ' + Boolean(value) + " and ")}
            else { result += (key + ' = ' + "'" + value + "'" + " and ")}
        }
    });
    return result.slice(0,-5);
}

function deleteFirebaseData(){
    for (let day=1; day<=31; day++) {
        let date = '2019-07-' + day;
        if (day < 10) date = '2019-07-0' + day;
        fbDB.ref('operation').child(date).remove(err => {
            if (err) console.log('error : ',JSON.stringify(err));
            else console.log('success');
        })
    }
}
// sqlDB.query(`SELECT * FROM reservation WHERE id = 'r1734'`, (err,result) => {
//     console.log(result.rows[0]);
//     let text = reservationQueryProcessing(result.rows[0]);
//     console.log(text);
//     const query = `SELECT * FROM reservation WHERE ${text}`;
//     sqlDB.query(query, (err, result) => {
//         if(err) console.log('error : ',JSON.stringify(err))
//         console.log('final result : ',result);
//     })
// })

// let result = v2ReservationConverter.mainConverter(require('../testFiles/v1OperationData_2019_July'));
// deleteFirebaseData()
// v2ReservationConverter.convertElasticToFile(require('../testFiles/v1OperationData_2019_July'), 'server/models/dataFiles/v2ConvertedElasticData.json')
//     .then(result => console.log('result : ',result));

module.exports = v2ReservationConverter;

