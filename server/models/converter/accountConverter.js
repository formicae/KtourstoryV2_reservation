const Product = require('../../models/product');
const v2ReservationConverter = require('./reservationConverter');
const Reservation = require('../../models/reservation');
const Account = require('../../models/account');
const sqlDB = require('../../auth/postgresql');
const fbDB = require('../../auth/firebase').database;
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
    }

    /**
     * generating v2 postgreSQL account when category is not reservation
     * @param v1_fb_key {String} v1 unique firebase key for account
     * @param v1Account {Object} v1 Account object
     * @returns {Promise<any>}
     */
    static generateSQLObjectForNonReservation(v1_fb_key, v1Account) {
        return new Promise((resolve, reject) => {
            const result = {
                v1 : v1_fb_key,
                writer: v1Account.writer || v1Account.agency,
                category: v1Account.category || '',
                sub_category : '',
                contents : '',
                card_number : '',
                currency: v1Account.currency,
                income: 0,
                expenditure: 0,
                cash: false,
                memo: v1Account.detail,
                created_date: v1Account.date,
                reservation_id: null
            };
            if (v1Account.hasOwnProperty('cash') && v1Account.cash !== 0) {
                result.cash = true;
                if (v1Account.cash < 0) result.expenditure = (-1) * v1Account.cash;
                else result.income = v1Account.cash;
            } else {
                if (v1Account.card < 0) result.expenditure = (-1) * v1Account.card;
                else result.income = v1Account.card;
            }
            if (v1Account.identifier) result.memo += ` identifier : ${v1Account.identifier}`;
            resolve(result);
        });
    }

    /**
     * generating v2 postgreSQL account object when category is reservation
     * @param v1_fb_key {String} v1 unique firebase key for account
     * @param v1Account {Object} v1 Account object
     * @param v2Reservation {Object} v2 reservation object
     * @returns {Promise<any>}
     */
    static generateSQLObject(v1_fb_key, v1Account, v2Reservation, is_reverseAccount, v2ExistAccount) {
        const result = {
            v1 : v1_fb_key,
            writer: v1Account.writer || v1Account.agency,
            category: v1Account.category || 'Reservation',
            sub_category : '',
            contents : '',
            card_number : '',
            currency: v1Account.currency,
            income: 0,
            expenditure: 0,
            cash: false,
            memo: v1Account.detail,
            created_date: Product.getLocalDate(v1Account.detail.split(' ')[1].split('\n')[0], 'UTC+9') || v1Account.date,
            reservation_id: null
        };
        if (is_reverseAccount) {
            result.memo += ` / reverseAccount 인 ${v2ExistAccount.id} 의 정보 : [category : ${v2ExistAccount.category}], [sub_category : ${v2ExistAccount.sub_category}], [contents : ${v2ExistAccount.contents}]`;
            result.contents = `${v2ExistAccount.id} 의 수정회계`;
        }
        if (v1Account.hasOwnProperty('cash') && v1Account.cash !== 0) {
            result.cash = true;
            if (v1Account.cash < 0) result.expenditure = (-1) * v1Account.cash;
            else result.income = v1Account.cash;
        } else if (v1Account.hasOwnProperty('card') && v1Account.card !== 0){
            if (v1Account.card < 0) result.expenditure = (-1) * v1Account.card;
            else result.income = v1Account.card;
        }
        return new Promise((resolve, reject) => {
            if (v2Reservation) {
                result.reservation_id = v2Reservation.id;
                result.created_date = v2Reservation.created_date;
                resolve(result);
            } else {
                const query = `SELECT id FROM reservation WHERE message_id = '${v1Account.id}'`;
                sqlDB.query(query, (err, queryResult) => {
                    if (err) {
                        console.log('error occurred!', JSON.stringify(err));
                        resolve(false);
                    }
                    result.reservation_id = queryResult.rows[0].id;
                    resolve(result);
                })
            }
        });
    }

    /**
     * generate v2 Elastic object when category is reservation
     * @param v2SqlAccount {Object} v2 postgreSQL account object
     * @param v2Reservation {Object} v2 reservation object
     * @param v1FbTeamData {Object} v1 firebase Team information
     * @returns {Promise<{date: (Date|boolean|*|string), income: (number|*|boolean), expenditure: (number|*|boolean), card_number: string, star: boolean, sub_category: string, memo: *, memo_history: Array, contents: string, reservation: {total: *, product: {area: *, name: *, alias: *, category: *}, agency: *, nationality: string, agency_code: (string|boolean), kid: *, options: *, tour_date: (Date|boolean|*|string), id: *, adult: *, infant: *}, currency: *, id: *, writer: *, created_date: *, category: (*|string), cash: (boolean|cash|{income, expenditure}|*), operation: {guide_message: *, teamId: (*|String), memo: string, guide: string, operator_message: *}} | never>}
     */
    static generateElasticObject(v2SqlAccount, v2Reservation, v1FbTeamData) {
        return v2AccountConverter.findProductWithAccount(v2SqlAccount.id)
            .then((product => {
                const result = {
                    id: v2SqlAccount.id,
                    writer: v2SqlAccount.writer,
                    category: v2SqlAccount.category || 'Reservation',
                    sub_category : v2SqlAccount.sub_category,
                    contents : v2SqlAccount.contents,
                    date : v2Reservation.tour_date,
                    currency: v2SqlAccount.currency,
                    income: v2SqlAccount.income,
                    expenditure: v2SqlAccount.expenditure,
                    cash: v2SqlAccount.cash,
                    memo: v2SqlAccount.memo,
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
                        options: v2Reservation.options || []
                    },
                    operation : {
                        teamId : v1FbTeamData.team_id,
                        guide : v1FbTeamData.guide || '',
                        operator_message : v1FbTeamData.message || '',
                        guide_message : [],
                        memo : ''
                    }
                };
                if (v1FbTeamData.hasOwnProperty('memo')) {
                    Object.keys(v1FbTeamData.memo).forEach(temp => {
                        result.operation.guide_message.push({guide:temp[0], message:temp[1]});
                    });
                }
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

    /**
     * generating v2 Elastic account object when category is not reservation
     * @param v2SqlAccount {Object} v2 postgreSQL account object
     * @returns {{date: *, income: (number|*|boolean), expenditure: (number|*|boolean), card_number: string, star: boolean, sub_category: string, memo: *, memo_history: Array, contents: string, reservation: {}, currency: *, id: *, writer: (*|string), created_date: *, category: (*|string), cash: (boolean|cash|{income, expenditure}|*), operation: {}}}
     */
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

    /**
     * find product object with accout id
     * @param account_id {String} v2 account id
     * @returns {Promise<any>}
     */
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

    /**
     * return v2 postgreSQL reservation object with messgage id
     * @param message_id {String} message id
     * @returns {Promise<any>}
     */
    static getV2SqlReservations(message_id) {
        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM reservation WHERE message_id = '${message_id}'`;
            sqlDB.query(query, (err, result) => {
                if (err) resolve(console.log(`error : ${JSON.stringify(err)}`));
                resolve(result.rows);
            })
        });
    }

    /**
     * return v2 product object with v1 product name
     * @param v1ProductName {String} v1 product name
     */
    static getV2SqlProduct(v1ProductName) {
        let product = v1ProductName.split('_')[2];
        if (V1_V2_PRODUCT_EXCEPTIONAL_NAME_MAP.has(v1ProductName)) product = V1_V2_PRODUCT_EXCEPTIONAL_NAME_MAP.get(v1ProductName);
        return Product.getProduct(product);
    }

    /**
     * return v2 postgreSQL account with reservation id
     * @param reservationId {String} v2 reservation id
     * @returns {Promise<any>}
     */
    static getV2SqlAccountWithReservation(reservationId) {
        return new Promise((resolve, reject) => {
            const output = 'account.id, account.income, account.expenditure, account.cash, account.currency, account.category, account.sub_category, account.contents, reservation.message_id';
            const query = `SELECT ${output} FROM account, reservation WHERE reservation.id = '${reservationId}' and reservation.id = account.reservation_id`;
            sqlDB.query(query, (err, result) => {
                if (err) resovle(console.log(`error : ${JSON.stringify(err)}`));
                resolve(result.rows);
            })
        })
    }

    /**
     * check if same account is already exist in postgreSQL with message_id, income / expenditure, writer, cash.
     * @param v1_fb_key {String} v1 Account id which is automatically made in firebase
     * @returns {Promise<any>}
     */
    static checkIdenticalAccountExist(v1_fb_key) {
        return new Promise((resolve, reject) => {
            const query = `SELECT id FROM account WHERE v1 = '${v1_fb_key}'`;
            sqlDB.query(query, (err, result) => {
                if (err) resolve(console.log('error : ', JSON.stringify(err)));
                resolve(result.rows.length > 0);
            })
        })
    }

    /**
     * check if v1 account and v2 account matches
     * @param v1_fb_key {String} v1 Account key which is made automatically in firebase
     * @param v1Account {Object} v1 Account object
     * @param v2Account {Object} v2 Account object
     * @returns {Promise<*>}
     */
    static async v1v2AccountSales(v1_fb_key, v1Account, v2Account) {
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
        let identical_result = await this.checkIdenticalAccountExist(v1_fb_key);
        return {
            match: ((v1Sales === v2Sales) && (tempV1Sales === (tempV2Sales * (-1))) && (v1Account.currency === v2Account.currency)),
            identical : identical_result,
            v1: tempV1Sales,
            v2: tempV2Sales,
            v1Currency : v1Account.currency,
            v2Currency : v2Account.currency
        };
    }

    /**
     * create account
     * @param obj {Object} mainConverter's internal object. This is used to get team_id without querying elasticsearch.
     * @param v1FbTeamBulkData {Object} v1 Firebase's team information object
     * @param v1_fb_key {String} unique key from firebase v1 account
     * @param v1Account {Object} v1 Account object
     * @param v2Reservation {Object} v2 reservation object
     * @param isReservation {Boolean} flag if target account is for reservation or not (e.g. Tour, Office)
     * @param is_reverseAccount {Boolean} flag if account is made for reverse account
     * @param v2ExistAccount {Object} SQL exist account when is_reverseAccount is true.
     * @returns {Promise<boolean>}
     */
    static async accountCreateAndInsert(obj, v1FbTeamBulkData, v1_fb_key, v1Account, v2Reservation, isReservation, is_reverseAccount, v2ExistAccount) {
        let v2Account, v2SqlAccount, v2ElasticAccount, team_id;
        if (isReservation) {
            v2Account = await this.generateSQLObject(v1_fb_key, v1Account, v2Reservation, is_reverseAccount, v2ExistAccount);
            v2SqlAccount = await Account.insertSQL(v2Account, {});
            if (!v2SqlAccount) return false;
            let v2ExistElasticReservationArr = await Reservation.searchElastic({message_id:v2Reservation.message_id});
            if (v2ExistElasticReservationArr.length > 0) {
                team_id = v2ExistElasticReservationArr[0].team_id;
            } else {
                team_id = obj.teamId_history[v2Reservation.id].team_id;
            }
            let teamData = v1FbTeamBulkData[team_id];
            if (!teamData) console.log('no team id : ',v1_fb_key, v2SqlAccount, obj.teamId_history);
            teamData.team_id = team_id;
            v2ElasticAccount = await this.generateElasticObject(v2SqlAccount, v2Reservation, teamData);
            let insertElasticResult = await Account.insertElastic(v2ElasticAccount, {});
            if (!insertElasticResult) return false;
            await setTimeout(()=>{},25);
            return v2SqlAccount.id;
        } else {
            v2Account = await this.generateSQLObjectForNonReservation(v1_fb_key, v1Account);
            v2SqlAccount = await Account.insertSQL(v2Account, {});
            if (!v2SqlAccount) return false;
            v2ElasticAccount = await this.generateElasticObjectForNonReservation(v2SqlAccount);
            let insertElasticResult = await Account.insertElastic(v2ElasticAccount, {});
            if (!insertElasticResult) return false;
            return v2SqlAccount.id;
        }
    }

    /**
     * cancel reservation for postgreSQL(canceled = true), Firebase(delete), Elastic(canceled = true).
     * @param obj {Object} mainConverter's internal object. This is used to update team_id, g, o for deleted reservation.
     * @param v2Reservation {Object} v2 reservation object
     * @param v1Account {Object} v1 Account object
     * @returns {Promise<boolean>}
     */
    static async reservationCancelSQLandELASTICandFB(obj, v2Reservation, v1Account) {
        let data = {};
        let tour_date, modified_date;
        if (typeof v2Reservation.tour_date === 'object') {
            tour_date = v2Reservation.tour_date.toISOString().split('T')[0];
        } else {
            if (v2Reservation.tour_date.match('T')) {tour_date = v2Reservation.tour_date.split('T')[0];}
            else {tour_date = v2Reservation.tour_date;}
        }
        if (!!v1Account){
            if (v1Account.hasOwnProperty('detail')) {
                modified_date = v1Account.detail.split(' ')[1].split('\n')[0];
            } else {
                modified_date = v1Account.date || v2Reservation.modified_date;
            }
        } else {
            modified_date = v2Reservation.modified_date
        }
        if (typeof modified_date === 'object') modified_date = modified_date.toISOString().slice(0,-2);
        else if (modified_date.match('T')) modified_date = modified_date.split('T')[0];
        if (modified_date[0] !== 2) modified_date = v1Account.date;
        console.log('modified date : ',modified_date);
        let operation = tour_date + '/' + v2Reservation.product_id + '/';
        let cancelSQLresult = await v2ReservationConverter.cancelSQL(v2Reservation.id, modified_date);
        if (!cancelSQLresult) return false;
        let v2ExistElasticReservationArr = await Reservation.searchElastic({message_id: v2Reservation.message_id});
        let team_id = v2ExistElasticReservationArr[0].team_id;
        for (let tempRsv of v2ExistElasticReservationArr) {
            if (tempRsv.team_id && !tempRsv.canceled) team_id = tempRsv.team_id;
        }
        if (v2ExistElasticReservationArr.length > 1) {
            for (let v2ExistElasticReservation of v2ExistElasticReservationArr) {
                if (!v2ExistElasticReservation.canceled) team_id = v2ExistElasticReservation.team_id;
            }
        }
        operation += (team_id + '/' + v2Reservation.id);
        let v2FbReservation = await Reservation.findFbObj(tour_date, v2Reservation.product_id, team_id, v2Reservation.id);
        console.log(`  * Delete from Firebase : ${tour_date}/${v2Reservation.product_id}/${team_id}/${v2Reservation.id} done`);
        if (!obj.teamId_history[v2Reservation.id]) obj.teamId_history[v2Reservation.id] = {};
        obj.teamId_history[v2Reservation.id].team_id = team_id;
        obj.teamId_history[v2Reservation.id].g = !!v2FbReservation ? v2FbReservation.g : false;
        obj.teamId_history[v2Reservation.id].p = !!v2FbReservation ? v2FbReservation.o : false;
        // console.log(`reservationCancelSQLandELASTICandFB. operation : ${operation}, team_id : ${team_id}`);
        data.operation = operation;
        let cancelFbResult = await Reservation.deleteFB(v2Reservation, data, {});
        if (!cancelFbResult) return false;
        return await Reservation.cancelElastic(v2Reservation.id, {});
    }

    /**
     * function for inserting reservation to firebase
     * @param date {String} string form data (e.g '2019-07-03')
     * @param v2ProductId {String} v2 Product Id (e.g. 'p407')
     * @param teamId {String} team id which is stored in firebase, elastic
     * @param v2FbReservation {Object} v2 Firebase reservation object
     * @returns {Promise<any>}
     */
    static reservationFBInsert(date, v2ProductId, teamId, v2FbReservation){
        return new Promise((resolve, reject) => {
            const data = {};
            data[v2FbReservation.id] = v2FbReservation;
            fbDB.ref('operation').child(date).child(v2ProductId).child('teams').child(teamId).child('reservations').update(data, (err) => {
                if (err) resolve(false);
                else {
                    console.log(` * Insert Firebase : ${date}/${v2ProductId}/${teamId}/${v2FbReservation.id} done`);
                    resolve(true);
                }
            });
        })
    }

    /**
     * reservation create & insert to SQL / Firebase / Elastic.
     * in case of v1 canceled data is not present, "canceled" column of  v2NewReservation could be true.
     * in this case, corresponding firebase data had already been deleted.
     * So, search all elastic reservations with messge_id and find "canceled" = false and "team_id" is not null.
     * @param obj {Object} team id, gCheck, oCheck history object for create / canceled reservation in convert function.
     * @param v1CanceledData {Object} v1 canceled data
     * @param v2Product {Object} v2 product data
     * @param canceled {Boolean} canceled
     * @param v2ExistReservation {Object} v2 Reservation object
     * @param v1Account {Object} v1 Account object
     * @returns {Promise<boolean>}
     */
    static async reservationCreateAndInsert(obj, v1CanceledData, v2Product, canceled, v2ExistReservation, v1Account) {
        let v2SQLReservation, v2FbReservation, v2Reservation, team_id;
        let is_operation_memo_update = false;
        if (!v1CanceledData) {
            v2Reservation = await JSON.parse(JSON.stringify(v2ExistReservation));
            let temp = await Reservation.searchElastic({message_id : v2Reservation.message_id});
            let v2ExistElasticReservation = temp[0];
            for (let tempRsv of temp) {
                if (tempRsv.team_id && !tempRsv.canceled) {
                    v2ExistElasticReservation = tempRsv;
                }
            }
            if (v2Reservation.id !== v2ExistElasticReservation.id) {
                v2Reservation = await Reservation.getSQL(v2ExistElasticReservation.id);
            }
            v2Reservation.canceled = canceled;
            if (v1Account.hasOwnProperty('detail')) {
                v2Reservation.created_date = Product.getLocalDate(v1Account.detail.split(' ')[1].split('\n')[0], 'UTC+9') || v1Account.date;
                v2Reservation.modified_date = Product.getLocalDate(v1Account.detail.split(' ')[1].split('\n')[0], 'UTC+9') || v1Account.date;
            }
            let v2ExistFbReservation = await Reservation.findFbObj(v2ExistElasticReservation.tour_date, v2Reservation.product_id, v2ExistElasticReservation.team_id, v2Reservation.id);
            if (v2Reservation.id) delete v2Reservation.id;
            v2SQLReservation = await Reservation.insertSQL(v2Reservation, {});
            if (!v2SQLReservation) return false;
            if (!v2ExistFbReservation) {
                team_id = obj.teamId_history[v2ExistElasticReservation.id].team_id;
                let g = obj.teamId_history[v2ExistElasticReservation.id].g || false;
                let o = obj.teamId_history[v2ExistElasticReservation.id].o || false;
                v2FbReservation = await v2ReservationConverter.generateFbDataWithElastic(v2ExistElasticReservation, g, o);
            } else {
                team_id = v2ExistElasticReservation.team_id;
                v2FbReservation = await v2ReservationConverter.generateSimpleFbData(null, v2SQLReservation, v2ExistFbReservation);
            }
            if (!!v2ExistReservation) {
                if (!!v2ExistReservation.id) {
                    v2FbReservation.operation_memo +=  ` / ${v2ExistReservation.id} 의 수정예약`;
                    is_operation_memo_update = true;
                }
            } else if (!!v2ExistElasticReservation) {
                if (!!v2ExistElasticReservation.id) {
                    v2FbReservation.operation_memo +=  ` / ${v2ExistElasticReservation.id} 의 수정예약`;
                    is_operation_memo_update = true;
                }
            }
            let insertFbResult = await this.reservationFBInsert(v2ExistElasticReservation.tour_date, v2SQLReservation.product_id, team_id, v2FbReservation);
            if (!insertFbResult) return false;
            let v2ElasticReservation = await v2ReservationConverter.elasticDataMatch(null, v2Product, team_id, v2SQLReservation, v2ExistElasticReservation);
            if (is_operation_memo_update) {
                v2ElasticReservation.operation_memo = v2FbReservation.operation_memo;
                if (v2ElasticReservation.memo_history.length === 0) {
                    v2ElasticReservation.memo_history.push({
                        writer: v2ElasticReservation.writer,
                        memo: v2ElasticReservation.operation_memo,
                        date: v2ElasticReservation.created_date
                    });
                } else {v2ElasticReservation.memo_history[0].memo += ` / ${v2ExistReservation.id} 의 수정예약`;}
            }
            let insertElasticResult = await Reservation.insertElastic(v2ElasticReservation, {});
            if (!insertElasticResult) return false;
        } else {
            let team_id = v1CanceledData.team;
            let v2NewReservation = await v2ReservationConverter.generateSQLObject(v1CanceledData, canceled, true);
            v2SQLReservation = await Reservation.insertSQL(v2NewReservation, {});
            if (!v2SQLReservation) return false;
            let v2ExistElasticReservationArr = await Reservation.searchElastic({message_id : v2SQLReservation.message_id});
            v2FbReservation = await v2ReservationConverter.generateSimpleFbData(v1CanceledData, v2SQLReservation, null);
            if (!!v2ExistReservation) {
                if (!!v2ExistReservation.id) {
                    v2FbReservation.operation_memo +=  ` / ${v2ExistReservation.id} 의 수정예약`;
                    is_operation_memo_update = true
                }
            } else if (v2ExistElasticReservationArr.length > 0) {
                v2FbReservation.operation_memo +=  ` / ${v2ExistElasticReservationArr[0].id} 의 수정예약`;
                is_operation_memo_update = true;
            }
            let insertFbResult = await this.reservationFBInsert(v1CanceledData.date, v2Product.id, team_id, v2FbReservation);
            if (!insertFbResult) return false;
            let v2ElasticReservation = await v2ReservationConverter.elasticDataMatch(v1CanceledData, v2Product, v1CanceledData.team, v2SQLReservation, null);
            if (is_operation_memo_update) {
                v2ElasticReservation.operation_memo = v2FbReservation.operation_memo;
                if (v2ElasticReservation.memo_history.length === 0) {
                    v2ElasticReservation.memo_history.push({
                        writer: v2ElasticReservation.writer,
                        memo: v2ElasticReservation.operation_memo,
                        date: v2ElasticReservation.created_date
                    });
                } else {v2ElasticReservation.memo_history[0].memo += ` / ${v2ExistReservation.id} 의 수정예약`;}
            }
            let insertElasticResult = await Reservation.insertElastic(v2ElasticReservation, {});
            if (!insertElasticResult) return false;
        }
        if (!obj.teamId_history[v2SQLReservation.id]) obj.teamId_history[v2SQLReservation.id] = {};
        obj.teamId_history[v2SQLReservation.id].team_id = team_id;
        obj.teamId_history[v2SQLReservation.id].g = !!v2FbReservation ? v2FbReservation.g : false;
        obj.teamId_history[v2SQLReservation.id].o = !!v2FbReservation ? v2FbReservation.o : false;
        return v2SQLReservation;
    }

    /**
     * process called when multiple(over 2) reservation exist in postgreSQL to find reverse or identical Account
     * @param v1_fb_key {String} unique key from v1 firebase Account
     * @param v1Account {Object} v1 Account object
     * @param v2ReservationArr {Array} v2 reservation object array
     * @returns {Promise<{identical: boolean, identicalObj: {}, emptyAccountReservation: Array, reverseObj: {}, fullAccount: {}, reverse: boolean}>}
     */
    static async multipleReservationProcess(v1_fb_key, v1Account, v2ReservationArr) {
        const obj = {fullAccount : {}, emptyAccountReservation : [], reverse : false, reverseObj : {}, identical : false, identicalObj : {}, normalObj : []};
        for (let v2Reservation of v2ReservationArr) {
            let v2AccountArr = await this.getV2SqlAccountWithReservation(v2Reservation.id);
            if (v2AccountArr.length === 0) {obj.emptyAccountReservation.push(v2Reservation)}
            else if (v2AccountArr.length === 2) {obj.fullAccount[v2Reservation.id] = {v2Reservation :v2Reservation, v2AccountArr : v2AccountArr}}
            for (let v2Account of v2AccountArr) {
                let accountSales = await this.v1v2AccountSales(v1_fb_key, v1Account, v2Account);
                if (accountSales.match) {
                    if (accountSales.identical) {
                        obj.identicalObj = true;
                        obj.identicalObj = {v2ReservationId : v2Reservation.id, v2AccountId : v2Account.id};
                    } else {
                        obj.reverse = true;
                        obj.reverseObj = {v2Reservation : v2Reservation, v2Account : v2Account};
                    }
                } else {obj.normalObj.push(v2Reservation);}
            }
        }
        return obj;
    }

    /**
     * main converter for v1 --> v2
     * @param v1AccountBulkData {Object} v1 Account bulk data
     * @param v1CanceledBulkData {Object} v1 Canceled bulk data
     * @param v1FbTeamBulkData {Object} v1 team bulk data from v1 firebase (extracted from operation data)
     * @returns {Promise<void>}
     */
    static async mainConverter(v1AccountBulkData, v1CanceledBulkData, v1FbTeamBulkData) {
        this.totalCount = 0;
        this.passCount = 0;
        this.errorCount = 0;
        this.reservationCreateCount = 0;
        this.reservationCancelCount = 0;
        this.accountCreateCount = 0;
        this.messageIdObj = {singleReservation:{},reservations:{}};
        this.teamId_history = {};
        const taskObj = {error: {}};
        for (let temp of Object.entries(v1AccountBulkData)) {
            let date = temp[0];
            let v1AccountObj = temp[1];
            for (let temp1 of Object.entries(v1AccountObj)) {
                let v1_fb_key = temp1[0];
                let v1Account = temp1[1];
                let minus_v1Account = (v1Account.hasOwnProperty('card') && v1Account.card < 0) || (v1Account.hasOwnProperty('cash') && v1Account.cash < 0);
                let zeroAccount = false;
                if (v1Account.hasOwnProperty('card') && v1Account.card === 0) {
                    if (!v1Account.hasOwnProperty('cash')) zeroAccount = true;
                    else if (v1Account.cash === 0) zeroAccount = true;
                }
                let messageId = v1Account.id;
                let is_duplicateAccount = await this.checkIdenticalAccountExist(v1_fb_key);
                if (is_duplicateAccount || zeroAccount) {taskObj.error[messageId] = await this.taskManager(this,'Pass - 0', null, null, messageId, [], [], null, `no matching canceled data && no reservation in SQL exist : ${is_duplicateAccount} / zeroAccount : ${zeroAccount}`,null)}
                else {
                    if (v1Account.category === 'reservation' || v1Account.category === 'Reservation') {
                        let v1CanceledData = v1CanceledBulkData[messageId];
                        let v2ReservationArr = await this.getV2SqlReservations(messageId);
                        if (!v1CanceledData) {
                            if (v2ReservationArr.length === 0) {taskObj.error[messageId] = await this.taskManager(this,'Pass - 1', null, null, messageId, [], [], null, `no matching canceled data && no reservation in SQL exist`, null)}
                            else if (v2ReservationArr.length === 1) {
                                let v2Reservation = v2ReservationArr[0];
                                let v2Product = await Product.getProduct(v2Reservation.product_id);
                                let v2AccountArr = await this.getV2SqlAccountWithReservation(v2Reservation.id);
                                if (v2AccountArr.length === 0) {
                                    if (!v2Reservation.canceled) {
                                        if (minus_v1Account) {
                                            // (1ca) : v1Canceled data 없음 + 1개 SQL reservation 존재(canceled = false) + 관련 SQL account 없음 + v1 Account 정보가 (-)임 --> reservation canceled = true로 변경 + account 생성
                                            let v2AccountId = await this.accountCreateAndInsert(this, v1FbTeamBulkData, v1_fb_key, v1Account, v2Reservation, true, false, null);
                                            let cancelReservationTask = await this.reservationCancelSQLandELASTICandFB(this, v2Reservation, v1Account);
                                            taskObj[v2AccountId] = await this.taskManager(this, '[1ca]',v2Reservation.id, v2AccountId, messageId, ['cancelSQL', 'cancelElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`,null, cancelReservationTask)
                                        } else {
                                            // (2a) : v1Canceled data 없음 + 1개 SQL reservation 존재(canceled = false) + 관련 SQL account 없음 + v1 Account 정보가 (+) 임--> account만 생성
                                            let v2AccountId = await this.accountCreateAndInsert(this, v1FbTeamBulkData, v1_fb_key, v1Account, v2Reservation, true, false, null);
                                            taskObj[v2AccountId] = await this.taskManager(this, '[2a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`,null, null)
                                        }
                                    } else {
                                        // (3a) : v1Canceled data 없음 + 1개 SQL reservation 존재(canceled = true) + 관련 SQL account 없음 --> account만 생성
                                        let v2AccountId = await this.accountCreateAndInsert(this, v1FbTeamBulkData, v1_fb_key, v1Account, v2Reservation, true, false, null);
                                        taskObj[v2AccountId] = await this.taskManager(this, '[3a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`,null, null)
                                    }
                                } else {
                                    if (v2Reservation.canceled) {
                                        if (v2AccountArr.length === 2) {
                                            let accountSales1 = await this.v1v2AccountSales(v1_fb_key, v1Account, v2AccountArr[0]);
                                            let accountSales2 = await this.v1v2AccountSales(v1_fb_key, v1Account, v2AccountArr[1]);
                                            if (accountSales1.match || accountSales2.match) {
                                                if (accountSales1.identical || accountSales2.identical) {taskObj.error[messageId] = await this.taskManager(this,'Pass - 2', v2Reservation.id, v2AccountArr.map(data=>data.id), messageId, [], [], null, `same account exist in SQL`);}
                                                else {taskObj.error[messageId] = await this.taskManager(this,'Pass - 3', v2Reservation.id, v2AccountArr.map(data=>data.id), messageId, [], [], null, `no identical account exist but two same account exist in SQL`,null);}
                                            } else {
                                                // (4ra) : v1Canceled data 없음 + 1개 SQL reservation 존재(canceled = true) + 관련 SQL account 2개 존재 + v1 Account가 존재하는 SQL account와 무관 --> reservation + account 생성 (canceled 정보는 account 정보에 따라 바뀜)
                                                let v2SQLReservation = await this.reservationCreateAndInsert(this,null, v2Product, minus_v1Account, v2Reservation, v1Account);
                                                let v2AccountId = await this.accountCreateAndInsert(this, v1FbTeamBulkData, v1_fb_key, v1Account, v2SQLReservation, true, false, null);
                                                taskObj[v2AccountId] = await this.taskManager(this, '[4ra]',v2SQLReservation.id, v2AccountId, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`, null, v2SQLReservation)
                                            }
                                        } else {
                                            let accountSales = await this.v1v2AccountSales(v1_fb_key, v1Account, v2AccountArr[0]);
                                            if (accountSales.match) {
                                                if (accountSales.identical) {taskObj.error[messageId] = await this.taskManager(this,'Pass - 4', v2Reservation.id, v2AccountArr[0].id, messageId, [], [], null, `same account exist in SQL`, null);}
                                                else {
                                                    // (5a) : v1Canceled data 없음 + 1개 SQL reservation 존재(canceled = true) + 관련 SQL account 1개 존재 + v1 Account가 reverse 관계 --> account 생성
                                                    let v2AccountId = await this.accountCreateAndInsert(this, v1FbTeamBulkData, v1_fb_key, v1Account, v2Reservation, true, true, v2AccountArr[0]);
                                                    taskObj[v2AccountId] = await this.taskManager(this, '[5a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`, null, null)
                                                }
                                            } else {
                                                // (6ra) : v1Canceled data 없음 + 1개 SQL reservation 존재(canceled = true) + 관련 SQL account 1개 존재 + v1 Account가 존재하는 SQL account와 무관 + --> reservation + account 생성 (canceled 정보는 account 정보에 따라 바뀜)
                                                let v2SQLReservation = await this.reservationCreateAndInsert(this, null, v2Product, minus_v1Account, v2Reservation, v1Account);
                                                let v2AccountId = await this.accountCreateAndInsert(this, v1FbTeamBulkData, v1_fb_key, v1Account, v2SQLReservation, true, false, null);
                                                taskObj[v2AccountId] = await this.taskManager(this, '[6ra]',v2SQLReservation.id, v2AccountId, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`, null, v2SQLReservation)
                                            }
                                        }
                                    } else {
                                        if (v2AccountArr.length === 2) {taskObj.error[messageId] = await this.taskManager(this,'Pass - 5', v2Reservation.id, v2AccountArr[0].id, messageId, [], [], null, `two account exist in non-canceled reservation`, null);}
                                        else {
                                            let accountSales = await this.v1v2AccountSales(v1_fb_key, v1Account, v2AccountArr[0]);
                                            if (accountSales.match) {
                                                if (accountSales.identical) {taskObj.error[messageId] = await this.taskManager(this,'Pass - 6', v2Reservation.id, v2AccountArr[0].id, messageId, [], [], null, `same account exist in SQL`, null);}
                                                else {
                                                    // (7ca) : v1Canceled data 없음 + 1개 SQL reservation 존재(canceled = false) + 관련 SQL account 1개 존재 + v1 Account가 존재하는 SQL account와 reverse 관계 --> reservation을 canceled = true로 변경하고 account 추가
                                                    let v2AccountId = await this.accountCreateAndInsert(this, v1FbTeamBulkData, v1_fb_key, v1Account, v2Reservation, true, true, v2AccountArr[0]);
                                                    let cancelReservationTask = await this.reservationCancelSQLandELASTICandFB(this, v2Reservation, v1Account);
                                                    taskObj[v2AccountId] = await this.taskManager(this, '[7ca]',v2Reservation.id, v2AccountId, messageId, ['cancelSQL', 'cancelElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`, null, cancelReservationTask)
                                                }
                                            } else {
                                                // (8ra) : v1Canceled data 없음 + 1개 SQL reservation 존재(canceled = false) + 관련 SQL account 1개 존재 + v1 Account가 존재하는 SQL account와 무관 --> reservation + account 생성 (canceled 정보는 account 정보에 따라 바뀜)
                                                let v2SQLReservation = await this.reservationCreateAndInsert(this,null, v2Product, minus_v1Account, v2Reservation, v1Account);
                                                let v2AccountId = await this.accountCreateAndInsert(this, v1FbTeamBulkData, v1_fb_key, v1Account, v2SQLReservation, true, false, null);
                                                taskObj[v2AccountId] = await this.taskManager(this, '[8ra]',v2SQLReservation.id, v2AccountId, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`, null, v2SQLReservation)
                                            }
                                        }
                                    }
                                }
                            } else {
                                const obj = await this.multipleReservationProcess(v1_fb_key, v1Account, v2ReservationArr);
                                if (obj.identical) {taskObj.error[messageId] = await this.taskManager(this,'Pass - 7', obj.identicalObj.v2ReservationId, obj.identicalObj.v2AccountId, messageId, [], [], null, `same account exist in SQL`, null)}
                                else if (obj.reverse) {
                                    // reverse인데 fullAccount가 될 수는 없다. 그렇다면 identical에서 걸렸을 것.
                                    let v2Reservation = obj.reverseObj.v2Reservation;
                                    if (v2Reservation.canceled) {
                                        // (9a) : v1Canceled data 없음 + 여러 개 SQL reservation 존재 + 관련 SQL account 중 v1 Account와 reverse 관계인 account 존재 + 해당 reservation 의 canceled = true --> account 생성
                                        let v2AccountId = await this.accountCreateAndInsert(this, v1FbTeamBulkData, v1_fb_key, v1Account, v2Reservation, true, true, obj.reverseObj.v2Account);
                                        taskObj[v2AccountId] = await this.taskManager(this, '[9a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`,null, null)
                                    } else {
                                        // (10ca) : v1Canceled data 없음 + 여러 개 SQL reservation 존재 + 관련 SQL account 중 v1 Account와 reverse 관계인 account 존재 + 해당 reservation 의 canceled = false --> reservation canceled = true로 변경하고 account 생성
                                        let v2AccountId = await this.accountCreateAndInsert(this, v1FbTeamBulkData, v1_fb_key, v1Account, v2Reservation, true, true, obj.reverseObj.v2Account);
                                        let cancelReservationTask = await this.reservationCancelSQLandELASTICandFB(this, v2Reservation, v1Account);
                                        taskObj[v2AccountId] = await this.taskManager(this, '[10ca]',v2Reservation.id, v2AccountId, messageId, ['cancelSQL', 'cancelElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`,null, cancelReservationTask)
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
                                            let v2AccountId = await this.accountCreateAndInsert(this, v1FbTeamBulkData, v1_fb_key, v1Account, v2Reservation, true, false, null);
                                            taskObj[v2AccountId] = await this.taskManager(this, '[11a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`,null, null)
                                        } else {
                                            if (minus_v1Account) {
                                                // (12ca) : v1Canceled data 없음 + 여러 개 SQL reservation 존재(canceled = false) + 존재하는 v2 Account중 v1 Account와 reverse관계인 것 없음 + 관련 account가 0개인 reservation 존재 + v1 Account 정보가 (-) --> reservation canceled = true로 변경 + account 생성
                                                let v2AccountId = await this.accountCreateAndInsert(this, v1FbTeamBulkData, v1_fb_key, v1Account, v2Reservation, true, false, null);
                                                let cancelReservationTask = await this.reservationCancelSQLandELASTICandFB(this, v2Reservation, v1Account);
                                                taskObj[v2AccountId] = await this.taskManager(this, '[12ca]',v2Reservation.id, v2AccountId, messageId, ['cancelSQL', 'cancelElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`,null, cancelReservationTask)
                                            } else {
                                                // (13a) : v1Canceled data 없음 + 여러 개 SQL reservation 존재(canceled = false) + 존재하는 v2 Account중 v1 Account와 reverse관계인 것 없음 + 관련 account가 0개인 reservation 존재 + 해당 reservation의 canceled = false, v1 Account 정보가 (+) --> account 생성
                                                let v2AccountId = await this.accountCreateAndInsert(this, v1FbTeamBulkData, v1_fb_key, v1Account, v2Reservation, true, false, null);
                                                taskObj[v2AccountId] = await this.taskManager(this, '[13a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`,null, null)
                                            }
                                        }
                                    } else {
                                        // (14ra) : v1Canceled data 없음 + 여러 개 SQL reservation 존재 + 존재하는 v2 Account중 v1 Account와 reverse관계인 것 없음 + 관련 account가 0개인 reservation 존재 하지 않음 --> reservation + account 생성 (canceled 정보는 minus_v1Account에 따라 변경됨)
                                        let v2Product = await Product.getProduct(v2Reservation.product_id);
                                        let v2SQLReservation = await this.reservationCreateAndInsert(this, null, v2Product, minus_v1Account, v2Reservation, v1Account);
                                        let v2AccountId = await this.accountCreateAndInsert(this, v1FbTeamBulkData, v1_fb_key, v1Account, v2SQLReservation, true, false, null);
                                        taskObj[v2AccountId] = await this.taskManager(this, '[14ra]',v2SQLReservation.id, v2AccountId, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`,null, v2SQLReservation)
                                    }
                                }
                            }
                        } else {
                            let v2Product = await Product.getProduct(v1CanceledData.product);
                            if (!v2Product) {taskObj.error[messageId] = await this.taskManager(this,'Pass - 8', v2ReservationArr.map(data=>data.id), null, messageId, [], [], null, `no matching v2 product exist! : ${v1CanceledData.product}`,null)}
                            else {
                                if (v2ReservationArr.length === 0) {
                                    // (15ra) : v1 Canceled data 있음 + SQL에 reservation 존재하지 않음 --> reservation + account 생성 (canceled 는 minus_v1Account에 따라 결정)
                                    let v2SQLReservation = await this.reservationCreateAndInsert(this, v1CanceledData, v2Product, minus_v1Account, null, v1Account);
                                    let v2AccountId = await this.accountCreateAndInsert(this, v1FbTeamBulkData, v1_fb_key, v1Account, v2SQLReservation, true, false, null);
                                    taskObj[v2AccountId] = await this.taskManager(this, '[15ra]',v2SQLReservation.id, v2AccountId, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`,null, v2SQLReservation)
                                } else if (v2ReservationArr.length === 1) {
                                    let v2Reservation = v2ReservationArr[0];
                                    if (v2Reservation.canceled) {
                                        let v2AccountArr = await this.getV2SqlAccountWithReservation(v2Reservation.id);
                                        if (v2AccountArr.length === 2) {
                                            let accountSales = await this.v1v2AccountSales(v1_fb_key, v1Account, v2AccountArr[0]);
                                            if (accountSales.match) {taskObj.error[messageId] = await this.taskManager(this,'Pass - 9', v2Reservation.id, v2AccountArr.map(data=>data.id), messageId, [], [], null, `already same account exist in SQL!`)}
                                            else {
                                                // (16ra) : v1 Canceled data 있음 + SQL에 reservation 1개 존재(canceled = true) + SQL에 관련 account 2개 존재 + v1 Account와는 관련없음  --> reservation + account 생성 (canceled 는 minus_v1Account에 따라 결정)
                                                let v2SQLReservation = await this.reservationCreateAndInsert(this, v1CanceledData, v2Product, minus_v1Account, v2Reservation, v1Account);
                                                let v2AccountId = await this.accountCreateAndInsert(this, v1FbTeamBulkData, v1_fb_key, v1Account, v2SQLReservation, true, false, null);
                                                taskObj[v2AccountId] = await this.taskManager(this, '[16ra]',v2SQLReservation.id, v2AccountId, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`,null, v2SQLReservation)
                                            }
                                        } else if (v2AccountArr.length === 1) {
                                            let accountSales = await this.v1v2AccountSales(v1_fb_key, v1Account, v2AccountArr[0]);
                                            if (accountSales.match) {
                                                if (accountSales.identical) {taskObj.error[messageId] = await this.taskManager(this,'Pass - 10', v2Reservation.id, v2AccountArr.map(data=>data.id), messageId, [], [], null, `already same account exist in SQL!`, null)}
                                                else {
                                                    // (17a) : v1 Canceled data 있음 + SQL에 reservation 1개 존재(canceled = true)  + SQL에 관련 account 1개 존재 + v1 Account와 reverse 관계  --> account 생성
                                                    let v2AccountId = await this.accountCreateAndInsert(this, v1FbTeamBulkData, v1_fb_key, v1Account, v2Reservation, true, true, v2AccountArr[0]);
                                                    taskObj[v2AccountId] = await this.taskManager(this, '[17a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`,null, null)
                                                }
                                            } else {
                                                // (18ra) : v1 Canceled data 있음 + SQL에 reservation 1개 존재(canceled = true) + SQL에 관련 account 1개 존재 + v1 Account와 관계 없음 --> 새로운 reservation + account 생성 (canceled 는 minus_v1Account에 따라 결정)
                                                let v2SQLReservation = await this.reservationCreateAndInsert(this, v1CanceledData, v2Product, minus_v1Account, v2Reservation, v1Account);
                                                let v2AccountId = await this.accountCreateAndInsert(this, v1FbTeamBulkData, v1_fb_key, v1Account, v2SQLReservation, true, false, null);
                                                taskObj[v2AccountId] = await this.taskManager(this, '[18ra]',v2SQLReservation.id, v2AccountId, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`,null, v2SQLReservation)
                                            }
                                        } else {
                                            // (19a) : v1 Canceled data 있음 + SQL에 reservation 1개 존재(canceled = true) + SQL에 관련 account 없음 --> account 생성
                                            let v2AccountId = await this.accountCreateAndInsert(this, v1FbTeamBulkData, v1_fb_key, v1Account, v2Reservation, true, false, null);
                                            taskObj[v2AccountId] = await this.taskManager(this, '[19a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`,null, null)
                                        }
                                    } else {
                                        let v2AccountArr = await this.getV2SqlAccountWithReservation(v2Reservation.id);
                                        if (v2AccountArr.length === 0) {
                                            // (20a) : v1 Canceled data 있음 + SQL에 reservation 1개 존재(canceled = false) + SQL에 관련 account 없음 --> account 생성
                                            let v2AccountId = await this.accountCreateAndInsert(this, v1FbTeamBulkData, v1_fb_key, v1Account, v2Reservation, true, false, null);
                                            taskObj[v2AccountId] = await this.taskManager(this, '[20a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`,null, null)
                                        } else {
                                            let accountSales = await this.v1v2AccountSales(v1_fb_key, v1Account, v2AccountArr[0]);
                                            if (accountSales.match) {
                                                if (accountSales.identical) {taskObj.error[messageId] = await this.taskManager(this,'Pass - 11', v2Reservation.id, v2AccountArr.map(data=>data.id), messageId, [], [], null, `already same account exist in SQL!`, null)}
                                                else {
                                                    // (21ca) : v1 Canceled data 있음 + SQL에 reservation 1개 존재(canceled = false) + SQL에 관련 account 1개 있음 + v1 Account와 reverse 관계 --> reservation canceled = true로 변경하고 account 생성
                                                    let v2AccountId = await this.accountCreateAndInsert(this, v1FbTeamBulkData, v1_fb_key, v1Account, v2Reservation, true, true, v2AccountArr[0]);
                                                    let cancelReservationTask = await this.reservationCancelSQLandELASTICandFB(this, v2Reservation, v1Account);
                                                    taskObj[v2AccountId] = await this.taskManager(this, '[21ca]',v2Reservation.id, v2AccountId, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`,null, cancelReservationTask)
                                                }
                                            } else {
                                                // (22ra) : v1 Canceled data 있음 + SQL에 reservation 1개 존재(canceled = false) + SQL에 관련 account 1개 있음 + v1 Account와 아무런 관계 없음 --> 새로운 reservation account 생성 (canceled 는 minus_v1Account에 따라 결정)
                                                let v2SQLReservation = await this.reservationCreateAndInsert(this, v1CanceledData, v2Product, minus_v1Account, v2Reservation, v1Account);
                                                let v2AccountId = await this.accountCreateAndInsert(this, v1FbTeamBulkData, v1_fb_key, v1Account, v2SQLReservation, true, false, null);
                                                taskObj[v2AccountId] = await this.taskManager(this, '[22ra]',v2SQLReservation.id, v2AccountId, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`,null, v2SQLReservation)
                                            }
                                        }
                                    }
                                } else {
                                    const obj = await this.multipleReservationProcess(v1_fb_key, v1Account, v2ReservationArr);
                                    if (obj.identical) {taskObj.error[messageId] = await this.taskManager(this,'Pass - 12', obj.identicalObj.v2ReservationId, obj.identicalObj.v2AccountId, messageId, [], [], null, `already same account exist in SQL!`, null)}
                                    else if (obj.reverse) {
                                        let v2Reservation = obj.reverseObj.v2Reservation;
                                        if (v2Reservation.canceled) {
                                            // (23a) : v1Canceled data 있음 + 여러 개 SQL reservation 존재 + 관련 SQL account 중 v1 Account와 reverse 관계인 account 존재 + 해당 reservation 의 canceled = true --> account 생성
                                            let v2AccountId = await this.accountCreateAndInsert(this, v1FbTeamBulkData, v1_fb_key, v1Account, v2Reservation, true, true, obj.reverseObj.v2Account);
                                            taskObj[v2AccountId] = await this.taskManager(this, '[23a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`,null,null)
                                        } else {
                                            // (24ca) : v1Canceled data 있음 + 여러 개 SQL reservation 존재 + 관련 SQL account 중 v1 Account와 reverse 관계인 account 존재 + 해당 reservation 의 canceled = false --> reservation canceled = true로 변경하고 account 생성
                                            let v2AccountId = await this.accountCreateAndInsert(this, v1FbTeamBulkData, v1_fb_key, v1Account, v2Reservation, true, true, obj.reverseObj.v2Account);
                                            let cancelReservationTask = await this.reservationCancelSQLandELASTICandFB(this, v2Reservation, v1Account);
                                            taskObj[v2AccountId] = await this.taskManager(this, '[24ca]',v2Reservation.id, v2AccountId, messageId, ['cancelSQL', 'cancelElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`,null, cancelReservationTask)
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
                                                let v2AccountId = await this.accountCreateAndInsert(this, v1FbTeamBulkData, v1_fb_key, v1Account, v2Reservation, true, false, null);
                                                taskObj[v2AccountId] = await this.taskManager(this, '[25a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`,null, null)
                                            } else {
                                                if (minus_v1Account) {
                                                    // (26ca) : v1Canceled data 있음 + 여러 개 SQL reservation 존재(canceled = false) + 존재하는 v2 Account중 v1 Account와 reverse관계인 것 없음 + 관련 account가 0개인 reservation 존재 + v1 Account 정보가 (-) --> reservation canceled = true로 변경 + account 생성
                                                    let v2AccountId = await this.accountCreateAndInsert(this, v1FbTeamBulkData, v1_fb_key, v1Account, v2Reservation, true, false, null);
                                                    let cancelReservationTask = await this.reservationCancelSQLandELASTICandFB(this, v2Reservation, v1Account);
                                                    taskObj[v2AccountId] = await this.taskManager(this, '[26ca]',v2Reservation.id, v2AccountId, messageId, ['cancelSQL', 'cancelElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`,null, cancelReservationTask)
                                                } else {
                                                    // (27a) : v1Canceled data 있음 + 여러 개 SQL reservation 존재(canceled = false) + 존재하는 v2 Account중 v1 Account와 reverse관계인 것 없음 + 관련 account가 0개인 reservation 존재 + v1 Account 정보가 (+) --> account 생성
                                                    let v2AccountId = await this.accountCreateAndInsert(this, v1FbTeamBulkData, v1_fb_key, v1Account, v2Reservation, true, false, null);
                                                    taskObj[v2AccountId] = await this.taskManager(this, '[27a]',v2Reservation.id, v2AccountId, messageId, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`,null, null)
                                                }
                                            }
                                        } else {
                                            // (28ra) : v1Canceled data 있음 + 여러 개 SQL reservation 존재 + 존재하는 v2 Account중 v1 Account와 reverse관계인 것 없음 + 관련 account가 0개인 reservation 존재 하지 않음 --> reservation + account 생성 (canceled 정보는 minus_v1Account에 따라 변경됨)
                                            let v2Reservation = null;
                                            if (obj.normalObj.length > 0) {v2Reservation = obj.normalObj[0];}
                                            let v2SQLReservation = await this.reservationCreateAndInsert(this, v1CanceledData, v2Product, minus_v1Account, v2Reservation, v1Account);
                                            let v2AccountId = await this.accountCreateAndInsert(this, v1FbTeamBulkData, v1_fb_key, v1Account, v2SQLReservation, true, false, null);
                                            taskObj[v2AccountId] = await this.taskManager(this, '[28ra]',v2SQLReservation.id, v2AccountId, messageId, ['insertSQL', 'insertElastic'], ['insertSQL', 'insertElastic'], `success - ${v1Account.category}`,null, v2SQLReservation)
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        // (29a) : 예약이 아닌 회계에 대해서 converting 회계 생성
                        let v2AccountId = await this.accountCreateAndInsert(this, null, v1_fb_key, v1Account, null, false, false, null);
                        if (!v2AccountId) {
                            let memo = v1Account.identifier ? v1Account.detail + ' identifier : ' + v1Account.identifier : v1Account.detail;
                            taskObj.error[v1Account.id + '-' + String(new Date())] = await this.taskManager(this, 'Pass - 13',null, null, null, [], [], null, `already same non-reservation account exist in postgreSQL. memo : ${memo}`, null);
                        } else {
                            taskObj[v2AccountId] = await this.taskManager(this, '[21a]',null, v2AccountId, null, [], ['insertSQL', 'insertElastic'], `success - ${v1Account.category} : only account for non-reservation insert`,null, null);
                        }
                    }
                }
            }
        }
        console.log('all task done! : ', {totalCount:this.totalCount, errorCount : this.errorCount, passCount : this.passCount, reservationCreateCount : this.reservationCreateCount, accountCreateCount : this.accountCreateCount, missingCount : this.totalCount - this.errorCount - this.passCount - this.reservationCreateCount - this.reservationCancelCount - this.accountCreateCount});
    }

    /**
     * task manager for account main converter
     * @param obj {Object} main converter's internal object for counting / storing history
     * @param type {String} task type (e.g. [2a], [15ra], ...)
     * @param v2ReservationId {String} v2 reservation id
     * @param v2AccountId {String || boolean} v2 account id
     * @param message_id {String} message id
     * @param reservationTask {Array} processed task for reservation related database (e.g. insertSQL, insertElastic, insertFB, ...)
     * @param accountTask {Array} processed task for account related database (e.g insertSQL, insertElastic, ...)
     * @param message {String} message for each task
     * @param error {String} error message for each task
     * @param additionalTaskStaus {Object || Boolean} additional task like reservation create / cancel status
     * @returns {{reservation_task: (*|Array), v2_a_id: *, v1_id: *, v2_r_id: *, account_task: (*|Array), type: *, message: (*|string), error: (*|null)} || Error}
     */
    static taskManager(obj, type, v2ReservationId, v2AccountId, message_id, reservationTask, accountTask, message, error, additionalTaskStaus) {
        let typeArr;
        obj.totalCount += 1;
        if (!v2AccountId) {
            console.log(` ## Account creation Error : ${type} / ${v2ReservationId} / ${message_id}`);
            obj.errorCount += 1;
            return new Error(`${type} / ${v2ReservationId} / ${message_id}`);
        }
        if (type[0] === "[") {
            typeArr = type.split('').slice(1, -1);
            if (!obj.messageIdObj.reservations[message_id]) obj.messageIdObj.reservations[message_id] = {canceled : new Set(), nonCanceled : new Set(), history:{}, count : 0};
            obj.messageIdObj.reservations[message_id].count += 1;
            if (typeArr.indexOf('ra') !== -1) {
                if (!additionalTaskStaus) {
                    console.log(` ## Reservation creation Error : ${type} / ${v2ReservationId} / ${message_id} / ${v2AccountId}`);
                    obj.errorCount += 1;
                    return new Error(`${type} / ${v2ReservationId} / ${message_id} / ${v2AccountId}`);;
                }
                obj.messageIdObj.reservations[message_id].nonCanceled.add(v2ReservationId);
                if (!obj.messageIdObj.reservations[message_id].history[v2ReservationId]) obj.messageIdObj.reservations[message_id].history[v2ReservationId] = [];
                obj.messageIdObj.reservations[message_id].history[v2ReservationId].push('ra');
                obj.reservationCreateCount += 1;
            } else if (typeArr.indexOf('ca') !== -1) {
                if (!additionalTaskStaus) {
                    console.log(` ## Reservation cancel Error : ${type} / ${v2ReservationId} / ${message_id} / ${v2AccountId}`);
                    obj.errorCount += 1;
                    return new Error(`${type} / ${v2ReservationId} / ${message_id} / ${v2AccountId}`);;;
                }
                if (obj.messageIdObj.reservations[message_id].nonCanceled.has(v2ReservationId)) {obj.messageIdObj.reservations[message_id].nonCanceled.delete(v2ReservationId);}
                obj.messageIdObj.reservations[message_id].canceled.add(v2ReservationId);
                if (!obj.messageIdObj.reservations[message_id].history[v2ReservationId]) obj.messageIdObj.reservations[message_id].history[v2ReservationId] = [];
                obj.messageIdObj.reservations[message_id].history[v2ReservationId].push('ca');
                obj.reservationCancelCount += 1;
            } else if (typeArr.indexOf('a') !== -1) {
                if (!obj.messageIdObj.reservations[message_id].history[v2ReservationId]) obj.messageIdObj.reservations[message_id].history[v2ReservationId] = [];
                obj.messageIdObj.reservations[message_id].history[v2ReservationId].push('a');
                obj.accountCreateCount += 1;
            }
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

    /**
     * data extract from bulk data by year, month
     * @param v1AccountBulkData {Object} v1 Account bulk data
     * @param year {Number} year information
     * @param month {Number || String} for number, only matching month will be extracted. for string, following rule is being applied
     * @param path {String} data save path
     * @returns {Promise<any>}
     */
    static accountDataExtractByMonth(v1AccountBulkData, year, month, path) {
        let result = {};
        Object.entries(v1AccountBulkData).forEach(temp => {
            let v1_fb_key = temp[0];
            let v1Account = temp[1];
            let dateArr = v1Account.date.trim().split('-');
            let date = v1Account.date;
            if (!month) {
                if (Number(dateArr[0]) === year) result = this.dataStore(result, v1Account, date, v1_fb_key);
            } else if (month === '~3') {
                if (Number(dateArr[0]) === year && Number(dateArr[1]) <= 3) result = this.dataStore(result, v1Account, date, v1_fb_key);
            } else if (month === '4~6') {
                if (Number(dateArr[0]) === year && Number(dateArr[1]) >= 4 && Number(dateArr[1]) <= 6) result = this.dataStore(result, v1Account, date, v1_fb_key);
            } else if (month === '~6') {
                if (Number(dateArr[0]) === year && Number(dateArr[1]) <= 6) result = this.dataStore(result, v1Account, date, v1_fb_key);
            } else if (month === '7~9') {
                if (Number(dateArr[0]) === year && Number(dateArr[1]) >= 7 && Number(dateArr[1]) <= 9) result = this.dataStore(result, v1Account, date, v1_fb_key);
            } else if (month === '7~') {
                if (Number(dateArr[0]) === year && Number(dateArr[1]) >= 7) result = this.dataStore(result, v1Account, date, v1_fb_key);
            } else if (month === '~9') {
                if (Number(dateArr[0]) === year && Number(dateArr[1]) <= 9) result = this.dataStore(result, v1Account, date, v1_fb_key);
            } else if (month === '10~'){
                if (Number(dateArr[0]) === year && Number(dateArr[1]) >= 10) result = this.dataStore(result, v1Account, date, v1_fb_key);
            } else {
                if (Number(dateArr[0]) === year && Number(dateArr[1]) === month) result = this.dataStore(result, v1Account, date, v1_fb_key);
            }
        });
        return new Promise((resolve, reject) => {
            fs.writeFile(path, JSON.stringify(result), err => {
                if (err) resolve(`error in file write : ${JSON.stringify(err)}`);
                resolve('done');
            });
        })
    }
    
    static dataStore(result, v1Account, date, v1_fb_key) {
        if (v1Account.category !== 'reservation' && v1Account.category !== 'Reservation') console.log(' non-reservation : ',v1Account)
        if (!result.hasOwnProperty(date)) result[date] = {};
        result[date][v1_fb_key] = v1Account;
        return result;
    }
    
    static fbTeamDataProcess(v1FbTeamBulkData, filePath) {
        const result = {};
        Object.values(v1FbTeamBulkData).forEach(data => {
            Object.entries(data).forEach(temp => {
                let key = temp[0];
                result[key] = temp[1];
            });
        });
        return new Promise((resolve, reject) => {
            fs.writeFile(filePath, JSON.stringify(result), err => {
                if (err) resolve(`error in file write : ${JSON.stringify(err)}`);
                resolve('done');
            });
        })
    }
}

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

const v1AccountBulkData = require('../dataFiles/intranet-64851-account-export.json');
const v1Account_2019_July = require('../dataFiles/v1AccountData_2019_July.json');
// const v1Account_2019_October = require('../dataFiles/v1AccountData_2019_October.json');
const v1CanceledBulkDataData = require('../dataFiles/intranet-64851-canceled-export.json');
const v1FbTeamBulkData = require('../dataFiles/v1FbTeamBulkData_noDate.json');

// v2AccountConverter.accountDataExtractByMonth(v1AccountBulkData, 2019, 8, 'server/models/dataFiles/v1AccountData_2019_October.json').then(result => console.log('result : ', result));
// v2AccountConverter.reservationCancelSQLandELASTICandFB({tour_date: '2019-07-15',product_id:'p360',id:'r32623'}).then(result=>console.log(result));
// v2AccountConverterTest(testCase, v1CanceledBulkDataData);
v2AccountConverter.mainConverter(v1Account_2019_July, v1CanceledBulkDataData, v1FbTeamBulkData);
// v2AccountConverter.mainConverter({'2019-07-19' : {
//         "-LjmkzfaD75Fr2-EfEAP": {
//             "card": 280000,
//             "category": "Reservation",
//             "currency": "KRW",
//             "date": "2019-07-16",
//             "detail": "Created: 2019-07-14\nagency: L\nproduct: Busan_Regular_통영 \npeople: 4(4/0/0\noption: [object Object]",
//             "id": "16b6b4af10939cbc",
//             "writer": "L"
//         }}}, v1CanceledBulkDataData, v1FbTeamBulkData);
// v2AccountConverter.fbTeamDataProcess(v1FbTeamBulkData, 'server/models/dataFiles/v1FbTeamBulkData_noDate.json').then(result => console.log('result : ',result));

const v2Reservation = {
    message_id: 'NM-1560833492407',
    product_id: 'p380',
    agency: 'BN',
    writer: 'BN',
    tour_date: new Date('2019-07-31T09:00:00.000'),
    options: [],
    adult: 3,
    kid: 1,
    infant: 0,
    canceled: false,
    created_date: new Date('2019-06-18T04:51:32.000'),
    modified_date: new Date('2019-06-18T04:51:32.000'),
    id: 'r49859',
    agency_code: 'NM-1560833492407',
    nationality: 'RUSSIAN FEDERATION' };

const teamV1Account = {
    "card": 0,
    "category": "Reservation",
    "currency": "KRW",
    "date": "2019-07-18",
    "detail": "Created: 2019-07-11\nagency: GT\nproduct: Busan_Private_Private(B) \npeople: 3(3/0/0\noption: ",
    "id": "NM-1562888720981",
    "writer": "GT"
};
// v2AccountConverter.reservationCancelSQLandELASTICandFB(v2Reservation).then(result => console.log('result : ',result));