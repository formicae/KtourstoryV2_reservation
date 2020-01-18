const sqlDB = require('../../auth/postgresql');
const fbDB = require('../../auth/firebase').database;
const elasticDB = require('../../auth/elastic');
const V1_V2_PRODUCT_EXCEPTIONAL_NAME_MAP = new Map([
    ['Busan_Regular_부산 Scenic', '부산Scenic'],
    ['Seoul_Regular_에버', '서울에버'],
    ['Busan_Regular_대구출발경주','대구경주'],
    ['Seoul_Regular_제천','서울제천'],
    ['Busan_Spring_진해','부산진해'],
    ['Seoul_Summer_보성녹차축제','서울보성녹차'],
    ['Busan_Regular_대구출발안동','대구안동'],
    ['Seoul_Regular_퍼스트 남쁘아','퍼스트남쁘아'],
    ['Seoul_Regular_전주railbike', '전주'],
    ['Seoul_Spring_벚꽃랜덤', '서울벚꽃랜덤'],
    ['Seoul_Spring_벛꽃랜덤','서울벚꽃랜덤'],
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
    ['Seoul_Autumn_설악산', '설악단풍'],
    ['Seoul_Autumn_덕유산_closed', '덕유산'],
    ['Busan_Spring_부산-보성녹차', '부산보성녹차'],
    ['Seoul_Autumn_단풍랜덤', '서울단풍랜덤'],
    ['Seoul_Autumn_단풍랜덤투어', '서울단풍랜덤'],
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
    ['Busan_Autumn_부산 핑크뮬리', '부산핑크뮬리'],
    ['Seoul_Private_Private(S)', '서울프라이빗'],
    ['Busan_Summer_포항불꽃축제','부산포항불꽃']
]);
const ALL_V2_PRODUCT_ALIAS = ['레송감국',
    '김해',
    '대구출발안동',
    '대구에덴벨리',
    '대구출발경주',
    '제주단풍랜덤',
    '부산Rafting',
    '대구내장산',
    '대구에덴밸리',
    'AIRPORT',
    '레남아',
    '외도',
    '태감송해',
    '레남쁘',
    '쁘남레아',
    '서울에버',
    '남쁘',
    '전주',
    '설낙',
    '원마운트',
    '서울벚꽃랜덤',
    '태안딸기',
    '서울진해',
    '서울진도',
    '부산진해',
    '서울보성녹차',
    '엘리시안',
    '남이엘리',
    '지산',
    '딸남쁘',
    '딸남아',
    '베어스타운',
    '딸남쁘아',
    '남이비발디',
    '에덴',
    '에덴감천',
    '남아',
    '남쁘비',
    '경주',
    '남설',
    '부산프라이빗',
    '부산딸기',
    '경주벚꽃',
    '서울광양구례',
    '부산벚꽃랜덤',
    '부산광양구례',
    '라이트월드',
    '부산진도',
    '알파카',
    '짚라인에버',
    '남해',
    '민속촌레일',
    '민속촌',
    '덕유산탑사',
    '남이섬짚라인',
    '대구이월드',
    '일루미아',
    '민속촌레일광명',
    '여수',
    '에덴루지',
    '야간진해',
    '통영',
    '남쁘아',
    '대구벚꽃주',
    '대구벚꽃야',
    '제주벚꽃',
    '제주서부',
    '제주동부',
    '동부산에덴루지',
    '태감오해',
    '서울프라이빗',
    '부국삼오',
    '머드',
    '머드공연일',
    '서울포항불꽃',
    '부산포항불꽃',
    '봉화은어',
    '수상스포츠',
    '대천스카이바이크',
    '포천',
    '오대산',
    '비발디루지남이섬',
    '설악단풍',
    '속리산',
    '대둔산',
    '내장산',
    '가야산',
    '덕유산',
    '지리산',
    '주왕산',
    '딸남',
    '야간벚꽃',
    '부산보성녹차',
    '서울단풍랜덤',
    '부산단풍랜덤',
    '단양',
    '부산에버',
    '경주단풍',
    '에버지산',
    '머드편도',
    '남맥',
    '일산',
    '비발디레슨',
    '캐배미드',
    '캐배골드',
    '서울해돋이',
    '민속촌우주',
    '스킨케어',
    '서부산',
    '안동',
    '부산유채꽃',
    'DMZ',
    '남평',
    '강릉',
    '안성',
    '해인사',
    '부산야경투어',
    '서울워킹투어',
    'ATV',
    '부산Scenic',
    '대구시티투어',
    '부산머드',
    '가을팔공산',
    'BTS',
    '부산내장산',
    '어묵체험',
    '부산핑크뮬리',
    '비발디only'];
const Pickup = require('../../models/pickups');
const log = require('../../../log');
const Product = require('../../models/product');

class v2ProductConveter {
    constructor(v1ProductData, v2SQLData) {
        this.fbData = v2ProductConveter.generateFBObject(v1ProductData, v2SQLData);
        this.elasticData = v2ProductConveter.generateElasticObject(v1ProductData, v2SQLData);
    }
    static async generateFBObject(v1ProductData, v2SQLData) {
        const tempOutput = {};
        const result = {
            id : v2SQLData.id,
            name : v2SQLData.name,
            alias : v2SQLData.alias,
            category : v2SQLData.category || v1ProductData.info.category,
            area : v2SQLData.area || v1ProductData.info.area,
            timezone : 'UTC+9',
            geos : [],
            pickups : [],
            description : v1ProductData.info.description,
            memo : v1ProductData.info.memo,
            expenses : [],
            cost : {},
            on : v1ProductData.info.status,
            deadline : v1ProductData.info.deadline,
            days : v1ProductData.info.available.filter((val, idx) => idx < 7),
            reserve_begin : v1ProductData.price.default.reservationDate_from,
            reserve_end : v1ProductData.price.default.reservationDate_to,
            tour_begin : v1ProductData.info.period[0].from,
            tour_end : v1ProductData.info.period[0].to,
            ignore_options : [],
            options : [],
            sales : []
        };
        Object.entries(v1ProductData.price).forEach(temp0 => {
            let priceGroup = temp0[0];
            let priceData = temp0[1];
            let tempResult = {
                default : priceData.forAll,
                name : priceData.title,
                reserve_begin : priceData.reservationDate_from,
                reserve_end : priceData.reservationDate_to,
                tour_begin : priceData.tourDate_from,
                tour_end : priceData.tourDate_to,
                byAgency : []
            };
            priceData.byAgencies.forEach(agencyData => {
                let agency = [];
                if (agencyData.hasOwnProperty('agency')) agency = agencyData.agency;
                tempResult.byAgency.push({
                    agencies : agency,
                    currency : agencyData.currency,
                    sales : [
                        {type : 'adult', gross : agencyData.adult_gross, net : agencyData.adult_net},
                        {type : 'kid', gross : agencyData.kid_gross, net : agencyData.kid_net},
                        {type : 'infant', gross : agencyData.infant_gross, net : agencyData.infant_net}
                    ]
                })
            });
            result.sales.push(tempResult);
        });
        let geoData = await Pickup.getPickup(v1ProductData.info.area);
        if (!geoData) result.geos.push({place:v1ProductData.info.area, location : {lat : 0, lon : 0}});
        else result.geos.push({place:v1ProductData.info.area, location : geoData.location});
        if (v1ProductData.possibles) {
            result.incoming = v1ProductData.possibles;
        }
        if (v1ProductData.info.pickup) {
            v1ProductData.info.pickup.forEach(async each => {
                let pickupData = await Pickup.getPickup(each)
                result.pickups.push({
                        place : each,
                        location : pickupData.location
                    }
                )});
        }
        if (v1ProductData.cost) {
            let costData = {bus:[], wage:0};
            if (v1ProductData.cost.bus) {
                v1ProductData.cost.bus.forEach(bus => {
                    bus.size.forEach(size => {
                        if (size.max === 43) costData.bus.push({type:'default', cost: size.cost})
                    })
                });
            }
            if (v1ProductData.cost.wage){
                costData.wage = v1ProductData.cost.wage;
            }
            result.cost = costData;
        }
        if (v1ProductData.cost.item) {
            v1ProductData.cost.item.forEach(item => {
                let tempData = {
                    name : item.item,
                    expenses : [
                        {type : 'adult', cost : item.adult_cost},
                        {type : 'kid', cost : item.kid_cost},
                        {type : 'young', cost : item.young_cost},
                        {type : '-', cost : 0},
                    ]
                };
                result.expenses.push(tempData);
            });
        }
        if (v1ProductData.option) {
            Object.keys(v1ProductData.option).forEach(op => {
                if (v1ProductData.option[op].option === 'Ignore') {
                    v1ProductData.option[op].possibles.forEach(each => {
                        if (each) result.ignore_options.push(each);
                    });
                } else {
                    let tempData = {
                        price : v1ProductData.option[op].price,
                        name : v1ProductData.option[op].option,
                        incoming : []
                    };
                    v1ProductData.option[op].possibles.forEach(each => {
                        if (each) tempData.incoming.push(each);
                    });
                    result.options.push(tempData);
                }
            });
        }
        tempOutput[v2SQLData.id] = result;
        return tempOutput;
    }

    static async generateElasticObject(v1ProductData, v2SQLData) {
        const result = {
            id : v2SQLData.id,
            name : v2SQLData.name,
            alias : v2SQLData.alias,
            category : v2SQLData.category || v1ProductData.info.category,
            area : v2SQLData.area || v1ProductData.info.area,
            geos : [],
            description : v1ProductData.info.description,
            memo : v1ProductData.info.memo,
            on : v1ProductData.info.status === "ON",
            reserve_begin : Product.getLocalDate(v1ProductData.price.default.reservationDate_from, 'UTC+9'),
            reserve_end : Product.getLocalDate(v1ProductData.price.default.reservationDate_to,'UTC+9'),
            tour_begin : Product.getLocalDate(v1ProductData.info.period[0].from, 'UTC+9'),
            tour_end : Product.getLocalDate(v1ProductData.info.period[0].to, 'UTC+9'),
            options : []
        };
        let geoData = await Pickup.getPickup(v1ProductData.info.area);
        if (!geoData) result.geos.push({place:v1ProductData.info.area, location : {lat : 0, lon : 0}});
        else result.geos.push({place:v1ProductData.info.area, location : geoData.location});
        if (v1ProductData.option) {
            Object.keys(v1ProductData.option).forEach(op => {
                if (v1ProductData.option[op].option !== 'Ignore') {
                    result.options.push({
                        name : v1ProductData.option[op].option,
                        price : v1ProductData.option[op].price,
                    });
                }
            });
        }
        return result;
    }

    static async insertFB(data){
        return await fbDB.ref('product').update(data);
    }

    static insertElastic(data) {
        if(data._id) delete data._id;
        return new Promise((resolve, reject)=> {
            elasticDB.create({
                index : 'product',
                type : '_doc',
                id : data.id,
                body: data
            },(err, resp) => {
                if (err) {
                    log.warn('Model', 'Reservation-insertElastic', `insert into Elastic failed : ${data.id}`);
                    console.log('error : ', JSON.stringify(err));
                    resolve(false);
                } else {
                    log.debug('Model', 'Reservation-cancelElastic', `insert to Elastic success : ${data.id}`);
                    resolve(true);
                }
            });
        });
    }

    static getElastic(v2ProductAlias) {
        const result = {};
        return new Promise((resolve, reject) => {
            elasticDB.search({
                index:'product',
                type:'_doc',
                body:{
                    query : { match : {alias : v2ProductAlias} }
                }
            }, (err, resp) => {
                if (err || resp.timed_out) {
                    log.warn('Model', 'Reservation-searchElastic', `query from Elastic failed : ${v2ProductAlias}`);
                    throw new Error(`Failed : searchElastic : ${JSON.stringify(err)}`);
                }
                if (resp._shards.successful <= 0) resolve(result);
                resp.hits.hits.forEach(item => {
                    result[item._source.id] = item._source;
                });
                resolve(result);
            });
        })
    }

    static findV2ProductSQL(v1ProductName) {
        return new Promise((resolve, reject) => {
            let v1ProductAlias = v1ProductName.split('_')[2];
            if (V1_V2_PRODUCT_EXCEPTIONAL_NAME_MAP.has(v1ProductName)) v1ProductAlias = V1_V2_PRODUCT_EXCEPTIONAL_NAME_MAP.get(v1ProductName);
            const query = `SELECT * FROM product WHERE alias = '${v1ProductAlias}'`;
            sqlDB.query(query, (err, result) => {
                if (err) resolve(console.log('err : ',JSON.stringify(err)));
                resolve(result.rows[0]);
            })
        })
    }

    static async insertV2DataToFirebaseAndElastic(v1ProductData) {
        let v2SqlProduct = await this.findV2ProductSQL(v1ProductData.id);
        let v2FbProduct = await this.generateFBObject(v1ProductData, v2SqlProduct);
        await this.insertFB(v2FbProduct);
        // let target = v1ProductData.id.split('_')[2]
        // if (V1_V2_PRODUCT_EXCEPTIONAL_NAME_MAP.has(v1ProductData.id)) target = V1_V2_PRODUCT_EXCEPTIONAL_NAME_MAP.get(v1ProductData.id)
        let v2ElasticProduct = await this.generateElasticObject(v1ProductData, v2SqlProduct);
        // if (oneMore.indexOf(target) >= 0) console.log(target, v2ElasticProduct.options, JSON.stringify(v2ElasticProduct.options));
        await this.insertElastic(v2ElasticProduct);
        return true;
    }

    static async mainConverter(v1ProductBulkData) {
        let count = 0;
        await fbDB.ref('product').remove().then(result => console.log(result));
        for (let temp of Object.entries(v1ProductBulkData)) {
            let v1ProductData = temp[1];
            await this.insertV2DataToFirebaseAndElastic(v1ProductData);
            count += 1
        }
        console.log('Product converter : done', count);
    }

    static async checkExceptionalProduct(v1ProductBulkData) {
        for (let v1Product of Object.values(v1ProductBulkData)) {
            let target = v1Product.id.split('_')[2];
            if (V1_V2_PRODUCT_EXCEPTIONAL_NAME_MAP.has(v1Product.id)) target = V1_V2_PRODUCT_EXCEPTIONAL_NAME_MAP.get(v1Product.id);
            if (ALL_V2_PRODUCT_ALIAS.indexOf(target) === -1) console.log('  does not exist : ', target);
        }
        console.log('done');
    }

    static async checkEmptyElasticProduct() {
        let count = 0;
        for (let v2ProductAlias of ALL_V2_PRODUCT_ALIAS) {
            let elasticData = await this.getElastic(v2ProductAlias);
            if (Object.keys(elasticData).length === 0) console.log('!! does not exist : ', v2ProductAlias);
            else {
                count += 1;
            }
        }
        console.log('done', count);
    }

    static async doubleCheckBetweenSQLandElastic() {
        const query = `SELECT alias FROM product`;
        let v2ProductIdArr;
        sqlDB.query(query, async (err, result) => {
            if (err) return console.log('err ', JSON.stringify(err));
            v2ProductIdArr = result.rows;
            let count = 0;
            for (let v2Product of v2ProductIdArr) {
                let v2ProductAlias = v2Product.alias;
                let v2ElasticProduct = await v2ProductConveter.getElastic(v2ProductAlias);
                if (Object.keys(v2ElasticProduct).length === 0) console.log(' no product!',v2ProductAlias);
                count += 1;
            }
            console.log('done !', count)
        });
    }
}

// fbDB.ref('product').once('value', snapshot => {
//     let data = snapshot.val();
//     console.log(JSON.stringify(data['test1']));
// })
async function test(v1Product) {
    let name = ['test1', 'test2', 'test3'];
    let count = 0;
    for (let product of Object.values(v1Product)) {
        let v2SQLProduct;
            await function(){
            sqlDB.query(`SELECT * FROM product WHERE id = '${name[count ++]}'`, async (err, result) => {
                v2SQLProduct = result.rows[0];
                console.log(v2SQLProduct);
                let v2ElasticProduct = await v2ProductConveter.generateElasticObject(product, v2SQLProduct);
                console.log(JSON.stringify(v2ElasticProduct));
            });
        }();
    }
}
const v1ProductBulkData = require('../dataFiles/intranet-64851-product-export.json');
// v2ProductConveter.checkExceptionalProduct(v1ProductBulkData)
// fbDB.ref('product').child('test4').update()
// fbDB.ref('product').remove().then(result => console.log(result));
v2ProductConveter.mainConverter(v1ProductBulkData)

module.exports = v2ProductConveter;
