const Product = require('../../models/product');
const v2ReservationConverter = require('./reservationConverter');
const Reservation = require('../../models/reservation');
const Account = require('../../models/account');
const sqlDB = require('../../auth/postgresql');
const fs = require('fs');
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

class v2AccountConverter {
    constructor(v1Data) {
        this.data = v1Data;
    }

    static generateSQLObjectForNonReservation(v1Data) {
        return new Promise((resolve, reject) => {
            const result = {
                writer: v1Data.writer || v1Data.agency,
                category: v1Data.category || '',
                currency: v1Data.currency,
                income: 0,
                expenditure: 0,
                cash: false,
                memo: v1Data.detail,
                created_date: v1Data.date,
                reservation_id: null
            };
            if (!!v1Data.cash && v1Data.cash !== 0) {
                result.cash = true;
                if (v1Data.cash < 0) result.expenditure = (-1) * v1Data.cash;
                else result.income = v1Data.cash;
            } else {
                if (v1Data.card < 0) result.expenditure = (-1) * v1Data.card;
                else result.income = v1Data.card;
            }
            if (v1Data.identifier) result.memo += ` identifier : ${v1Data.identifier}`;
            resolve(result);
        });
    }

    static generateSQLObject(v1Data, v2Reservation) {
        const result = {
            writer: v1Data.writer || v1Data.agency,
            category: v1Data.category || 'Reservation',
            currency: v1Data.currency,
            income: 0,
            expenditure: 0,
            cash: false,
            memo: v1Data.detail,
            created_date: Product.getLocalDate(v1Data.detail.split(' ')[1].split('\n')[0], 'UTC+9') || v1Data.date,
            reservation_id: null
        };
        if (!!v1Data.cash && v1Data.cash !== 0) {
            result.cash = true;
            if (v1Data.cash < 0) result.expenditure = (-1) * v1Data.cash;
            else result.income = v1Data.cash;
        } else if (!!v1Data.card && v1Data.card !== 0){
            if (v1Data.card < 0) result.expenditure = (-1) * v1Data.card;
            else result.income = v1Data.card;
        }
        return new Promise((resolve, reject) => {
            if (v2Reservation) {
                result.reservation_id = v2Reservation.id;
                result.created_date = v2Reservation.created_date;
                resolve(result);
            } else {
                const query = `SELECT id FROM reservation WHERE message_id = '${v1Data.id}'`;
                sqlDB.query(query, (err, queryResult) => {
                    if (err) {
                        console.log('error occured!', JSON.stringify(err));
                        resolve(false);
                    }
                    result.reservation_id = queryResult.rows[0].id;
                    resolve(result);
                })
            }
        });


        return new Promise((resolve, reject) => {
            sqlDB.query(query, (err, result) => {
                if (err) {
                    console.log('error occured!', JSON.stringify(err));
                    resolve(false);
                }
                resolve(result.rows[0].id)
            })
        })
            .then(v2ReservationId => {
                if (!v2ReservationId) return false;

            })
    }

    static generateElasticObject(v2SqlAccount, v2Reservation) {
        return v2AccountConverter.findProductWithAccount(v2SqlAccount.id)
            .then((product => {
                return {
                    id: v2SqlAccount.id,
                    writer: v2SqlAccount.writer,
                    category: v2SqlAccount.category || 'Reservation',
                    date : v2Reservation.tour_date,
                    currency: v2SqlAccount.currency,
                    income: v2SqlAccount.income,
                    expenditure: v2SqlAccount.expenditure,
                    cash: v2SqlAccount.cash,
                    memo: v2SqlAccount.detail,
                    created_date: v2SqlAccount.created_date,
                    reservation: {
                        id: v2Reservation.id,
                        agency: v2Reservation.agency,
                        agency_code: v2Reservation.agency_code,
                        tour_date: v2Reservation.tour_date,
                        nationality: v2Reservation.nationality,
                        adult: v2Reservation.adult,
                        kid: v2Reservation.kid,
                        infant: v2Reservation.infant,
                        total: v2Reservation.adult + v2Reservation.kid + v2Reservation.infant,
                        product: {
                            name: product.name,
                            alias: product.alias,
                            category: product.category,
                            area: product.area
                        },
                        options: v2Reservation.options
                    }
                };
            }))
    }

    static generateElasticObjectForNonReservation(v2SqlAccount) {
        return {
            id: v2SqlAccount.id,
            writer: v2SqlAccount.writer || '',
            category: v2SqlAccount.category || '',
            date : v2SqlAccount.created_date,
            currency: v2SqlAccount.currency,
            income: v2SqlAccount.income,
            expenditure: v2SqlAccount.expenditure,
            cash: v2SqlAccount.cash,
            memo: v2SqlAccount.detail,
            created_date: v2SqlAccount.created_date,
            reservation: {}
        };
    }

    static findProductWithAccount(account_id) {
        return new Promise((resolve, reject) => {
            const output = 'product.name, product.category, product.alias, product.area';
            const query = `SELECT ${output} FROM product, reservation, account WHERE account.id = '${account_id}' and account.reservation_id = reservation.id and reservation.product_id = product.id`;
            sqlDB.query(query, (err, result) => {
                if (err) resolve(console.log('error : ', JSON.stringify(err)));
                resolve(result.rows[0]);
            });
        })
    }

    static getV2SqlReservations(message_id) {
        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM reservation WHERE message_id = '${message_id}'`;
            sqlDB.query(query, (err, result) => {
                if (err) resolve(console.log(`error : ${JSON.stringify(err)}`));
                resolve(result.rows);
            })
        });
    }

    static getV2SqlProduct(v1Product) {
        let product = v1Product.split('_')[2];
        if (V1_V2_PRODUCT_EXCEPTIONAL_NAME_MAP.has(v1Product)) product = V1_V2_PRODUCT_EXCEPTIONAL_NAME_MAP.get(v1Product);
        return Product.getProduct(product);
    }

    static getV2SqlAccountWithReservation(reservationId) {
        return new Promise((resolve, reject) => {
            const output = 'account.id, account.income, account.expenditure, account.cash, account.currency, reservation.message_id';
            const query = `SELECT ${output} FROM account, reservation WHERE reservation.id = '${reservationId}' and reservation.id = account.reservation_id`;
            sqlDB.query(query, (err, result) => {
                if (err) resovle(console.log(`error : ${JSON.stringify(err)}`));
                resolve(result.rows);
            })
        })
    }

    /**
     * check if same account is already exist in postgreSQL with message_id, income / expenditure, writer, cash.
     * @param v1Account {Object} v1 account object
     * @param v1Sales {Number} amount of sales of
     * @param cash
     * @returns {Promise<any>}
     */
    static checkIdenticalAccountExist(v1Account, v1Sales, cash) {
        return new Promise((resolve, reject) => {
            const compare = v1Sales > 0 ? 'account.income' : 'account.expenditure';
            if (v1Sales < 0) v1Sales *= (-1);
            const query = `SELECT account.id FROM account, reservation WHERE reservation.message_id = '${v1Account.id}' and account.writer = '${v1Account.writer}' and account.cash = ${cash} and ${compare} = ${v1Sales} and account.reservation_id = reservation.id`;
            sqlDB.query(query, (err, result) => {
                if (err) resolve(console.log('error : ', JSON.stringify(err)));
                // console.log(v1Account.id, result.rows, query);
                resolve(result.rowCount > 0);
            })
        })
    }

    static async v1v2AccountSales(v1Account, v2Account) {
        let tempV1Sales, tempV2Sales, v1Sales, v2Sales;
        let v1Cash = false;
        if (!v1Account.card) {
            if (!v1Account.cash) v1Sales = 0;
            else v1Sales = Number(v1Account.cash);
        } else if (!v1Account.cash) {
            if (!v1Account.card) v1Sales = 0;
            else v1Sales = Number(v1Account.card);
        } else {
            if (Number(v1Account.card) === 0) v1Sales = Number(v1Account.cash);
            else if (Number(v1Account.cash) === 0) v1Sales = Number(v1Account.card);
            else console.log('wrong sales!!!!');
        }
        tempV1Sales = v1Sales;
        if (v1Sales < 0) v1Sales *= (-1);
        if (Number(v2Account.income) === 0) v2Sales = Number(v2Account.expenditure) * (-1);
        else v2Sales = Number(v2Account.income);
        tempV2Sales = v2Sales;
        if (v2Sales < 0) v2Sales *= (-1);
        return {
            match: v1Sales === v2Sales && v1Account.currency === v2Account.currency,
            identical : await this.checkIdenticalAccountExist(v1Account, tempV1Sales, v1Cash),
            v1: tempV1Sales,
            v2: tempV2Sales,
            v1Currency : v1Account.currency,
            v2Currency : v2Account.currency
        };
    }

    static async accountCreateAndInsert(v1Account, v2Reservation, isReservation) {
        let v2Account, v2SqlAccount, v2ElasticAccount;
        if (isReservation) {
            v2Account = await this.generateSQLObject(v1Account, v2Reservation);
            v2SqlAccount = await Account.insertSQL(v2Account, {});
            v2ElasticAccount = await this.generateElasticObject(v2SqlAccount, v2Reservation);
            await Account.insertElastic(v2ElasticAccount, {});
        } else {
            v2Account = await this.generateSQLObjectForNonReservation(v1Account);
            let isSameAccountExist = await this.checkNonReservationAccountExist(v2Account);
            if (!isSameAccountExist) {
                v2SqlAccount = await Account.insertSQL(v2Account, {});
                v2ElasticAccount = await this.generateElasticObjectForNonReservation(v2SqlAccount);
                await Account.insertElastic(v2ElasticAccount, {});
            } else {
                v2SqlAccount = {id : null}
            }
        }
        return v2SqlAccount.id;
    }

    static async reservationCreateAndInsert(v1CanceledData, v2Product, canceled) {
        let v2Reservation = await v2ReservationConverter.generateSQLObject(v1CanceledData, canceled);
        let v2SQLReservation = await Reservation.insertSQL(v2Reservation, {});
        let v2ElasticReservation = await v2ReservationConverter.elasticDataMatch(v1CanceledData, v2Product, v2SQLReservation);
        await Reservation.insertElastic(v2ElasticReservation, {});
        return v2SQLReservation;
    }

    static async mainConverter(v1AccountBulkData, v1CanceledBulkData) {
        const taskObj = {error: {}};
        let totalCount = 0;
        let reservationCreateCount = 0;
        let accountCreateCount = 0;
        for (let key of Object.keys(v1AccountBulkData)) {
            totalCount += 1;
            let v1Account = v1AccountBulkData[key];
            if (v1Account.category === 'reservation' || v1Account.category === 'Reservation') {
                let messageId = v1Account.id;
                let v2ReservationArr = await this.getV2SqlReservations(messageId);
                if (v2ReservationArr.length > 0) {
                    if (v2ReservationArr.length > 1) {
                        let v1CanceledData = v1CanceledBulkData[messageId];
                        if (!v1CanceledData) {taskObj.error[messageId] = await this.taskManager('Pass - 1', v2ReservationArr[0].id, null, messageId, [], [], null, `no matching canceled data`);}
                        else {
                            let v2AccountObj = {canceled:{}, normal:{}, alreadyExist : false};
                            let v2ReservationObj = {canceled:{}, normal:{}};
                            let v2AccountMakeForEmptySQL = false;
                            let matchCount = 0;
                            // console.log('(3ra) v2ReservationArr : ', messageId, v2ReservationArr.map(data=>[data.id,data.canceled]));
                            for (let v2Reservation of v2ReservationArr) {
                                if (v2Reservation.canceled === true) {
                                    let tempV2AccountArr = await this.getV2SqlAccountWithReservation(v2Reservation.id);
                                    if (tempV2AccountArr.length === 0) {
                                        // (1a) : 하나의 message Id 에 여러개의 reservation Id가 존재. 취소된 예약에 회계정보가 없는 경우 회계 생성
                                        let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                        v2AccountMakeForEmptySQL = true;
                                        taskObj[v2AccountId] = await this.taskManager('[1a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL, insertElastic'], `success - ${v1Account.category} : [multiple reservation] 1 canceled reservation with no account + alpha (canceled/non-canceled) reservation exist --> 1 account for canceled reservation insert`);
                                        accountCreateCount += 1;
                                    } else {
                                        // console.log('(3ra) tempV2AccountArr : ',tempV2AccountArr.map(data=>data.id))
                                        for (let v2Account of tempV2AccountArr) {
                                            let accountSales = await this.v1v2AccountSales(v1Account, v2Account);
                                            // console.log('(3ra) ',v2Account.id, v2Account.income, v2Account.expenditure, JSON.stringify(accountSales));
                                            if (accountSales.match && accountSales.identical && accountSales.v1 === accountSales.v2) v2AccountObj.alreadyExist = true;
                                            else if (accountSales.match && !accountSales.identical && accountSales.v1 === accountSales.v2 * (-1)) {
                                                    v2AccountObj.canceled.obj = v2Account;
                                                    v2AccountObj.canceled.reservation = v2Reservation;
                                                    matchCount += 1;
                                                }}}
                                } else {
                                    v2ReservationObj.normal = v2Reservation;
                                    let v2AccountArr = await this.getV2SqlAccountWithReservation(v2Reservation.id);
                                    if (v2AccountArr.length > 0) {taskObj.error[messageId] = await this.taskManager('Pass - 2',v2Reservation.id, v2AccountArr[0].id, messageId, [], [], null, `already account exist in non-canceled reservation`);}
                                    else {taskObj.error[messageId] = await this.taskManager('Pass - 3',v2Reservation.id, null, messageId, [], [], null, `no account exist in non-canceled reservation`);
                                    }}}
                            if (v2AccountObj.canceled.reservation) {
                                if (matchCount > 1) {taskObj.error[messageId] = await this.taskManager('Pass - 4',v2AccountObj.canceled.reservation.id, null, messageId, [], [], null, `multiple identical account information exist in non-canceled reservation. matchCount : ${matchCount}`);}
                                else {
                                    // (2a) : 하나의 message Id 에 여러개의 reservation Id가 존재. 특정 취소된 reservation 에 회계 정보가 1개 있고, 그에 reverse 관계인 회계가 생성되는 case.
                                    let v2AccountId = await this.accountCreateAndInsert(v1Account, v2AccountObj.canceled.reservation, true);
                                    taskObj[v2AccountId] = await this.taskManager('[2a]',v2AccountObj.canceled.reservation.id, v2AccountId, messageId, [], ['insertSQL, insertElastic'], `success - ${v1Account.category} : [multiple reservation] 1 canceled reservation / 1 account + 1 (canceled/non-canceled) reservation exist --> 1 reversed account for canceled reservation insert`);
                                    accountCreateCount += 1;
                                }
                            } else {
                                if (v2AccountObj.alreadyExist) taskObj[messageId] = await this.taskManager('Pass - 5',v2ReservationArr.map(data=>data.id), null, messageId, [], [], null, 'already account exist in canceled reservation');
                                else if (!v2AccountMakeForEmptySQL) {
                                    // (3ra) : 하나의 message Id 에 여러개의 reservation Id가 존재. 존재하는 reservation의 sales와 일치하는 것이 없기 때문에 새로운 취소 예약 + 회계 생성 (canceled 아닌 Reservation은 이미 SQL에 존재하는 것을 전제)
                                    let v2Product = await this.getV2SqlProduct(v1CanceledData.product);
                                    let v2SQLReservation = await this.reservationCreateAndInsert(v1CanceledData, v2Product, true);
                                    let v2AccountId = await this.accountCreateAndInsert(v1Account, v2SQLReservation, true);
                                    taskObj[v2AccountId] = await this.taskManager('[3ra]',v2SQLReservation.id, v2AccountId, messageId, ['insertSQL, insertElastic'], ['insertSQL, insertElastic'], `success - ${v1Account.category} : [multiple reservation] new canceled reservation + account insert`);
                                    reservationCreateCount += 1;
                                    accountCreateCount += 1;
                                }}}
                    } else {
                        let v2Reservation = v2ReservationArr[0];
                        let v2AccountArr = await this.getV2SqlAccountWithReservation(v2Reservation.id);
                        if (v2Reservation.canceled === true) {
                            let v1CanceledData = v1CanceledBulkData[messageId];
                            if (!v1CanceledData) {taskObj.error[messageId] = await this.taskManager('Pass - 6',v2Reservation.id, v2AccountArr[0].id, messageId, [], [], null, `no matching canceled data`);}
                            else {
                                let v2Product = await this.getV2SqlProduct(v1CanceledData.product);
                                if (!v2Product) {taskObj.error[messageId] = await this.taskManager('Pass - 7',v2Reservation.id, v2AccountArr[0].id, messageId, [], [], null, `no matching v2 Product in SQL. v1 Product : ${v1CanceledData.product}`);}
                                else {
                                    if (v2AccountArr.length === 1) {
                                        let accountSales = await this.v1v2AccountSales(v1Account, v2AccountArr[0]);
                                        if (accountSales.match) {
                                            if (accountSales.v1 === accountSales.v2) {taskObj.error[messageId] = await this.taskManager('Pass - 8',v2Reservation.id, v2AccountArr[0].id, messageId, [], [], null, `duplicated account exist`);}
                                            else {
                                                // (4a) : 취소된 예약에 이미 1개의 회계가 존재하고, reverse 회계를 넣는 case
                                                let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                                taskObj[v2AccountId] = await this.taskManager('[4a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category} : [single reservation] 1 canceled reservation / 1 account exist --> 1 reversed account insert`);
                                                accountCreateCount += 1;
                                            }
                                        } else {
                                            // (5ra) : 취소된 예약에 이미 1개의 회계가 존재하는데, sales 정보가 달라서 새로운 취소 예약 + 회계를 만드는 case
                                            let v2SQLReservation = await this.reservationCreateAndInsert(v1CanceledData, v2Product, true);
                                            let v2AccountId = await this.accountCreateAndInsert(v1Account, v2SQLReservation, true);
                                            taskObj[v2AccountId] = await this.taskManager('[5ra]',v2SQLReservation.id, v2AccountId, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category} : [single reservation] 1 canceled reservation / 1 account exist --> another canceled reservation + account insert`);
                                            reservationCreateCount += 1;
                                            accountCreateCount += 1;
                                        }
                                    } else {
                                        let v2Account;
                                        for (let tempV2Account of v2AccountArr) {
                                            let accountSales = await this.v1v2AccountSales(v1Account, tempV2Account);
                                            if (!accountSales.match) v2Account = tempV2Account;
                                        }
                                        if (!v2Account) {taskObj.error[messageId] = await this.taskManager('Pass - 9',v2Reservation.id, [v2AccountArr[0].id, v2AccountArr[0].id], messageId, [], [], null, `already two account exist in one canceled reservation`);}
                                        else {
                                            // (6ra) : 취소된 예약에 이미 2개의 서로 reverse관계인 회계가 존재하는데, sales 정보가 달라서 새로운 취소 예약 + 회계를 만드는 case
                                            let v2SQLReservation = await this.reservationCreateAndInsert(v1CanceledData, v2Product, true);
                                            let v2AccountId = await this.accountCreateAndInsert(v1Account, v2SQLReservation, true);
                                            taskObj[v2AccountId] = await this.taskManager('[6ra]',v2SQLReservation.id, v2AccountId, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category} : [single reservation] 1 canceled reservation / 2 account exist --> another canceled reservation + account insert`)
                                            reservationCreateCount += 1;
                                            accountCreateCount += 1;
                                        }
                                    }
                                }
                            }
                        } else {
                            if (v2AccountArr.length > 0) {taskObj.error[v2AccountArr[0].id] = await this.taskManager('Pass - 10',v2Reservation.id, v2AccountArr[0].id, messageId, [], [], null, `account already exists in non-canceled reservation. number of account in message id ${messageId} : ${v2AccountArr.length}`);}
                            else {
                                // (7a) : 가장 일반적인 루트(canceled 되지 않은 reservation에 대한 account 생성) . SQL database에 업데이트 하는 순서가 reservation --> account이기 때문에 정상 예약이라도 account가 없는 경우가 있음.
                                let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                taskObj[v2AccountId] = await this.taskManager('[7a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category} : [single reservation] 1 non-canceled reservation exist --> corresponding account insert`);
                                accountCreateCount += 1;
                            }
                        }
                    }
                } else {
                    let v1CanceledData = v1CanceledBulkData[messageId];
                    if (!v1CanceledData) {taskObj.error[messageId] = await this.taskManager('Pass - 11',null, null, messageId, [], [], null, `no matching v2 Reservation in SQL, no matching canceled Data`);}
                    else {
                        let v2Product = await this.getV2SqlProduct(v1CanceledData.product);
                        if (!v2Product) {taskObj.error[messageId] = await this.taskManager('Pass - 12',null, null, messageId, [], [], null, `no matching v2 Product in SQL. v1 Product : ${v1CanceledData.product}`);}
                        else {
                            // (8ra) : 두번째로 일반적인 루트(canceled 된 reservation + account 생성). message id 에 대응하는 reservation이 SQL에 존재하지 않고 canceled Data가 존재할 때 취소된 reservation + account를 생성.
                            let v2SQLReservation = await this.reservationCreateAndInsert(v1CanceledData, v2Product, true);
                            let v2AccountId = await this.accountCreateAndInsert(v1Account, v2SQLReservation, true);
                            taskObj[v2AccountId] = await this.taskManager('[8ra]',v2SQLReservation.id, v2AccountId.id, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category} : no reservation in SQL --> canceled reservation + account insert`);
                            reservationCreateCount += 1;
                            accountCreateCount += 1;
                        }
                    }
                }
            } else {
                // (9a) : 예약이 아닌 회계에 대해서 converting 회계 생성
                let v2AccountId = await this.accountCreateAndInsert(v1Account, null, false);
                if (!v2AccountId) {
                    let memo = v1Account.identifier ? v1Account.detail + ' identifier : ' + v1Account.identifier : v1Account.detail
                    taskObj.error[key] = await this.taskManager('Pass - 13',null, null, null, [], [], null, `already same non-reservation account exist in postgreSQL. memo : ${memo}`);
                } else {
                    taskObj[v2AccountId] = this.taskManager('[9a]',null, v2AccountId, null, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category} : only account for non-reservation insert`);
                    accountCreateCount += 1;
                }
            }
        }
        console.log('all task done! : ', {totalCount:totalCount, reservationCreateCount : reservationCreateCount, accountCreateCount : accountCreateCount});
    }

    static checkNonReservationAccountExist(v2Account) {
        return new Promise((resolve, reject) => {
           const query = `SELECT * FROM account WHERE category = '${v2Account.category}' and memo = '${v2Account.memo}' and writer = '${v2Account.writer}'`;
           sqlDB.query(query, (err, result) => {
              if (err) resolve(console.log('error : ',JSON.stringify(err)));
              resolve(result.rowCount > 0);
           });
        });
    }

    static taskManager(type, v2ReservationId, v2AccountId, message_id, reservationTask, accountTask, message, error) {
        const result = {
            type : type,
            v2_r_id: v2ReservationId,
            v2_a_id: v2AccountId,
            v1_id: message_id,
            reservation_task: reservationTask || [],
            account_task: accountTask || [],
            message: message || '',
            error: error || null
        };
        console.log(`  >> (task) : ${JSON.stringify(result)}`);
        return result;
    }
}

const v1Account_2019_July = require('../testFiles/v1AccountData_2019_July.json');
const v1CanceledBulkDataData = require('../testFiles/intranet-64851-canceled-export.json');
let result = v2AccountConverter.mainConverter(v1Account_2019_July, v1CanceledBulkDataData);
// console.log(result);
// let result = v2AccountConverter.convertAndInsertV1AccountToSQLandElastic(v1Account_2019_July, v1CanceledData, v1Operation_2019_July, elasticPath);
// console.log(result);
// v2AccountConverter.findProductWithAccount('a1553').then(result => console.log(result))
