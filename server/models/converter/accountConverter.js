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
    ['Busan_Private_PRIVATE', '부산프라이빗'],
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
        this.totalCount = 0;
        this.passCount = 0;
        this.reservationCreateCount = 0;
        this.accountCreateCount = 0;
    }

    static generateSQLObjectForNonReservation(v1Data) {
        return new Promise((resolve, reject) => {
            const result = {
                writer: v1Data.writer || v1Data.agency,
                category: v1Data.category || '',
                sub_category : '',
                contents : '',
                card_number : '',
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
            sub_category : '',
            contents : '',
            card_number : '',
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
    }

    static generateElasticObject(v2SqlAccount, v2Reservation) {
        return v2AccountConverter.findProductWithAccount(v2SqlAccount.id)
            .then((product => {
                const result = {
                    id: v2SqlAccount.id,
                    writer: v2SqlAccount.writer,
                    category: v2SqlAccount.category || 'Reservation',
                    sub_category : '',
                    contents : '',
                    date : v2Reservation.tour_date,
                    currency: v2SqlAccount.currency,
                    income: v2SqlAccount.income,
                    expenditure: v2SqlAccount.expenditure,
                    cash: v2SqlAccount.cash,
                    memo: v2SqlAccount.detail,
                    memo_history : [],
                    card_number : '',
                    created_date: v2SqlAccount.created_date,
                    star : false,
                    reservation: {
                        id: v2Reservation.id,
                        agency: v2Reservation.agency,
                        agency_code: v2Reservation.agency_code,
                        tour_date: v2Reservation.tour_date,
                        nationality: v2Reservation.nationality.toUpperCase(),
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
                    },
                    operation : {
                        teamId : '',
                        guide : '',
                        messages : []
                    }
                };
                if (!!result.memo) {
                    result.memo_history.push({
                        writer : result.writer,
                        memo : result.memo,
                        date : v2SqlAccount.created_date
                    })
                }
                return result;
            }))
    }

    static generateElasticObjectForNonReservation(v2SqlAccount) {
        const result = {
            id: v2SqlAccount.id,
            writer: v2SqlAccount.writer || '',
            category: v2SqlAccount.category || '',
            sub_category : '',
            contents : '',
            card_number : '',
            star : false,
            date : v2SqlAccount.created_date,
            currency: v2SqlAccount.currency,
            income: v2SqlAccount.income,
            expenditure: v2SqlAccount.expenditure,
            cash: v2SqlAccount.cash,
            memo: v2SqlAccount.detail,
            memo_history : [],
            created_date: v2SqlAccount.created_date,
            reservation: {},
            operation : {}
        };
        if (!!result.memo) {
            result.memo_history.push({
                writer : result.writer,
                memo : result.memo,
                date : v2SqlAccount.created_date
            })
        }
        return result;
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
            const query = `SELECT account.id FROM account, reservation WHERE reservation.message_id = '${v1Account.id}' and account.writer = '${v1Account.writer}' and account.cash = ${cash} and ${compare} = ${v1Sales} and account.reservation_id = reservation.id and account.memo = '${v1Account.detail}'`;
            sqlDB.query(query, (err, result) => {
                if (err) resolve(console.log('error : ', JSON.stringify(err)));
                // console.log(v1Account.id, result.rows, query);
                resolve(result.rows.length > 0);
            })
        })
    }

    static async v1v2AccountSales(v1Account, v2Account) {
        if (!v2Account) return {match:false, identical: false};
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
        let identical_result = await this.checkIdenticalAccountExist(v1Account, tempV1Sales, v1Cash);
        return {
            match: ((v1Sales === v2Sales) && (tempV1Sales === (tempV2Sales * (-1))) && (v1Account.currency === v2Account.currency)),
            identical : identical_result,
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
    
    static async reservationCancelSQLandElastic(v2Reservation) {
        await Reservation.cancelSQL(v2Reservation.id, {});
        await Reservation.cancelElastic(v2Reservation.id, {});
        return true;
    }
    
    static async reservationCreateAndInsert(v1CanceledData, v2Product, canceled, v2NewReservation) {
        // 취소된 예약은 firebase에 넣어 줄 필요가 없다.
        let v2SQLReservation;
        if (!v1CanceledData && v2NewReservation) {
            let v2Reservation = v2NewReservation;
            let v2ExistElasticReservation = await Reservation.searchElastic({id:v2Reservation.id});
            v2Reservation.canceled = canceled;
            v2Reservation.created_date = Product.getLocalDate(new Date(), 'UTC+9');
            v2Reservation.modified_date = Product.getLocalDate(new Date(), 'UTC+9');
            if (v2Reservation.id) delete v2Reservation.id;
            v2SQLReservation = await Reservation.insertSQL(v2Reservation, {});
            let v2ElasticReservation = await v2ReservationConverter.elasticDataMatch(null, v2Product, v2SQLReservation, v2ExistElasticReservation);
            await Reservation.insertElastic(v2ElasticReservation, {});
        } else {
            let v2Reservation = await v2ReservationConverter.generateSQLObject(v1CanceledData, canceled);
            v2SQLReservation = await Reservation.insertSQL(v2Reservation, {});
            let v2ElasticReservation = await v2ReservationConverter.elasticDataMatch(v1CanceledData, v2Product, v2SQLReservation, null);
            await Reservation.insertElastic(v2ElasticReservation, {});
        }
        return v2SQLReservation;
    }
    
    static async multipleReservationProcess(v1Account, v2ReservationArr) {
        const obj = {fullAccount : {}, emptyAccountReservation : [], reverse : false, reverseObj : {}, identical : false, identicalObj : {}};
        for (let v2Reservation of v2ReservationArr) {
            let v2AccountArr = await this.getV2SqlAccountWithReservation(v2Reservation.id);
            if (v2AccountArr.length === 0) {obj.emptyAccountReservation.push(v2Reservation)}
            else if (v2AccountArr.length === 2) {obj.fullAccount[v2Reservation.id] = {v2Reservation :v2Reservation, v2AccountArr : v2AccountArr}}
            for (let v2Account of v2AccountArr) {
                let accountSales = await this.v1v2AccountSales(v1Account, v2Account);
                if (accountSales.match) {
                    if (accountSales.identical) {
                        obj.identicalObj = true;
                        obj.identicalObj = {v2ReservationId : v2Reservation.id, v2AccountId : v2Account.id};
                    } else {
                        obj.reverse = true;
                        obj.reverseObj = {v2Reservation : v2Reservation, v2Account : v2Account};
                    }
                }
            }
        }
        return obj;
    }
    
    static async mainConverter(v1AccountBulkData, v1CanceledBulkData) {
        this.totalCount = 0;
        this.passCount = 0;
        this.reservationCreateCount = 0;
        this.accountCreateCount = 0;
        const taskObj = {error: {}};
        for (let temp of Object.entries(v1AccountBulkData)) {
            let date = temp[0];
            let v1AccountObj = temp[1];
            for (let v1Account of Object.values(v1AccountObj)) {
                let minus_v1Account = (!!v1Account.card && v1Account.card < 0) || (!!v1Account.cash && v1Account.cash < 0);
                let messageId = v1Account.id;
                if (v1Account.category === 'reservation' || v1Account.category === 'Reservation') {
                    let v1CanceledData = v1CanceledBulkData[messageId];
                    let v2ReservationArr = await this.getV2SqlReservations(messageId);
                    if (!v1CanceledData) {
                        if (v2ReservationArr.length === 0) {taskObj.error[messageId] = await this.taskManager(this,'Pass - 1', null, null, messageId, [], [], null, `no matching canceled data && no reservation in SQL exist`)}
                        else if (v2ReservationArr.length === 1) {
                            let v2Reservation = v2ReservationArr[0];
                            let v2Product = await Product.getProduct(v2Reservation.product_id);
                            let v2AccountArr = await this.getV2SqlAccountWithReservation(v2Reservation.id);
                            if (v2AccountArr.length === 0) {
                                if (!v2Reservation.canceled) {
                                    if (minus_v1Account) {
                                        // (1ca) : v1Canceled data 없음 + 1개 SQL reservation 존재(canceled = false) + 관련 SQL account 없음 + v1 Account 정보가 (-)임 --> reservation canceled = true로 변경 + account 생성
                                        let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                        await this.reservationCancelSQLandElastic(v2Reservation);
                                        taskObj[v2AccountId] = await this.taskManager(this, '[1ca]',v2Reservation.id, v2AccountId, messageId, ['cancelSQL', 'cancelElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`)
                                    } else {
                                        // (2a) : v1Canceled data 없음 + 1개 SQL reservation 존재(canceled = false) + 관련 SQL account 없음 + v1 Account 정보가 (+) 임--> account만 생성
                                        let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                        taskObj[v2AccountId] = await this.taskManager(this, '[2a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`)
                                    }
                                } else {
                                    // (3a) : v1Canceled data 없음 + 1개 SQL reservation 존재(canceled = true) + 관련 SQL account 없음 --> account만 생성
                                    let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                    taskObj[v2AccountId] = await this.taskManager(this, '[3a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`)
                                }
                            } else {
                                if (v2Reservation.canceled) {
                                    if (v2AccountArr.length === 2) {
                                        let accountSales1 = await this.v1v2AccountSales(v1Account, v2AccountArr[0]);
                                        let accountSales2 = await this.v1v2AccountSales(v1Account, v2AccountArr[0]);
                                        if (accountSales1.match || accountSales2.match) {
                                            if (accountSales1.identical || accountSales2.identical) {taskObj.error[messageId] = await this.taskManager(this,'Pass - 2', v2Reservation.id, v2AccountArr.map(data=>data.id), messageId, [], [], null, `same account exist in SQL`);}
                                            else {taskObj.error[messageId] = await this.taskManager(this,'Pass - 3', v2Reservation.id, v2AccountArr.map(data=>data.id), messageId, [], [], null, `no identical account exist but two same account exist in SQL`);}
                                        } else {
                                            // (4ra) : v1Canceled data 없음 + 1개 SQL reservation 존재(canceled = true) + 관련 SQL account 2개 존재 + v1 Account가 존재하는 SQL account와 무관 --> reservation + account 생성 (canceled 정보는 account 정보에 따라 바뀜)
                                            let v2NewReservation = await JSON.parse(JSON.stringify(v2Reservation));
                                            let v2SQLReservation = await this.reservationCreateAndInsert(null, v2Product, minus_v1Account, v2NewReservation);
                                            let v2AccountId = await this.accountCreateAndInsert(v1Account, v2SQLReservation, true);
                                            taskObj[v2AccountId] = await this.taskManager(this, '[4ra]',v2Reservation.id, v2AccountId, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`)
                                        }
                                    } else {
                                        let accountSales = await this.v1v2AccountSales(v1Account, v2AccountArr[0]);
                                        if (accountSales.match) {
                                            if (accountSales.identical) {taskObj.error[messageId] = await this.taskManager(this,'Pass - 4', v2Reservation.id, v2AccountArr[0].id, messageId, [], [], null, `same account exist in SQL`);}
                                            else {
                                                // (5a) : v1Canceled data 없음 + 1개 SQL reservation 존재(canceled = true) + 관련 SQL account 1개 존재 + v1 Account가 reverse 관계 --> account 생성
                                                let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                                taskObj[v2AccountId] = await this.taskManager(this, '[5a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`)
                                            }
                                        } else {
                                            // (6ra) : v1Canceled data 없음 + 1개 SQL reservation 존재(canceled = true) + 관련 SQL account 1개 존재 + v1 Account가 존재하는 SQL account와 무관 + --> reservation + account 생성 (canceled 정보는 account 정보에 따라 바뀜)
                                            let v2NewReservation = await JSON.parse(JSON.stringify(v2Reservation));
                                            let v2SQLReservation = await this.reservationCreateAndInsert(null, v2Product, minus_v1Account, v2NewReservation);
                                            let v2AccountId = await this.accountCreateAndInsert(v1Account, v2SQLReservation, true);
                                            taskObj[v2AccountId] = await this.taskManager(this, '[6ra]',v2Reservation.id, v2AccountId, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`)
                                        }
                                    }
                                } else {
                                    if (v2AccountArr.length === 2) {taskObj.error[messageId] = await this.taskManager(this,'Pass - 5', v2Reservation.id, v2AccountArr[0].id, messageId, [], [], null, `two account exist in non-canceled reservation`);}
                                    else {
                                        let accountSales = await this.v1v2AccountSales(v1Account, v2AccountArr[0]);
                                        if (accountSales.match) {
                                            if (accountSales.identical) {taskObj.error[messageId] = await this.taskManager(this,'Pass - 6', v2Reservation.id, v2AccountArr[0].id, messageId, [], [], null, `same account exist in SQL`);}
                                            else {
                                                // (7ca) : v1Canceled data 없음 + 1개 SQL reservation 존재(canceled = false) + 관련 SQL account 1개 존재 + v1 Account가 존재하는 SQL account와 reverse 관계 --> reservation을 canceled = true로 변경하고 account 추가
                                                let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                                await this.reservationCancelSQLandElastic(v2Reservation);
                                                taskObj[v2AccountId] = await this.taskManager(this, '[7ca]',v2Reservation.id, v2AccountId, messageId, ['cancelSQL', 'cancelElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`)
                                            }
                                        } else {
                                            // (8ra) : v1Canceled data 없음 + 1개 SQL reservation 존재(canceled = false) + 관련 SQL account 1개 존재 + v1 Account가 존재하는 SQL account와 무관 --> reservation + account 생성 (canceled 정보는 account 정보에 따라 바뀜)
                                            let v2NewReservation = await JSON.parse(JSON.stringify(v2Reservation));
                                            let v2SQLReservation = await this.reservationCreateAndInsert(null, v2Product, minus_v1Account, v2NewReservation);
                                            let v2AccountId = await this.accountCreateAndInsert(v1Account, v2SQLReservation, true);
                                            taskObj[v2AccountId] = await this.taskManager(this, '[8ra]',v2Reservation.id, v2AccountId, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`)
                                        }
                                    }
                                }
                            }
                        } else {
                            const obj = await this.multipleReservationProcess(v1Account, v2ReservationArr);
                            if (obj.identical) {taskObj.error[messageId] = await this.taskManager(this,'Pass - 7', obj.identicalObj.v2ReservationId, obj.identicalObj.v2AccountId, messageId, [], [], null, `same account exist in SQL`)}
                            else if (obj.reverse) {
                                // reverse인데 fullAccount가 될 수는 없다. 그렇다면 identical에서 걸렸을 것.
                                let v2Reservation = obj.reverseObj.v2Reservation;
                                if (v2Reservation.canceled) {
                                    // (9a) : v1Canceled data 없음 + 여러 개 SQL reservation 존재 + 관련 SQL account 중 v1 Account와 reverse 관계인 account 존재 + 해당 reservation 의 canceled = true --> account 생성
                                    let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                    taskObj[v2AccountId] = await this.taskManager(this, '[9a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`)
                                } else {
                                    // (10ca) : v1Canceled data 없음 + 여러 개 SQL reservation 존재 + 관련 SQL account 중 v1 Account와 reverse 관계인 account 존재 + 해당 reservation 의 canceled = false --> reservation canceled = true로 변경하고 account 생성
                                    let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                    await this.reservationCancelSQLandElastic(v2Reservation);
                                    taskObj[v2AccountId] = await this.taskManager(this, '[10ca]',v2Reservation.id, v2AccountId, messageId, ['cancelSQL', 'cancelElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`)
                                }
                            } else {
                                if (obj.emptyAccountReservation.length > 0) {
                                    let v2Reservation = obj.emptyAccountReservation[0];
                                    let canceled = v2Reservation.canceled;
                                    for (let tempReservation of obj.emptyAccountReservation) {
                                        if (tempReservation.canceled) {
                                            v2Reservation = tempReservation;
                                            canceled = true;
                                        }
                                    }
                                    if (canceled) {
                                        // (11a) : v1Canceled data 없음 + 여러 개 SQL reservation 존재(canceled = true) + 존재하는 v2 Account중 v1 Account와 reverse관계인 것 없음 + 관련 account가 0개인 reservation 존재 --> account 생성
                                        let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                        taskObj[v2AccountId] = await this.taskManager(this, '[11a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`)
                                    } else {
                                        if (minus_v1Account) {
                                            // (12ca) : v1Canceled data 없음 + 여러 개 SQL reservation 존재(canceled = false) + 존재하는 v2 Account중 v1 Account와 reverse관계인 것 없음 + 관련 account가 0개인 reservation 존재 + v1 Account 정보가 (-) --> reservation canceled = true로 변경 + account 생성
                                            let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                            await this.reservationCancelSQLandElastic(v2Reservation);
                                            taskObj[v2AccountId] = await this.taskManager(this, '[12ca]',v2Reservation.id, v2AccountId, messageId, ['cancelSQL', 'cancelElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`)
                                        } else {
                                            // (13a) : v1Canceled data 없음 + 여러 개 SQL reservation 존재(canceled = false) + 존재하는 v2 Account중 v1 Account와 reverse관계인 것 없음 + 관련 account가 0개인 reservation 존재 + 해당 reservation의 canceled = false, v1 Account 정보가 (+) --> account 생성
                                            let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                            taskObj[v2AccountId] = await this.taskManager(this, '[13a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`)
                                        }
                                    }
                                } else {
                                    // (14ra) : v1Canceled data 없음 + 여러 개 SQL reservation 존재 + 존재하는 v2 Account중 v1 Account와 reverse관계인 것 없음 + 관련 account가 0개인 reservation 존재 하지 않음 --> reservation + account 생성 (canceled 정보는 minus_v1Account에 따라 변경됨)
                                    let v2NewReservation = await JSON.parse(JSON.stringify(v2ReservationArr[0]));
                                    let v2Product = await Product.getProduct(v2NewReservation.product_id);
                                    let v2SQLReservation = await this.reservationCreateAndInsert(null, v2Product, minus_v1Account, v2NewReservation);
                                    let v2AccountId = await this.accountCreateAndInsert(v1Account, v2SQLReservation, true);
                                    taskObj[v2AccountId] = await this.taskManager(this, '[14ra]',v2SQLReservation.id, v2AccountId, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`)
                                }
                            }
                        }
                    } else {
                        let v2Product = await Product.getProduct(v1CanceledData.product);
                        if (!v2Product) {taskObj.error[messageId] = await this.taskManager(this,'Pass - 8', v2ReservationArr.map(data=>data.id), null, messageId, [], [], null, `no matching v2 product exist! : ${v1CanceledData.product}`)}
                        else {
                            if (v2ReservationArr.length === 0) {
                                // (15ra) : v1 Canceled data 있음 + SQL에 reservation 존재하지 않음 --> reservation + account 생성 (canceled 는 minus_v1Account에 따라 결정)
                                let v2SQLReservation = await this.reservationCreateAndInsert(v1CanceledData, v2Product, minus_v1Account);
                                let v2AccountId = await this.accountCreateAndInsert(v1Account, v2SQLReservation, true);
                                taskObj[v2AccountId] = await this.taskManager(this, '[15ra]',v2SQLReservation.id, v2AccountId, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`)
                            } else if (v2ReservationArr.length === 1) {
                                let v2Reservation = v2ReservationArr[0];
                                if (v2Reservation.canceled) {
                                    let v2AccountArr = await this.getV2SqlAccountWithReservation(v2Reservation.id);
                                    if (v2AccountArr.length === 2) {
                                        let accountSales = await this.v1v2AccountSales(v1Account, v2AccountArr[0]);
                                        if (accountSales.match) {taskObj.error[messageId] = await this.taskManager(this,'Pass - 9', v2Reservation.id, v2AccountArr.map(data=>data.id), messageId, [], [], null, `already same account exist in SQL!`)}
                                        else {
                                            // (16ra) : v1 Canceled data 있음 + SQL에 reservation 1개 존재(canceled = true) + SQL에 관련 account 2개 존재 + v1 Account와는 관련없음  --> reservation + account 생성 (canceled 는 minus_v1Account에 따라 결정)
                                            let v2SQLReservation = await this.reservationCreateAndInsert(v1CanceledData, v2Product, minus_v1Account);
                                            let v2AccountId = await this.accountCreateAndInsert(v1Account, v2SQLReservation, true);
                                            taskObj[v2AccountId] = await this.taskManager(this, '[16ra]',v2SQLReservation.id, v2AccountId, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`)
                                        }
                                    } else if (v2AccountArr.length === 1) {
                                        let accountSales = await this.v1v2AccountSales(v1Account, v2AccountArr[0]);
                                        if (accountSales.match) {
                                            if (accountSales.identical) {taskObj.error[messageId] = await this.taskManager(this,'Pass - 10', v2Reservation.id, v2AccountArr.map(data=>data.id), messageId, [], [], null, `already same account exist in SQL!`)}
                                            else {
                                                // (17a) : v1 Canceled data 있음 + SQL에 reservation 1개 존재(canceled = true)  + SQL에 관련 account 1개 존재 + v1 Account와 reverse 관계  --> account 생성
                                                let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                                taskObj[v2AccountId] = await this.taskManager(this, '[17a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`)
                                            }
                                        } else {
                                            // (18ra) : v1 Canceled data 있음 + SQL에 reservation 1개 존재(canceled = true) + SQL에 관련 account 1개 존재 + v1 Account와 관계 없음 --> 새로운 reservation + account 생성 (canceled 는 minus_v1Account에 따라 결정)
                                            let v2SQLReservation = await this.reservationCreateAndInsert(v1CanceledData, v2Product, minus_v1Account);
                                            let v2AccountId = await this.accountCreateAndInsert(v1Account, v2SQLReservation, true);
                                            taskObj[v2AccountId] = await this.taskManager(this, '[18ra]',v2SQLReservation.id, v2AccountId, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`)
                                        }
                                    } else {
                                        // (19a) : v1 Canceled data 있음 + SQL에 reservation 1개 존재(canceled = true) + SQL에 관련 account 없음 --> account 생성
                                        let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                        taskObj[v2AccountId] = await this.taskManager(this, '[19a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`)
                                    }
                                } else {
                                    let v2AccountArr = await this.getV2SqlAccountWithReservation(v2Reservation.id);
                                    if (v2AccountArr.length === 0) {
                                        // (20a) : v1 Canceled data 있음 + SQL에 reservation 1개 존재(canceled = false) + SQL에 관련 account 없음 --> account 생성
                                        let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                        taskObj[v2AccountId] = await this.taskManager(this, '[20a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`)
                                    } else {
                                        let accountSales = await this.v1v2AccountSales(v1Account, v2AccountArr[0]);
                                        if (accountSales.match) {
                                            if (accountSales.identical) {taskObj.error[messageId] = await this.taskManager(this,'Pass - 11', v2Reservation.id, v2AccountArr.map(data=>data.id), messageId, [], [], null, `already same account exist in SQL!`)}
                                            else {
                                                // (21ca) : v1 Canceled data 있음 + SQL에 reservation 1개 존재(canceled = false) + SQL에 관련 account 1개 있음 + v1 Account와 reverse 관계 --> reservation canceled = true로 변경하고 account 생성
                                                let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                                await this.reservationCancelSQLandElastic(v2Reservation);
                                                taskObj[v2AccountId] = await this.taskManager(this, '[21ca]',v2Reservation.id, v2AccountId, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`)
                                            }
                                        } else {
                                            // (22ra) : v1 Canceled data 있음 + SQL에 reservation 1개 존재(canceled = false) + SQL에 관련 account 1개 있음 + v1 Account와 아무런 관계 없음 --> 새로운 reservation account 생성 (canceled 는 minus_v1Account에 따라 결정)
                                            let v2SQLReservation = await this.reservationCreateAndInsert(v1CanceledData, v2Product, minus_v1Account);
                                            let v2AccountId = await this.accountCreateAndInsert(v1Account, v2SQLReservation, true);
                                            taskObj[v2AccountId] = await this.taskManager(this, '[22ra]',v2SQLReservation.id, v2AccountId, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`)
                                        }
                                    }
                                }
                            } else {
                                const obj = await this.multipleReservationProcess(v1Account, v2ReservationArr);
                                if (obj.identical) {taskObj.error[messageId] = await this.taskManager(this,'Pass - 12', obj.identicalObj.v2ReservationId, obj.identicalObj.v2AccountId, messageId, [], [], null, `already same account exist in SQL!`)}
                                else if (obj.reverse) {
                                    let v2Reservation = obj.reverseObj.v2Reservation;
                                    if (v2Reservation.canceled) {
                                        // (23a) : v1Canceled data 있음 + 여러 개 SQL reservation 존재 + 관련 SQL account 중 v1 Account와 reverse 관계인 account 존재 + 해당 reservation 의 canceled = true --> account 생성
                                        let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                        taskObj[v2AccountId] = await this.taskManager(this, '[23a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`)
                                    } else {
                                        // (24ca) : v1Canceled data 있음 + 여러 개 SQL reservation 존재 + 관련 SQL account 중 v1 Account와 reverse 관계인 account 존재 + 해당 reservation 의 canceled = false --> reservation canceled = true로 변경하고 account 생성
                                        let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                        await this.reservationCancelSQLandElastic(v2Reservation);
                                        taskObj[v2AccountId] = await this.taskManager(this, '[24ca]',v2Reservation.id, v2AccountId, messageId, ['cancelSQL', 'cancelElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`)
                                    }
                                } else {
                                    if (obj.emptyAccountReservation.length > 0) {
                                        let v2Reservation = obj.emptyAccountReservation[0];
                                        let canceled = v2Reservation.canceled;
                                        for (let tempReservation of obj.emptyAccountReservation) {
                                            if (tempReservation.canceled) {
                                                v2Reservation = tempReservation;
                                                canceled = true;
                                            }
                                        }
                                        if (canceled) {
                                            // (25a) : v1Canceled data 있음 + 여러 개 SQL reservation 존재(canceled = true) + 존재하는 v2 Account중 v1 Account와 reverse관계인 것 없음 + 관련 account가 0개인 reservation 존재 --> account 생성
                                            let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                            taskObj[v2AccountId] = await this.taskManager(this, '[25a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`)
                                        } else {
                                            if (minus_v1Account) {
                                                // (26ca) : v1Canceled data 있음 + 여러 개 SQL reservation 존재(canceled = false) + 존재하는 v2 Account중 v1 Account와 reverse관계인 것 없음 + 관련 account가 0개인 reservation 존재 + v1 Account 정보가 (-) --> reservation canceled = true로 변경 + account 생성
                                                let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                                await this.reservationCancelSQLandElastic(v2Reservation);
                                                taskObj[v2AccountId] = await this.taskManager(this, '[26ca]',v2Reservation.id, v2AccountId, messageId, ['cancelSQL', 'cancelElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`)
                                            } else {
                                                // (27a) : v1Canceled data 있음 + 여러 개 SQL reservation 존재(canceled = false) + 존재하는 v2 Account중 v1 Account와 reverse관계인 것 없음 + 관련 account가 0개인 reservation 존재 + v1 Account 정보가 (+) --> account 생성
                                                let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                                taskObj[v2AccountId] = await this.taskManager(this, '[27a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`)
                                            }
                                        }
                                    } else {
                                        // (28ra) : v1Canceled data 있음 + 여러 개 SQL reservation 존재 + 존재하는 v2 Account중 v1 Account와 reverse관계인 것 없음 + 관련 account가 0개인 reservation 존재 하지 않음 --> reservation + account 생성 (canceled 정보는 minus_v1Account에 따라 변경됨)
                                        let v2NewReservation = await JSON.parse(JSON.stringify(v2ReservationArr[0]));
                                        let v2SQLReservation = await this.reservationCreateAndInsert(null, v2Product, minus_v1Account, v2NewReservation);
                                        let v2AccountId = await this.accountCreateAndInsert(v1Account, v2SQLReservation, true);
                                        taskObj[v2AccountId] = await this.taskManager(this, '[28ra]',v2SQLReservation.id, v2AccountId, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`)
                                    }
                                }
                            }
                        }
                    }
                } else {
                    // (29a) : 예약이 아닌 회계에 대해서 converting 회계 생성
                    let v2AccountId = await this.accountCreateAndInsert(v1Account, null, false);
                    if (!v2AccountId) {
                        let memo = v1Account.identifier ? v1Account.detail + ' identifier : ' + v1Account.identifier : v1Account.detail;
                        taskObj.error[v1Account.id + '-' + String(new Date())] = await this.taskManager(this, 'Pass - 13',null, null, null, [], [], null, `already same non-reservation account exist in postgreSQL. memo : ${memo}`);
                    } else {
                        taskObj[v2AccountId] = await this.taskManager(this, '[21a]',null, v2AccountId, null, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category} : only account for non-reservation insert`);
                    }
                }
            }
        }
        console.log('all task done! : ', {totalCount:this.totalCount, passCount : this.passCount,reservationCreateCount : this.reservationCreateCount, accountCreateCount : this.accountCreateCount, missingCount : this.totalCount - this.passCount - this.reservationCreateCount - this.accountCreateCount});
    }
    
    /**
     * main converter of v1 --> v2 account
     * it has to be checked if certain reservation or account is already exist in postgreSQL database at every v1 account case.
     * sequential process should be done to make sure previous task can affect next task.
     * @param v1AccountBulkData {Object} v1 account bulk object
     * @param v1CanceledBulkData {Object} v1 canceled bulk object
     * @returns {Promise<void>}
     */
    static async mainConverter_old(v1AccountBulkData, v1CanceledBulkData) {
        this.totalCount = 0;
        this.passCount = 0;
        this.reservationCreateCount = 0;
        this.accountCreateCount = 0;
        const taskObj = {error: {}};
        for (let temp of Object.entries(v1AccountBulkData)) {
            let date = temp[0];
            let v1AccountObj = temp[1];
            for (let v1Account of Object.values(v1AccountObj)) {
                this.totalCount += 1;
                if (v1Account.category === 'reservation' || v1Account.category === 'Reservation') {
                    let messageId = v1Account.id;
                    let v2ReservationArr = await this.getV2SqlReservations(messageId);
                    if (v2ReservationArr.length > 0) {
                        if (v2ReservationArr.length > 1) {
                            let v1CanceledData = v1CanceledBulkData[messageId];
                            if (!v1CanceledData) {
                                const obj = { totalNum : 0, fullCount: 0, newAccount : false, nonCanceledReservation : {}, newAccountObj : {}, fullAccount : {}, emptyAccount : {},identical : false, identicalObj : {}, newAccountWithRsv : false, newAccountWithRsvObj : {}};
                                for (let v2Reservation of v2ReservationArr) {
                                    obj.totalNum += 1;
                                    let tempV2AccountArr = await this.getV2SqlAccountWithReservation(v2Reservation.id);
                                    if (v2Reservation.canceled === true) {
                                        if (tempV2AccountArr.length === 0) {obj.emptyAccount[v2Reservation.id] = v2Reservation}
                                        else if (tempV2AccountArr.length === 2) {
                                            obj.fullCount += 1;
                                            obj.fullAccount[v2Reservation.id] = tempV2AccountArr.map(data=>data.id)
                                        } else {
                                            let accountSales = await this.v1v2AccountSales(v1Account, tempV2AccountArr[0]);
                                            if (accountSales.match) {
                                                if (accountSales.identical) {
                                                    obj.identical = true;
                                                    obj.identicalObj = {v2ReservationId : v2Reservation.id, v2AccountID : tempV2AccountArr[0].id}
                                                } else {
                                                    obj.newAccount = true;
                                                    obj.newAccountObj = {v2Reservation : v2Reservation};
                                                }
                                            }
                                        }
                                    } else {
                                        obj.nonCanceledReservation = {v2Reservation : v2Reservation, v2AccountArr : tempV2AccountArr};
                                        let accountSales = await this.v1v2AccountSales(v1Account, tempV2AccountArr[0]);
                                        if (accountSales.match) {
                                            if (accountSales.identical) {
                                                obj.identical = true;
                                                obj.identicalObj = {v2ReservationId : v2Reservation.id, v2AccountID : tempV2AccountArr[0].id}
                                            } else {
                                                obj.newAccountWithRsv = true;
                                                obj.newAccountWithRsvObj = {v2Reservation : v2Reservation, v2Account : tempV2AccountArr[0]}
                                            }
                                        }
                                    }
                                }
                                if (obj.identical) {taskObj.error[messageId] = await this.taskManager(this,'Pass - 1', obj.identicalObj.v2ReservationId, obj.identicalObj.v2AccountID, messageId, [], [], null, `identical account data exist`);}
                                else if (obj.newAccount) {
                                    if (!obj.newAccountObj.v2Reservation) {taskObj.error[messageId] = await this.taskManager(this,'Pass - 2', null, null, messageId, [], [], null, `no matching canceled data && only canceled reservation exist without account data`);} 
                                    else {
                                        // (1a) : 여러 예약 중 canceled 예약의 account와 v1 account가 reverse 관계이므로 account 만 생성.
                                        let v2AccountId = await this.accountCreateAndInsert(v1Account, obj.newAccountObj.v2Reservation, true);
                                        taskObj[v2AccountId] = await this.taskManager(this, '[1a]',obj.newAccountObj.v2Reservation.id, v2AccountId, messageId, [], ['insertSQL, insertElastic'], `success - ${v1Account.category} : [multiple reservation] 1 canceled reservation with 1 account + alpha (canceled/non-canceled) reservation exist --> 1 reverse account for canceled reservation insert`);
                                    }
                                } else if (obj.newAccountWithRsv) {
                                    // (2cra) : 여러 예약 중 non-canceled 예약의 account와 v1 account가 reverse 관계이므로 canceled 로 예약을 변경하고 account 넣은 후 non-canceled 예약 생성.
                                    let v2Reservation = obj.newAccountWithRsvObj.v2Reservation;
                                    let v2Product = await Product.getProduct(v2Reservation.product_id);
                                    let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                    let v2SQLCanceledReservation = await this.reservationCancelSQLandElastic(v2Reservation, v2Product);
                                    taskObj[v2AccountId] = await this.taskManager(this, '[2cra]',`canceled : ${v2Reservation.id} / created : ${v2SQLCanceledReservation.id}`, v2AccountId, messageId, ['cancelSQL', 'cancelElastic', 'insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category} : [multiple reservation] 1 non-canceled reservation / 1 account exist + alpha reservation with account --> change reservation from non-canceled to canceled due to reverse account + insert account + create another non-canceled reservation`)
                                } else {
                                    // 모든 reservation에서 v1Account data와 matching되는 account가 에 없기 때문에 canceled = true인 예약 중 account가 하나도 없는 예약이 있다면
                                    // 거기에 account 추가하고, 빈 reservation이 없다면 reservation + account.
                                    let canceled = false;
                                    if (!!v1Account.card && v1Account.card !== 0) canceled = v1Account.card < 0;
                                    else if (!!v1Account.cash && v1Account.cash !== 0) canceled = v1Account.cash < 0;
                                    if (obj.totalNum - obj.fullCount === 1) {
                                        if (obj.nonCanceledReservation.v2AccountArr.length === 0 && !canceled) {
                                            // (3a) : 모든 canceled = true인 예약의 회계정보는 세트로 존재함. canceled = false인 예약의 회계정보는 존재하지 않음. canceled = false인 예약에 account 생성
                                            let v2AccountId = await this.accountCreateAndInsert(v1Account, obj.nonCanceledReservation.v2Reservation, true);
                                            taskObj[v2AccountId] = await this.taskManager(this, '[3a]',obj.newAccountObj.v2Reservation.id, v2AccountId, messageId, [], ['insertSQL, insertElastic'], `success - ${v1Account.category} : [multiple reservation] all canceled reservation's account set is full / non-canceled reservation's account is empty --> (+) account insert`);
                                        } else {
                                            // (4ra) 모든 canceled = true인 예약의 회계정보는 세트로 존재함. canceled = false인 예약과 v1 account는 아무 관련이 없음. canceled = true인 예약 생성 및 회계 생성.
                                            let v2NewReservation = await JSON.parse(JSON.stringify(obj.nonCanceledReservation.v2Reservation))
                                            let v2Product = await Product.getProduct(v2NewReservation.product_id);
                                            let v2SQLReservation = await this.reservationCreateAndInsert(null, v2Product, true, v2NewReservation);
                                            let v2AccountId = await this.accountCreateAndInsert(v1Account, v2SQLReservation, true);
                                            taskObj[v2AccountId] = await this.taskManager(this, '[4ra]',v2SQLReservation.id, v2AccountId, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category} : [multiple reservation] all canceled reservation's account set is full / non-canceled reservation's account is empty or v1 account data is (-) --> create new canceled reservation + insert account`);
                                        }
                                    } else if (Object.keys(obj.emptyAccount).length === 0) {
                                        // (5ra) 여러 reservation 중에서 빈 account가 없기 때문에 랜덤으로 reservation 하나를 골라서 새로운 reservation + account 생성. canceled = false인 예약이 이미 존재하므로 canceled = true 이어야 함.
                                        let v2Reservation = await JSON.parse(JSON.stringify(v2ReservationArr[0]));
                                        let v2Product = await Product.getProduct(v2Reservation.product_id);
                                        let v2SQLReservation = await this.reservationCreateAndInsert(null, v2Product, true, v2Reservation);
                                        let v2AccountId = await this.accountCreateAndInsert(v1Account, v2SQLReservation, true);
                                        taskObj[v2AccountId] = await this.taskManager(this, '[5ra]',v2SQLReservation.id, v2AccountId, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category} : [multiple reservation] multiple reservation without empty account --> create new reservation + insert account`);
                                    } else {
                                        let v2Reservation = Object.values(obj.emptyAccount)[0];
                                        let v2Product = await Product.getProduct(v2Reservation.product_id);
                                        if (canceled) {
                                            // (6cra) 빈 reservation에 account 추가. v1 Account의 가격정보가 (-) 값이기 때문에 reservation을 canceled로 바꾼 다음 account 생성 + 새로운 non-canceled reservation을 새로 생성 .
                                            let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                            let v2SQLCanceledReservation = await this.reservationCancelSQLandElastic(v2Reservation, v2Product);
                                            taskObj[v2AccountId] = await this.taskManager(this, '[6cra]',`canceled : ${v2Reservation.id} / created : ${v2SQLCanceledReservation.id}`, v2AccountId, messageId, ['cancelSQL', 'cancelElastic', 'insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category} : [multiple reservation] reservation with empty account exist + alpha reservation with account --> change reservation from non-canceled to canceled due to (-) account + insert account + create another non-canceled reservation`)
                                        } else {
                                            // (7a) 빈 reservation에 account 추가. v1 Account의 가격정보가 (+) 값이기 때문에 account만 생성.
                                            let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                            taskObj[v2AccountId] = await this.taskManager(this, '[7a]',obj.newAccountObj.v2Reservation.id, v2AccountId, messageId, [], ['insertSQL, insertElastic'], `success - ${v1Account.category} : [multiple reservation] 1 reservation with empty account --> (+) account insert`);
                                        }
                                    }
                                }
                            } else {
                                // message id 에 대응되는 reservation이 여러개 존재하지만, canceled data가 존재하지 않는 경우. 정상적인 예약이 1개는 무조건 있다는 말임.
                                let v2AccountObj = {canceled:{}, normal:{}, alreadyExist : false};
                                let v2ReservationObj = {canceled:{}, normal:{}};
                                let v2AccountMakeForEmptySQL = false;
                                let matchCount = 0;
                                // console.log('(10ra) v2ReservationArr : ', messageId, v2ReservationArr.map(data=>[data.id,data.canceled]));
                                for (let v2Reservation of v2ReservationArr) {
                                    if (v2Reservation.canceled === true) {
                                        let tempV2AccountArr = await this.getV2SqlAccountWithReservation(v2Reservation.id);
                                        if (tempV2AccountArr.length === 0) {
                                            // (8a) : 하나의 message Id 에 여러개의 reservation Id가 존재. 취소된 예약에 회계정보가 없는 경우 회계 생성
                                            // todo : account 없는 reservation 이 있다는 걸 표시해야함. 밑에 작업들 다 바꿔야함!
                                            // let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                            // v2AccountMakeForEmptySQL = true;
                                            // taskObj[v2AccountId] = await this.taskManager(this, '[8a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL, insertElastic'], `success - ${v1Account.category} : [multiple reservation] 1 canceled reservation with no account + alpha (canceled/non-canceled) reservation exist --> 1 account for canceled reservation insert`);
                                        } else {
                                            // console.log('(10ra) tempV2AccountArr : ',tempV2AccountArr.map(data=>data.id))
                                            for (let v2Account of tempV2AccountArr) {
                                                let accountSales = await this.v1v2AccountSales(v1Account, v2Account);
                                                // console.log('(10ra) ',v2Account.id, v2Account.income, v2Account.expenditure, JSON.stringify(accountSales));
                                                if (accountSales.match && accountSales.identical && accountSales.v1 === accountSales.v2) v2AccountObj.alreadyExist = true;
                                                else if (accountSales.match && !accountSales.identical && accountSales.v1 === accountSales.v2 * (-1)) {
                                                    v2AccountObj.canceled.obj = v2Account;
                                                    v2AccountObj.canceled.reservation = v2Reservation;
                                                    matchCount += 1;
                                                }}}
                                    } else {
                                        v2ReservationObj.normal = v2Reservation;
                                        let v2AccountArr = await this.getV2SqlAccountWithReservation(v2Reservation.id);
                                        if (v2AccountArr.length > 0) {taskObj.error[messageId] = await this.taskManager(this, 'Pass - 23',v2Reservation.id, v2AccountArr[0].id, messageId, [], [], null, `already account exist in non-canceled reservation`);}
                                        else {taskObj.error[messageId] = await this.taskManager('Pass - 4',v2Reservation.id, null, messageId, [], [], null, `no account exist in non-canceled reservation`);
                                        }}}
                                if (v2AccountObj.canceled.reservation) {
                                    if (matchCount > 1) {taskObj.error[messageId] = await this.taskManager(this, 'Pass - 5',v2AccountObj.canceled.reservation.id, null, messageId, [], [], null, `multiple identical account information exist in non-canceled reservation. matchCount : ${matchCount}`);}
                                    else {
                                        // (9a) : 하나의 message Id 에 여러개의 reservation Id가 존재. 특정 취소된 reservation 에 회계 정보가 1개 있고, 그에 reverse 관계인 회계가 생성되는 case.
                                        let v2AccountId = await this.accountCreateAndInsert(v1Account, v2AccountObj.canceled.reservation, true);
                                        taskObj[v2AccountId] = await this.taskManager(this, '[9a]',v2AccountObj.canceled.reservation.id, v2AccountId, messageId, [], ['insertSQL, insertElastic'], `success - ${v1Account.category} : [multiple reservation] 1 canceled reservation / 1 account + 1 (canceled/non-canceled) reservation exist --> 1 reversed account for canceled reservation insert`);
                                    }
                                } else {
                                    if (v2AccountObj.alreadyExist) taskObj[messageId] = await this.taskManager(this, 'Pass - 6',v2ReservationArr.map(data=>data.id), null, messageId, [], [], null, 'already account exist in canceled reservation');
                                    else if (!v2AccountMakeForEmptySQL) {
                                        // (10ra) : 하나의 message Id 에 여러개의 reservation Id가 존재. 존재하는 reservation의 sales와 일치하는 것이 없기 때문에 새로운 취소 예약 + 회계 생성 (canceled 아닌 Reservation은 이미 SQL에 존재하는 것을 전제)
                                        let v2Product = await this.getV2SqlProduct(v1CanceledData.product);
                                        let v2SQLReservation = await this.reservationCreateAndInsert(v1CanceledData, v2Product, true);
                                        let v2AccountId = await this.accountCreateAndInsert(v1Account, v2SQLReservation, true);
                                        taskObj[v2AccountId] = await this.taskManager(this, '[10ra]',v2SQLReservation.id, v2AccountId, messageId, ['insertSQL, insertElastic'], ['insertSQL, insertElastic'], `success - ${v1Account.category} : [multiple reservation] new canceled reservation + account insert`);
                                    }}}
                        } else {
                            let v2Reservation = v2ReservationArr[0];
                            let v2AccountArr = await this.getV2SqlAccountWithReservation(v2Reservation.id);
                            if (v2Reservation.canceled === true) {
                                // message id 에 대응하는 reservation 이 1개만 SQL에 존재하고, canceled = true 일 때.
                                let v1CanceledData = v1CanceledBulkData[messageId];
                                if (!v1CanceledData) {taskObj.error[messageId] = await this.taskManager(this, 'Pass - 7',v2Reservation.id, v2AccountArr[0].id, messageId, [], [], null, `no matching canceled data`);}
                                else {
                                    let v2Product = await this.getV2SqlProduct(v1CanceledData.product);
                                    if (!v2Product) {taskObj.error[messageId] = await this.taskManager(this, 'Pass - 8',v2Reservation.id, v2AccountArr[0].id, messageId, [], [], null, `no matching v2 Product in SQL. v1 Product : ${v1CanceledData.product}`);}
                                    else {
                                        if (v2AccountArr.length === 0) {
                                            // (11a) : 취소된 예약에 회계정보가 존재하지 않음. account 생성 (보통 중간에 account converter 실행 도중 멈추고 다시 실행 한 경우에 발생)
                                            let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                            taskObj[v2AccountId] = await this.taskManager(this, '[11a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category} : [single reservation] 1 canceled reservation / 1 account exist --> 1 reversed account insert`);
                                        } else if (v2AccountArr.length === 1) {
                                            let accountSales = await this.v1v2AccountSales(v1Account, v2AccountArr[0]);
                                            if (accountSales.match) {
                                                if (accountSales.v1 === accountSales.v2) {taskObj.error[messageId] = await this.taskManager(this, 'Pass - 9',v2Reservation.id, v2AccountArr[0].id, messageId, [], [], null, `duplicated account exist`);}
                                                else {
                                                    // (12a) : 취소된 예약에 이미 1개의 회계가 존재하고, reverse 회계를 넣는 case
                                                    let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                                    taskObj[v2AccountId] = await this.taskManager(this, '[12a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category} : [single reservation] 1 canceled reservation / 1 account exist --> 1 reversed account insert`);
                                                }
                                            } else {
                                                // (13ra) : 취소된 예약에 이미 1개의 회계가 존재하는데, sales 정보가 달라서 새로운 취소 예약 + 회계를 만드는 case
                                                let v2SQLReservation = await this.reservationCreateAndInsert(v1CanceledData, v2Product, true);
                                                let v2AccountId = await this.accountCreateAndInsert(v1Account, v2SQLReservation, true);
                                                taskObj[v2AccountId] = await this.taskManager(this, '[13ra]',v2SQLReservation.id, v2AccountId, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category} : [single reservation] 1 canceled reservation / 1 account exist --> another canceled reservation + account insert`);
                                            }
                                        } else {
                                            let v2Account;
                                            for (let tempV2Account of v2AccountArr) {
                                                let accountSales = await this.v1v2AccountSales(v1Account, tempV2Account);
                                                if (!accountSales.match) v2Account = tempV2Account;
                                            }
                                            if (!v2Account) {taskObj.error[messageId] = await this.taskManager(this, 'Pass - 10',v2Reservation.id, v2AccountArr.map(data=>data.id), messageId, [], [], null, `already two account exist in one canceled reservation`);}
                                            else {
                                                // (14ra) : 취소된 예약에 이미 2개의 서로 reverse관계인 회계가 존재하는데, sales 정보가 달라서 새로운 취소 예약 + 회계를 만드는 case
                                                let v2SQLReservation = await this.reservationCreateAndInsert(v1CanceledData, v2Product, true);
                                                let v2AccountId = await this.accountCreateAndInsert(v1Account, v2SQLReservation, true);
                                                taskObj[v2AccountId] = await this.taskManager(this, '[14ra]',v2SQLReservation.id, v2AccountId, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category} : [single reservation] 1 canceled reservation / 2 account exist --> another canceled reservation + account insert`)
                                            }
                                        }
                                    }
                                }
                            } else {
                                // message id 에 대응하는 reservation이 1개 존재하고, canceled = false 일 때.
                                let canceled = false;
                                if (!!v1Account.card && v1Account.card !== 0) canceled = v1Account.card < 0;
                                else if (!!v1Account.cash && v1Account.cash !== 0) canceled = v1Account.cash < 0;
                                if (v2AccountArr.length > 0) {
                                    let accountSales = await this.v1v2AccountSales(v1Account, v2AccountArr[0]);
                                    if (accountSales.match) {
                                        if (accountSales.identical) {taskObj.error[v2AccountArr[0].id] = await this.taskManager(this, 'Pass - 11',v2Reservation.id, v2AccountArr[0].id, messageId, [], [], null, `account already exists in non-canceled reservation. money info : [${v1Account.cash}, ${v1Account.card}]. number of account in message id ${messageId} : ${v2AccountArr.length}`);}
                                        else {
                                            // (15cra) :  message id 하나에 1개의 canceled = false인 예약이 존재하고 v1 account는 해당 회계의 reverse 관계. reverse 란 말은 v1 account가 (-) 값이란 말이므로 해당 예약을 canceled 로 변경하고 새로운 non-canceled reservation 생성
                                            let v2Product = await Product.getProduct(v2Reservation.product_id);
                                            let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                            let v2SQLCanceledReservation = await this.reservationCancelSQLandElastic(v2Reservation, v2Product);
                                            taskObj[v2AccountId] = await this.taskManager(this, '[15cra]',`canceled : ${v2Reservation.id} / created : ${v2SQLCanceledReservation.id}`, v2AccountId, messageId, ['cancelSQL', 'cancelElastic', 'insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category} : [single reservation] 1 non-canceled reservation / 1 account exist --> change reservation from non-canceled to canceled due to reverse account + insert account + create another non-canceled reservation`)
                                        }
                                    } else {
                                        let v1CanceledData = v1CanceledBulkData[messageId];
                                        if (!v1CanceledData) {
                                            // (16ra) 일반적인 루트. 정상 예약과 회계 정보 존재하지만, v1 account와는 아무 관계가 없음. canceled data가 없다는 말은 canceled = false인 예약이 존재한다는 것이므로 canceled = true인 새로운 예약 + 회계 생성
                                            let v2Product = Product.getProduct(v2Reservation.product_id);
                                            let v2CanceledReservation = await JSON.parse(JSON.stringify(v2Reservation));
                                            let v2CanceledSQLReservation = await this.reservationCreateAndInsert(null, v2Product, true, v2CanceledReservation);
                                            let v2AccountId = await this.accountCreateAndInsert(v1Account, v2CanceledSQLReservation, true);
                                            taskObj[v2AccountId] = await this.taskManager(this, '[16ra]',v2CanceledSQLReservation.id, v2AccountId, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category} : [single reservation] 1 non-canceled reservation / 1 account exist --> another canceled reservation + account insert (canceled data does not exist)`)
                                        } else {
                                            let v2Product = await this.getV2SqlProduct(v1CanceledData.product);
                                            if (!v2Product) {taskObj.error[messageId] = await this.taskManager(this, 'Pass - 12',v2Reservation.id, v2AccountArr[0].id, messageId, [], [], null, `no matching v2 Product in SQL. v1 Product : ${v1CanceledData.product}`);}
                                            else {
                                                // (17ra) : 일반 예약, 회계가 존재했는데 같은 message id로 canceled 된 회계정보가 들어와서 canceled 예약 + 회계 생성.
                                                let v2SQLReservation = await this.reservationCreateAndInsert(v1CanceledData, v2Product, true);
                                                let v2AccountId = await this.accountCreateAndInsert(v1Account, v2SQLReservation, true);
                                                taskObj[v2AccountId] = await this.taskManager(this, '[17ra]',v2SQLReservation.id, v2AccountId, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category} : [single reservation] 1 non-canceled reservation / 1 account exist --> another canceled reservation + account insert`)
                                            }
                                        }
                                    }
                                } else {
                                    // SQL상에 canceled = false 인 예약이 1개 있는데 이에 대응하는 account 하나도 없음.
                                    if (canceled) {
                                        // (18cra) : (-) 회계이므로 reservation을 canceled 로 변경하고 account 추가 + 새로운 non-canceled reservation 추가.
                                        let v2Product = await Product.getProduct(v2Reservation.product_id);
                                        let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                        let v2SQLCanceledReservation = await this.reservationCancelSQLandElastic(v2Reservation, v2Product);
                                        taskObj[v2AccountId] = await this.taskManager(this, '[18cra]',`canceled : ${v2Reservation.id} / created : ${v2SQLCanceledReservation.id}`, v2AccountId, messageId, ['cancelSQL', 'cancelElastic', 'insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category} : [single reservation] 1 non-canceled reservation with no account --> change reservation from non-canceled to canceled due to (-) account + insert account + create another non-canceled reservation`)
                                    } else {
                                        // (19a) : 가장 일반적인 루트(canceled 되지 않은 reservation에 대한 account 생성) . SQL database에 업데이트 하는 순서가 reservation --> account이기 때문에 정상 예약이라도 account가 없는 경우가 있음.
                                        let v2AccountId = await this.accountCreateAndInsert(v1Account, v2Reservation, true);
                                        taskObj[v2AccountId] = await this.taskManager(this,'[19a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category} : [single reservation] 1 non-canceled reservation with no account --> insert (+) account`);
                                    }
                                }
                            }
                        }
                    } else {
                        // message id에 대응하는 reservation이 SQL에 하나도 없는 경우 : 취소 예약만 존재한다는 뜻이라 canceled data가 반드시 있어야 함.
                        let v1CanceledData = v1CanceledBulkData[messageId];
                        if (!v1CanceledData) {taskObj.error[messageId] = await this.taskManager(this, 'Pass - 13',null, null, messageId, [], [], null, `no matching v2 Reservation in SQL, no matching canceled Data`);}
                        else {
                            let v2Product = await this.getV2SqlProduct(v1CanceledData.product);
                            if (!v2Product) {taskObj.error[messageId] = await this.taskManager(this, 'Pass - 14',null, null, messageId, [], [], null, `no matching v2 Product in SQL. v1 Product : ${v1CanceledData.product}`);}
                            else {
                                // (20ra) : 두번째로 일반적인 루트(canceled 된 reservation + account 생성). message id 에 대응하는 reservation이 SQL에 존재하지 않고 canceled Data가 존재할 때 취소된 reservation + account를 생성.
                                let v2SQLReservation = await this.reservationCreateAndInsert(v1CanceledData, v2Product, true);
                                let v2AccountId = await this.accountCreateAndInsert(v1Account, v2SQLReservation, true);
                                taskObj[v2AccountId] = await this.taskManager(this, '[20ra]',v2SQLReservation.id, v2AccountId.id, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category} : no reservation in SQL --> canceled reservation + account insert`);
                            }
                        }
                    }
                } else {
                    // (21a) : 예약이 아닌 회계에 대해서 converting 회계 생성
                    let v2AccountId = await this.accountCreateAndInsert(v1Account, null, false);
                    if (!v2AccountId) {
                        let memo = v1Account.identifier ? v1Account.detail + ' identifier : ' + v1Account.identifier : v1Account.detail;
                        taskObj.error[v1Account.id + '-' + String(new Date())] = await this.taskManager(this, 'Pass - 15',null, null, null, [], [], null, `already same non-reservation account exist in postgreSQL. memo : ${memo}`);
                    } else {
                        taskObj[v2AccountId] = await this.taskManager(this, '[21a]',null, v2AccountId, null, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category} : only account for non-reservation insert`);
                    }
                }
            }
        }
        console.log('all task done! : ', {totalCount:this.totalCount, reservationCreateCount : this.reservationCreateCount, accountCreateCount : this.accountCreateCount, missingCount : this.totalCount - this.passCount - this.reservationCreateCount - this.accountCreateCount});
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

    static taskManager(obj, type, v2ReservationId, v2AccountId, message_id, reservationTask, accountTask, message, error) {
        let typeArr;
        if (type[0] === "[") {
            typeArr = type.split('').slice(1, -1);
            if (typeArr.indexOf('r') !== -1) obj.reservationCreateCount += 1;
            if (typeArr.indexOf('a') !== -1) obj.accountCreateCount += 1;
        } else {
            typeArr = type.split(' ');
            if (typeArr.indexOf('Pass') !== -1) obj.passCount += 1;
        }
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

    static accountDataExtractByMonth(v1AccountBulkData, year, month, path) {
        let result = {};
        Object.entries(v1AccountBulkData).forEach(temp => {
            let date = temp[0];
            let v1Account = temp[1];
            let dateArr = date.trim().split('-');
            if (!month) {
                if (Number(dateArr[0]) === year) result[date] = v1Account;
            } else {
                if (Number(dateArr[0]) === year && Number(dateArr[1]) === month) result[date] = v1Account;
            }
        });
        return new Promise((resolve, reject) => {
            fs.writeFile(path, JSON.stringify(result), err => {
                if (err) resolve(console.log('error in file write : ',JSON.stringify(err)));
                resolve(console.log('done'));
            });
        })
    }
}
// const v1Account_2019 = require('../dataFiles/v1AccountData_2019.json');
const v1Account_2019_June = require('../dataFiles/v1AccountData_2019_June.json');
const v1Account_2019_July = require('../dataFiles/v1AccountData_2019_July.json');
const v1CanceledBulkDataData = require('../dataFiles/intranet-64851-canceled-export.json');
// let result = v2AccountConverter.mainConverter(v1Account_2019_July, v1CanceledBulkDataData);

async function findDuplicateAccount(v1AccountBulkData, v1CanceledBulkData) {
    const temp_result = {};
    const result = {};
    for (let temp0 of Object.values(v1AccountBulkData)) {
        for (let v1Account of Object.values(temp0)) {
            if (v1CanceledBulkData[v1Account.id]) {
                if (!temp_result[v1Account.id]) temp_result[v1Account.id] = 1;
                else temp_result[v1Account.id] += 1;
            }
        }
    }
    for (let key of Object.keys(temp_result)) {
        if (temp_result[key] > 1) result[key] = temp_result[key];
    }
    console.log(result)
    return result;
}

// findDuplicateAccount(v1Account_2019_July, v1CanceledBulkDataData).then(result => console.log(' @ @ result : ',result));

async function AccountQuerytest() {
    let v2Reservation = await v2AccountConverter.getV2SqlReservations('16be9e80327b2c0f')[0];
    let v2Account = await v2AccountConverter.generateSQLObject({
        "card": 220000,
            "category": "Reservation",
            "currency": "KRW",
            "date": "2019-07-29",
            "detail": "Created: 2019-07-13\nagency: L\nproduct: Seoul_Regular_남아 \npeople: 5(5/0/0\noption: ",
            "id": "16be9e80327b2c0f",
            "writer": "L"
    }, v2Reservation);
    await Account.insertSQL(v2Account, {});
    console.log('done');
}

async function v2AccountConverterTest(testData, v1CanceledBulkData){
    for (let temp of Object.entries(testData)) {
        let testCase = temp[0];
        let description = temp[1].description;
        let result = temp[1].result;
        let data = temp[1].data;
        console.log(` @@ testCase : ${testCase} / description : ${JSON.stringify(description)}`);
        console.log(`   expected result : ${result}`);
        await v2AccountConverter.mainConverter(data, v1CanceledBulkData);
        console.log('   case done');
        console.log('');
    }
}

const testCase = {
    case1 : {
        description : {canceledData: false, sqlReservationId : 'r25052'},
        result : ['[2a]','[7ca]','[4ra]','[14ra]','[10ca]'],
        data : {
            "2019-07-29" : {
                "-Ljdu17pOMCqdfdBDUAc": {
                    "card": 220000,
                    "category": "Reservation",
                    "currency": "KRW",
                    "date": "2019-07-29",
                    "detail": "Created: 2019-07-13\nagency: L\nproduct: Seoul_Regular_남아 \npeople: 5(5/0/0\noption: ",
                    "id": "16be9e80327b2c0f",
                    "writer": "L"
                },
                "-LkabtXigDUKdP0NRbxB": {
                    "card": -220000,
                    "category": "Reservation",
                    "currency": "KRW",
                    "date": "2019-07-29",
                    "detail": "Modified: 2019-07-25\nagency: L\nproduct: Seoul_Regular_남아\npeople: 3(3/0\noption: ",
                    "id": "16be9e80327b2c0f",
                    "writer": "L"
                },
                "-LkabtXWGkAh6P3cT9FK": {
                    "card": 132000,
                    "category": "Reservation",
                    "currency": "KRW",
                    "date": "2019-07-29",
                    "detail": "Created: 2019-07-25\nagency: L\nproduct: Seoul_Regular_남아 \npeople: 3(3/0/0\noption: ",
                    "id": "16be9e80327b2c0f",
                    "writer": "L"
                },
                "-Lkr8S14LqNU0hSgTgmf": {
                    "card": 168000,
                    "category": "Reservation",
                    "currency": "KRW",
                    "date": "2019-07-29",
                    "detail": "Created: 2019-07-28\nagency: L\nproduct: Seoul_Regular_남쁘아 \npeople: 3(3/0/0\noption: ",
                    "id": "16be9e80327b2c0f",
                    "writer": "L"
                },
                "-Lkr8S19vh6Swh8jGRKY": {
                    "card": -132000,
                    "category": "Reservation",
                    "currency": "KRW",
                    "date": "2019-07-29",
                    "detail": "Modified: 2019-07-28\nagency: L\nproduct: Seoul_Regular_남쁘아\npeople: 3(3/0\noption: ",
                    "id": "16be9e80327b2c0f",
                    "writer": "L"
                },
            }
        }
    },
    case2 : {
        description : {canceledData: false, sqlReservationId : 'r25065'},
        result : ['[1ca]','[6ra]','[9a]','[14ra]','[10ca]'],
        data : {
            "2019-07-29": {
                "-Lkadqp7lH9e3Zwcmbj1": {
                    "card": -360000,
                    "category": "Reservation",
                    "currency": "KRW",
                    "date": "2019-07-29",
                    "detail": "Modified: 2019-07-25\nagency: L\nproduct: Seoul_Regular_쁘남레아\npeople: 3(3/0\noption: [object Object]",
                    "id": "16b4b0c5624596f4",
                    "writer": "L"
                },
                "-Lkadqp3Ci-gOWr8yPoD": {
                    "card": 270000,
                    "category": "Reservation",
                    "currency": "KRW",
                    "date": "2019-07-29",
                    "detail": "Created: 2019-07-25\nagency: L\nproduct: Seoul_Regular_쁘남레아 \npeople: 3(3/0/0\noption: [object Object]",
                    "id": "16b4b0c5624596f4",
                    "writer": "L"
                },
                "-LhA26EHgRO-1Cx2qLh8": {
                    "card": 360000,
                    "category": "Reservation",
                    "currency": "KRW",
                    "date": "2019-07-29",
                    "detail": "Created: 2019-06-12\nagency: L\nproduct: Seoul_Regular_쁘남레아 \npeople: 4(4/0/0\noption: [object Object]",
                    "id": "16b4b0c5624596f4",
                    "writer": "L"
                },
                "-LkpmOHYUuuJEj1YraGx": {
                    "card": 270000,
                    "category": "Reservation",
                    "currency": "KRW",
                    "date": "2019-07-29",
                    "detail": "Created: 2019-07-27\nagency: L\nproduct: Seoul_Regular_쁘남레아 \npeople: 3(3/0/0\noption: [object Object]",
                    "id": "16b4b0c5624596f4",
                    "writer": "L"
                },
                "-LkpmOHcK3QF046HLeX-": {
                    "card": -270000,
                    "category": "Reservation",
                    "currency": "KRW",
                    "date": "2019-07-29",
                    "detail": "Modified: 2019-07-27\nagency: L\nproduct: Seoul_Regular_쁘남레아\npeople: 3(3/0\noption: [object Object]",
                    "id": "16b4b0c5624596f4",
                    "writer": "L"
                },
            }
        },
    },
    case3 : {
        description : {canceledData: false, sqlReservationId : 'r25018'},
        result : ['[1ca]','[5a]','[4ra]'],
        data : {
            "2019-07-29": {
                "-LjZzysgbnLIECUgXOwc": {
                    "card": -144000,
                    "category": "Reservation",
                    "currency": "KRW",
                    "date": "2019-07-29",
                    "detail": "Modified: 2019-07-12\nagency: KK\nproduct: Busan_Regular_에덴루지\npeople: 3(3/0\noption: ",
                    "id": "NM-1562915081073",
                    "writer": "KK"
                },
                "-LjZzsi3ayb4QSFrBcWH": {
                    "card": 144000,
                    "category": "Reservation",
                    "currency": "KRW",
                    "date": "2019-07-29",
                    "detail": "Created: 2019-07-12\nagency: KK\nproduct: Busan_Regular_동부산 에덴루지 \npeople: 3(3/0/0\noption: ",
                    "id": "NM-1562915081073",
                    "writer": "KK"
                },
                "-LjZzyscYu7SEbAZTTyO": {
                    "card": 180000,
                    "category": "Reservation",
                    "currency": "KRW",
                    "date": "2019-07-29",
                    "detail": "Created: 2019-07-12\nagency: KK\nproduct: Busan_Regular_에덴루지 \npeople: 3(3/0/0\noption: ",
                    "id": "NM-1562915081073",
                    "writer": "KK"
                },
            }
        }
    },
    case4 : {
        description : {canceledData: true, sqlReservationId : null},
        result : ['[15ra]','[22ra]','[24ca]'],
        data : {
            "2019-07-27": {
                "-LiW_9aYO-jmR2PkjP5m": {
                    "card": 82000,
                    "category": "Reservation",
                    "currency": "KRW",
                    "date": "2019-07-27",
                    "detail": "Created: 2019-06-29\nagency: P\nproduct: Seoul_Mud_머드-편도ticket주말 \npeople: 2(2/0/0\noption: ",
                    "id": "NM-1561784002964",
                    "writer": "P"
                },
                "-LiW_GYzDAaBTMLQo4AN": {
                    "card": 120000,
                    "category": "Reservation",
                    "currency": "KRW",
                    "date": "2019-07-27",
                    "detail": "Created: 2019-06-29\nagency: P\nproduct: Seoul_Mud_머드-공연일 \npeople: 2(2/0/0\noption: ",
                    "id": "NM-1561784002964",
                    "writer": "P"
                },
                "-LiW_GZ21I8GO4l2EeWE": {
                    "card": -82000,
                    "category": "Reservation",
                    "currency": "KRW",
                    "date": "2019-07-27",
                    "detail": "Modified: 2019-06-29\nagency: P\nproduct: Seoul_Mud_머드-공연일\npeople: 2(2/0\noption: ",
                    "id": "NM-1561784002964",
                    "writer": "P"
                },
            }
        }
    },
    case5 : {
        description: {canceledData: true, sqlReservationId : null},
        result : ['[15ra]','[17a]'],
        data: {
            "2019-07-27" : {
                "-Lkbih4X4bKalfIf0wRn": {
                    "card": -40000,
                    "category": "Reservation",
                    "currency": "KRW",
                    "date": "2019-07-27",
                    "detail": "Modified: 2019-07-25\nagency: T\nproduct: Seoul_Summer_여름포천\npeople: 1(1/0\noption: ",
                    "id": "NM-1563580441106",
                    "writer": "T"
                },
                "-LkBe17ZykOm1kF3OvYc": {
                    "card": 40000,
                    "category": "Reservation",
                    "currency": "KRW",
                    "date": "2019-07-27",
                    "detail": "Created: 2019-07-19\nagency: T\nproduct: Seoul_Summer_여름포천 \npeople: 1(1/0/0\noption: ",
                    "id": "NM-1563580441106",
                    "writer": "T"
                }
            }
        }
    }
};

// v2AccountConverterTest(testCase, v1CanceledBulkDataData);
// v2AccountConverter.mainConverter(v1Account_2019_July, v1CanceledBulkDataData);