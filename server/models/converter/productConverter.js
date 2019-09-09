const sqlDB = require('../../auth/postgresql');
const fbDB = require('../../auth/firebase').database;
const elasticDB = require('../../auth/elastic');
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
const ALL_V2_PRODUCT_ALIAS = ['레송감국',
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
const log = require('../../../log');
const Product = require('../../models/product');

class v2ProductConveter {
    constructor(v1ProductData, v2SQLData) {
        this.fbData = v2ProductConveter.generateFBObject(v1ProductData, v2SQLData);
        this.elasticData = v2ProductConveter.generateElasticObject(v1ProductData, v2SQLData);
    }
    static generateFBObject(v1ProductData, v2SQLData) {
        return new Promise((resolve, reject) => {
            const tempOutput = {};
            const result = {
                id : v2SQLData.id,
                name : v2SQLData.name,
                alias : v2SQLData.alias,
                category : v2SQLData.category || v1ProductData.info.category,
                area : v2SQLData.area || v1ProductData.info.area,
                timezone : 'UTC+9',
                geos : {place : v1ProductData.info.area, location : {lat:0.00,lon:0.00}},
                pickups : [],
                description : v1ProductData.info.description,
                memo : v1ProductData.info.memo,
                expenses : [],
                on : v1ProductData.info.status,
                deadline : v1ProductData.info.deadline,
                days : v1ProductData.info.available.filter((val, idx) => idx < 7),
                reserve_begin : v1ProductData.price.default.reservationDate_from,
                reserve_end : v1ProductData.price.default.reservationDate_to,
                tour_begin : v1ProductData.info.period[0].from,
                tour_end : v1ProductData.info.period[0].to,
                ignore_options : [],
                options : [],
                sales : [{
                    default : true,
                    name : v1ProductData.price.default.title,
                    agency : [],
                    currency : v1ProductData.price.default.byAgencies[0].currency,
                    reserve_begin : v1ProductData.price.default.reservationDate_from,
                    reserve_end : v1ProductData.price.default.reservationDate_to,
                    tour_begin : v1ProductData.price.default.tourDate_from,
                    tour_end : v1ProductData.price.default.tourDate_to,
                    sales : [{type : 'adult', gross : v1ProductData.price.default.byAgencies[0].adult_gross, net : v1ProductData.price.default.byAgencies[0].adult_net},
                        {type : 'kid', gross : v1ProductData.price.default.byAgencies[0].kid_gross, net : v1ProductData.price.default.byAgencies[0].kid_net},
                        {type : 'infant', gross : v1ProductData.price.default.byAgencies[0].infant_gross, net : v1ProductData.price.default.byAgencies[0].infant_net},
                        {type : '-', cost : 0}]
                }]
            };
            if (v1ProductData.price.default.byAgencies[0].agency) {
                result.sales[0].agency = v1ProductData.price.default.byAgencies[0].agency;
            }
            if (v1ProductData.possibles) {
                result.incoming = v1ProductData.possibles;
            }
            if (v1ProductData.info.pickup) {
                v1ProductData.info.pickup.forEach(each => {result.pickups.push({place:each, lat:"", lon:""})});
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
            resolve(tempOutput);
        })
    }

    static generateElasticObject(v1ProductData, v2SQLData) {
        return new Promise((resolve, reject) => {
            const result = {
                id : v2SQLData.id,
                name : v2SQLData.name,
                alias : v2SQLData.alias,
                category : v2SQLData.category || v1ProductData.info.category,
                area : v2SQLData.area || v1ProductData.info.area,
                geos : {place : v2SQLData.area || v1ProductData.info.area, location : {lat:0.00,lon:0.00}},
                description : v1ProductData.info.description,
                memo : v1ProductData.info.memo,
                on : v1ProductData.info.status === "ON",
                reserve_begin : Product.getLocalDate(v1ProductData.price.default.reservationDate_from, 'UTC+9'),
                reserve_end : Product.getLocalDate(v1ProductData.price.default.reservationDate_to,'UTC+9'),
                tour_begin : Product.getLocalDate(v1ProductData.info.period[0].from, 'UTC+9'),
                tour_end : Product.getLocalDate(v1ProductData.info.period[0].to, 'UTC+9'),
                options : []
            };
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
            resolve(result);
        })
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
        // await fbDB.ref('product').remove().then(result => console.log(result));
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

    static async doubleCheckBetweenSQLandElastic(){
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

const v1ProductBulkData = require('../dataFiles/intranet-64851-product-export.json');
const tmpProduct = {
    "-Kxq-TuaU1DVVULpL2LT" : {
        "agency" : {
            "12" : "undefined",
            "BFT" : "undefined",
            "BK" : "undefined",
            "BN" : "Ongoing",
            "CHA" : "undefined",
            "COLA" : "undefined",
            "CR" : "undefined",
            "CRE" : "undefined",
            "CV" : "undefined",
            "ETC" : "undefined",
            "EXP" : "undefined",
            "F" : "Ongoing",
            "GB" : "undefined",
            "GG" : "undefined",
            "GT" : "undefined",
            "HC" : "undefined",
            "HO" : "undefined",
            "HP" : "undefined",
            "HT" : "undefined",
            "ID" : "undefined",
            "INS" : "undefined",
            "JJ" : "undefined",
            "KK" : "Ongoing",
            "KR" : "Ongoing",
            "KT" : "Unassigned",
            "L" : "Ongoing",
            "LOT" : "undefined",
            "P" : "undefined",
            "PL" : "undefined",
            "PS" : "undefined",
            "SJ" : "undefined",
            "SP" : "undefined",
            "T" : "Ongoing",
            "TA" : "undefined",
            "TB" : "undefined",
            "TE" : "Ongoing",
            "TF" : "undefined",
            "TL" : "Ongoing",
            "VE" : "Ongoing",
            "VI" : "Ongoing",
            "WG" : "Ongoing",
            "hana" : "undefined"
        },
        "cost" : {
            "bus" : [ {
                "max" : 43,
                "name" : "Default",
                "size" : [ {
                    "cost" : 0,
                    "max" : 10,
                    "min" : 1
                }, {
                    "cost" : 250000,
                    "max" : 17,
                    "min" : 11
                }, {
                    "cost" : 300000,
                    "max" : 23,
                    "min" : 18
                }, {
                    "cost" : 350000,
                    "max" : 43,
                    "min" : 24
                } ]
            } ],
            "item" : [ {
                "adultAge_max" : 99,
                "adultAge_min" : 19,
                "adult_cost" : 10000,
                "free_cost" : 0,
                "item" : "Nami",
                "kidAge_max" : 12,
                "kidAge_min" : 3,
                "kid_cost" : 7000,
                "pre" : false,
                "youngAge_max" : 18,
                "youngAge_min" : 9,
                "young_cost" : 0
            }, {
                "adultAge_max" : 99,
                "adultAge_min" : 19,
                "adult_cost" : 6000,
                "free_cost" : 0,
                "item" : "Petite",
                "kidAge_max" : 12,
                "kidAge_min" : 3,
                "kid_cost" : 5000,
                "pre" : false,
                "youngAge_max" : 18,
                "youngAge_min" : 13,
                "young_cost" : 5000
            }, {
                "adultAge_max" : 99,
                "adultAge_min" : 19,
                "adult_cost" : 0,
                "free_cost" : 0,
                "item" : "Garden",
                "kidAge_max" : 12,
                "kidAge_min" : 3,
                "kid_cost" : 4500,
                "pre" : false,
                "youngAge_max" : 18,
                "youngAge_min" : 13,
                "young_cost" : 5500
            } ],
            "wage" : 108000
        },
        "id" : "Seoul_Regular_남쁘아",
        "info" : {
            "area" : "Seoul",
            "available" : [ true, true, true, true, true, true, true, true ],
            "cancellation" : "3days before 100%, 2 days before 50%, 1days or tour date 0% refund",
            "category" : "Regular",
            "deadline" : 14,
            "description" : "",
            "exclude" : "",
            "include" : "",
            "itinerary" : "",
            "language" : [ true, false, true, false, true, false, false, false, false, false, false, false ],
            "memo" : "KK: https://www.kkday.com/ko/product/8974\nL: https://www.klook.com/activity/2528-nami-island-garden-morning-calm-seoul/\nF: https://www.indiway.com/en/prod/nami-island-petite-france-garden-of-morning-calm-shuttle-package\nT: https://www.trazy.com/experience/detail/nami-island-petite-france-the-garden-of-morning-calm-tour\nTE: https://www.koreatraveleasy.com/product/nami-island-petite-france-garden-of-morning-calm-1-day-shuttle-package-tour/\nBN: https://www.bnbhero.com/tours/587\nKR: http://korealtrip.com/tours/nami-island-petite-france-garden-morning-calm-day-trip/\nVE: https://www.veltra.com/en/asia/korea/seoul/a/142631\nVI: https://www.viator.com/tours/Seoul/Day-Tour-of-Nami-Island-with-Petite-France-and-Garden-of-Morning-Calm/d973-48881P5\nWG: https://www.waug.com/good/?idx=104931\nTL: https://touristly.com/offers/11585?trip=14629",
            "name" : "남쁘아",
            "others" : "",
            "period" : [ {
                "from" : "2017-01-01",
                "to" : "2020-12-31"
            } ],
            "pickup" : [ "Dongdaemoon" ],
            "status" : "ON"
        },
        "possibles" : [ "Nami + Petite france + The Garden of Morning Calm / Nami Island, Petite France and The Garden of Morning Calm", "남이+쁘띠+아침고요", "Seoul_Regular_남쁘아", "Nami Island, Garden of Morning Calm and More by KTOURSTORYNami + Petite France + The Garden of Morning Calm", "Nami Island &amp Petite France &amp Garden of Morning Calm Shuttle Package", "Seoul Vicinity: NamiIsland + Petite France + Garden of Morning CalmDay Tour - From Dongdaemun History & Culture ParkStation", "Nami Island, Garden of Morning Calm and More Nami + Petite France + The Garden of Morning Calm", "Seoul Vicinity:Nami Island + Petite France + Garden of MorningCalm Day Tour From Hongik Univ. Station", "Nami Island, Garden of Morning Calm & More Nami + Petite France + The Garden of Morning Calm", "Nami Island, Garden of Morning Calm & More Nami + Petite France + Garden (From 27 March)", "Nami Island, Garden of Morning Calm & More Nami + Petite France + Garden", "Nami Island, Petite France and The Garden of Morning Calm Tour", "Seoul Vicinity: NamiIsland + Petite France + Garden of Morning CalmDay Tour - From Hongik Univ. Station", "아남쁘", "Nami Island, Garden of Morning Calm & MoreNami + Petite France + Garden", "겨울아남쁘", "Seoul Vicinity: NamiIsland + Petite France + Garden of Morning CalmDay Tour - From Myeongdong Station", "Nami Island& The Garden of Morning Calm One-day tour Nami + Petite France + The Garden of Morning Calm", "Day Trip to Nami Island with Petite France and Garden of Morning Calm", "Seoul Vicinity:Nami Island + Petite France + Garden of MorningCalm Day Tour - From Dongdaemun History & Culture ParkStation", "Nami Island, Petite France, Garden of Morning Calm, & Gangchon Rail Bike Day Trip from Seoul (KTOURSTORY)Nami Island + Petite France + The Garden of Morning Calm", "Seoul Vicinity:Nami Island + Petite France + Garden of MorningCalm Day Tour - From Hongik Univ. Station", "Seoul Vicinity:Nami Island + Petite France + Garden of MorningCalm Day Tour - From Myeongdong Station", "Gangwon-do Nami Island & The Garden of Morning Calm Day Tour Nami + Petite France + The Garden of Morning Calm", "Nami Island, Garden of Morning Calm & More (Ktourstory) Nami + Petite France + The Garden of Morning Calm", "Nami Island, Garden of Morning Calm and More (Ktourstory) Nami + Petite France + The Garden of Morning Calm", "Nami Island + Petite France + Garden of MorningCalm Day Tour From Dongdaemun History & Culture ParkStation", "Nami Island + Petite France + Garden of MorningCalm Day Tour From Myeongdong Station", "Seoul Vicinity:Nami Island + Petite France + Garden of MorningCalm Day Tour From Myeongdong Station", "Seoul Vicinity:Nami Island + Petite France + Garden of MorningCalm Day Tour From Dongdaemun History & Culture ParkStation", "Seoul Vicinity:Nami Island + Petite France + Garden of MorningCalm Day Tour", "Nami Island, Garden of Morning Calm & More by KTOURSTORY Nami + Petite France + The Garden of Morning Calm", "Nami Island, Garden of Morning Calm and More by KTOURSTORY Nami + Petite France + The Garden of Morning Calm", "Nami + Petite france + The Garden of Morning Calm / Standard Tour", "Nami Island, Petite France, Garden of Morning Calm, and Gangchon Rail Bike Day Trip from Seoul (KTOURSTORY)Nami Island + Petite France + The Garden of Morning Calm" ],
        "price" : {
            "default" : {
                "byAgencies" : [ {
                    "adultAge_max" : 99,
                    "adultAge_min" : 13,
                    "adult_gross" : 65000,
                    "adult_net" : 56000,
                    "agency" : [ "L", "T", "VE", "F", "TE", "SP", "SP", "PS", "GT", "KR", "BN", "CRE", "INS", "BK", "CR", "HP", "WG", "ID", "KT", "ETC", "HT", "TL", "12", "PL", "TA", "TF", "LOT", "JJ", "TB", "SJ", "GB", "BFT", "CV", "CHA", "hana", "HC", "COLA", "HO", "TLO" ],
                    "currency" : "KRW",
                    "infantAge_max" : 2,
                    "infantAge_min" : 0,
                    "infant_gross" : 0,
                    "infant_net" : 0,
                    "kidAge_max" : 12,
                    "kidAge_min" : 3,
                    "kid_gross" : 60000,
                    "kid_net" : 51000
                }, {
                    "adultAge_max" : 99,
                    "adultAge_min" : 13,
                    "adult_gross" : 65000,
                    "adult_net" : 56000,
                    "agency" : [ "KK" ],
                    "currency" : "KRW",
                    "infantAge_max" : 2,
                    "infantAge_min" : 0,
                    "infant_gross" : 0,
                    "infant_net" : 0,
                    "kidAge_max" : 12,
                    "kidAge_min" : 3,
                    "kid_gross" : 60000,
                    "kid_net" : 51000
                }, {
                    "adultAge_max" : 99,
                    "adultAge_min" : 13,
                    "adult_gross" : 65000,
                    "adult_net" : 56000,
                    "agency" : [ "P" ],
                    "currency" : "KRW",
                    "infantAge_max" : 2,
                    "infantAge_min" : 0,
                    "infant_gross" : 0,
                    "infant_net" : 0,
                    "kidAge_max" : 12,
                    "kidAge_min" : 3,
                    "kid_gross" : 60000,
                    "kid_net" : 51000
                }, {
                    "adultAge_max" : 99,
                    "adultAge_min" : 13,
                    "adult_gross" : 63.8,
                    "adult_net" : 51.04,
                    "agency" : [ "VI" ],
                    "currency" : "USD",
                    "infantAge_max" : 2,
                    "infantAge_min" : 0,
                    "infant_gross" : 0,
                    "infant_net" : 0,
                    "kidAge_max" : 12,
                    "kidAge_min" : 3,
                    "kid_gross" : 58,
                    "kid_net" : 46.4
                }, {
                    "adultAge_max" : 99,
                    "adultAge_min" : 13,
                    "adult_gross" : 68,
                    "adult_net" : 51,
                    "agency" : [ "EXP" ],
                    "currency" : "USD",
                    "infantAge_max" : 2,
                    "infantAge_min" : 0,
                    "infant_gross" : 0,
                    "infant_net" : 0,
                    "kidAge_max" : 12,
                    "kidAge_min" : 3,
                    "kid_gross" : 61.8,
                    "kid_net" : 46.35
                }, {
                    "adultAge_max" : 99,
                    "adultAge_min" : 13,
                    "adult_gross" : 72.5,
                    "adult_net" : 51,
                    "agency" : [ "GG" ],
                    "currency" : "USD",
                    "infantAge_max" : 2,
                    "infantAge_min" : 0,
                    "infant_gross" : 0,
                    "infant_net" : 0,
                    "kidAge_max" : 12,
                    "kidAge_min" : 3,
                    "kid_gross" : 66.29,
                    "kid_net" : 46.4
                } ],
                "description" : "Default price option",
                "forAll" : true,
                "reservationDate_from" : "2017-01-01 ",
                "reservationDate_to" : " 2020-12-31",
                "title" : "DEFAULT",
                "tourDate_from" : "2017-01-01 ",
                "tourDate_to" : " 2020-12-31"
            }
        }
    },
    "-Kxq-Tuhzqnk5DGmUjWv" : {
        "agency" : {
            "12" : "undefined",
            "BFT" : "undefined",
            "BK" : "undefined",
            "BN" : "undefined",
            "CR" : "Ongoing",
            "CRE" : "undefined",
            "CV" : "undefined",
            "ETC" : "undefined",
            "EXP" : "undefined",
            "F" : "Ongoing",
            "GB" : "undefined",
            "GG" : "undefined",
            "GT" : "undefined",
            "HP" : "undefined",
            "HT" : "undefined",
            "ID" : "undefined",
            "INS" : "undefined",
            "JJ" : "undefined",
            "KK" : "Ongoing",
            "KR" : "undefined",
            "KT" : "undefined",
            "L" : "Ongoing",
            "LOT" : "undefined",
            "P" : "undefined",
            "PL" : "undefined",
            "PS" : "undefined",
            "SJ" : "undefined",
            "SP" : "undefined",
            "T" : "Ongoing",
            "TA" : "undefined",
            "TB" : "undefined",
            "TE" : "undefined",
            "TF" : "undefined",
            "TL" : "undefined",
            "VE" : "undefined",
            "VI" : "undefined",
            "WG" : "undefined"
        },
        "cost" : {
            "bus" : [ {
                "max" : 43,
                "name" : "Default",
                "size" : [ {
                    "cost" : 0,
                    "max" : 10,
                    "min" : 1
                }, {
                    "cost" : 250000,
                    "max" : 17,
                    "min" : 11
                }, {
                    "cost" : 300000,
                    "max" : 23,
                    "min" : 18
                }, {
                    "cost" : 350000,
                    "max" : 43,
                    "min" : 24
                } ]
            } ],
            "wage" : 0
        },
        "id" : "Seoul_Spring_진해",
        "info" : {
            "area" : "Seoul",
            "available" : [ true, true, true, true, true, true, true, false ],
            "cancellation" : "3days before 100%, 2 days before 50%, 1days or tour date 0% refund",
            "category" : "Spring",
            "deadline" : 14,
            "description" : "",
            "exclude" : "",
            "include" : "",
            "itinerary" : "",
            "language" : [ true, false, true, false, true, false, true, false, false, false, false, false ],
            "memo" : "KK: https://www.kkday.com/ko/product/18772\nT: https://www.trazy.com/experience/detail/jinhae-cherry-blossom-festival-gunhangje-day-tour\nF: https://www.funtastickorea.com/en/prod/jinhae-cherry-blossom-festival-shuttle-package\n",
            "name" : "진해",
            "others" : "",
            "period" : [ {
                "from" : "2019-03-27",
                "to" : "2019-04-07"
            } ],
            "pickup" : [ "Hongdae", "Myungdong", "Dongdaemoon" ],
            "status" : "ON"
        },
        "possibles" : [ "Spring Special: JinhaeCherry Blossom Festival 2017 1 Day Tour - From Dongdaemun H&C Station", "Jinhae Cherry BlossomFestival 1 Day Tour - from Busan (Apr 1~10) - From Haeundae Station", "Jinhae Cherry Blossom Festival (Jinhae Gunhangje) Jinhae Day Tour", "Jinhae Cherry Blossom Festival (Departing From Seoul)", "Spring Special: Jinhae Cherry Blossom Festival 2019 1 Day Tour - from Seoul/Busan (Mar 27~Apr 7)  From Seoul - From Hongik Univ. Station", "Jinhae Cherry Blossom Festival (Jinhae Gunhangje) by KTOURSTORYJinhae Day Tour", "Spring Special: Jinhae Cherry Blossom Festival 2018 1 Day Tour (Mar 30~Apr 9) - From Dongdaemun H&C Station", "Spring Special:Jinhae Cherry Blossom Festival 2018 1 Day Tour(Mar 30~Apr 9) - From Myeongdong Station", "Spring Special:Jinhae Cherry Blossom Festival 2017 1 Day Tour(Apr 1~10) - From Hongik Univ. Station", "Spring Special:Jinhae Cherry Blossom Festival 2019 1 Day Tour -from Seoul/Busan (Mar 29~Apr 7) From Seoul - From MyeongdongStation", "Spring Special: JinhaeCherry Blossom Festival 2017 1 Day Tour (Apr1~10) - From Myeongdong Station", "Spring Special: JinhaeCherry Blossom Festival 2017 1 Day Tour (Apr1~10) - From Hongik Univ. Station", "Spring Special: JinhaeCherry Blossom Festival 2017 1 Day Tour (Apr1~10) - From Dongdaemun H&C Station", "진해 군항제(서울출발)", "진해벚꽃", "Spring Special:Jinhae Cherry Blossom Festival 2018 1 Day Tour(Mar 30~Apr 10) - From Myeongdong Station", "Spring Special:Jinhae Cherry Blossom Festival 2018 1 Day Tour(Mar 30~Apr 10) - From Hongik Univ. Station", "Spring Special:Jinhae Cherry Blossom Festival 2018 1 Day Tour -from Seoul/Busan (Mar 30~Apr 10) - From Seoul - From MyeongdongStation", "Jinhae Cherry Blossom Festival (Jinhae Gunhangje)Jinhae Day Tour", "Jinhae Cherry Blossom Festival (Jinhae Gunhangje) – Departing From Seoul", "Spring Special:Jinhae Cherry Blossom Festival 2018 1 Day Tour -from Seoul/Busan (Mar 30~Apr 10) - From Seoul - From Hongik Univ.Station", "Spring Special:Jinhae Cherry Blossom Festival 2018 1 Day Tour -from Seoul/Busan (Mar 30~Apr 10) - From Seoul - From Dongdaemun H&CStation", "Spring Special:Jinhae Cherry Blossom Festival 2019 1 Day Tour -from Seoul/Busan (Mar 27~Apr 7) From Seoul - From Hongik Univ.Station", "Spring Special:Jinhae Cherry Blossom Festival 2019 1 Day Tour -from Seoul/Busan (Mar 27~Apr 7) From Seoul - From Dongdaemun H&CStation", "Spring Special:Jinhae Cherry Blossom Festival 2019 1 Day Tour -from Seoul/Busan (Mar 27~Apr 7) From Seoul - From MyeongdongStation", "Jinhae Gunhangje Cherry Blossom Festival Day Tour from Seoul by KTOURSTORYJinhae Day Tour" ],
        "price" : {
            "default" : {
                "byAgencies" : [ {
                    "adultAge_max" : 99,
                    "adultAge_min" : 20,
                    "adult_gross" : 50000,
                    "adult_net" : 40000,
                    "agency" : [ "L", "T", "P", "VI", "VE", "F", "TLO" ],
                    "currency" : "KRW",
                    "infantAge_max" : 2,
                    "infantAge_min" : 0,
                    "infant_gross" : 0,
                    "infant_net" : 0,
                    "kidAge_max" : 19,
                    "kidAge_min" : 3,
                    "kid_gross" : 50000,
                    "kid_net" : 40000
                } ],
                "description" : "Default price option",
                "forAll" : true,
                "reservationDate_from" : "2017-01-01 ",
                "reservationDate_to" : " 2019-12-31",
                "title" : "DEFAULT",
                "tourDate_from" : "2019-03-20 ",
                "tourDate_to" : " 2019-04-10"
            }
        }
    },
    "-Kxq-TuSl0xhkmGC5elO" : {
        "agency" : {
            "12" : "undefined",
            "BFT" : "undefined",
            "BK" : "undefined",
            "BN" : "undefined",
            "CHA" : "undefined",
            "COLA" : "undefined",
            "CR" : "undefined",
            "CRE" : "undefined",
            "CV" : "undefined",
            "ETC" : "undefined",
            "EXP" : "undefined",
            "GB" : "undefined",
            "GG" : "undefined",
            "GT" : "undefined",
            "HC" : "undefined",
            "HO" : "undefined",
            "HP" : "undefined",
            "HT" : "undefined",
            "ID" : "undefined",
            "INS" : "undefined",
            "JJ" : "undefined",
            "KK" : "undefined",
            "KR" : "undefined",
            "KT" : "undefined",
            "L" : "undefined",
            "LOT" : "undefined",
            "P" : "undefined",
            "PL" : "undefined",
            "PS" : "undefined",
            "SJ" : "undefined",
            "SP" : "undefined",
            "T" : "undefined",
            "TA" : "undefined",
            "TB" : "undefined",
            "TE" : "undefined",
            "TF" : "undefined",
            "TL" : "undefined",
            "VE" : "undefined",
            "VI" : "undefined",
            "WG" : "undefined",
            "hana" : "undefined"
        },
        "cost" : {
            "bus" : [ {
                "max" : 43,
                "name" : "Default",
                "size" : [ {
                    "cost" : 0,
                    "max" : 10,
                    "min" : 1
                }, {
                    "cost" : 25000,
                    "max" : 17,
                    "min" : 11
                }, {
                    "cost" : 30000,
                    "max" : 23,
                    "min" : 18
                }, {
                    "cost" : 35000,
                    "max" : 43,
                    "min" : 24
                } ]
            } ],
            "item" : [ {
                "adultAge_max" : 65,
                "adultAge_min" : 19,
                "adult_cost" : 17000,
                "free_cost" : 0,
                "item" : "루지",
                "kidAge_max" : 12,
                "kidAge_min" : 3,
                "kid_cost" : 17000,
                "pre" : false,
                "youngAge_max" : 13,
                "youngAge_min" : 9,
                "young_cost" : 17000
            }, {
                "adultAge_max" : 65,
                "adultAge_min" : 19,
                "adult_cost" : 12000,
                "free_cost" : 0,
                "item" : "케이블카",
                "kidAge_max" : 12,
                "kidAge_min" : 3,
                "kid_cost" : 9500,
                "pre" : false,
                "youngAge_max" : 18,
                "youngAge_min" : 13,
                "young_cost" : 12000
            } ],
            "wage" : 108000
        },
        "id" : "Busan_Regular_통영",
        "info" : {
            "area" : "Busan",
            "available" : [ false, true, false, true, false, false, false, true ],
            "cancellation" : "3days before 100%, 2 days before 50%, 1days or tour date 0% refund",
            "category" : "Regular",
            "deadline" : 14,
            "description" : "",
            "exclude" : "",
            "include" : "",
            "itinerary" : "",
            "language" : [ true, false, true, false, false, false, false, false, false, false, false, false ],
            "memo" : "",
            "name" : "통영",
            "others" : "",
            "period" : [ {
                "from" : "2017-01-01",
                "to" : "2022-12-31"
            } ],
            "status" : "ON"
        },
        "option" : [ {
            "option" : "LUGE",
            "possibles" : [ "With Cable Car & Luge", "" ],
            "price" : 15000
        }, {
            "option" : "Ignore",
            "possibles" : [ "With Cable Car" ],
            "price" : 0
        } ],
        "possibles" : [ "Full-Day Tongyeong Tour from Busan", "통영", "[From Busan] Tongyeong One day City Tour", "Tongyeong Day Tour With Cable Car", "Tongyeong Day Tour by KTOURSTORYWith Cable Car & Luge", "Tongyeong Day Tour With Cable Car & Luge", "Tongyeong 1 Day Tour (from Busan Station) - Cable Car + Luge + Joongnag Market + Dongpirang Village", "Tongyeong 1 DaySmall Group Tour (from Busan) - Cable Car & Luge - From HaeundaeStation", "통영 케이블카 + 루지 + 통영중앙시장 + 동피랑마을", "Tongyeong Day Tour by KTOURSTORY With Cable Car & Luge", "Tongyeong Day Tour by KTOURSTORY With Cable Car", "Tongyeong Day Tour by KTOURSTORYWith Cable Car", "Tongyeong Day TourWith Cable Car & Luge" ],
        "price" : {
            "default" : {
                "byAgencies" : [ {
                    "adultAge_max" : 99,
                    "adultAge_min" : 20,
                    "adult_gross" : 70000,
                    "adult_net" : 55000,
                    "agency" : [ "L", "T", "P", "VE", "F", "KK", "TE", "SP", "SP", "KR", "BN", "BK", "CR", "HP", "WG", "ID", "PS", "GT", "KT", "ETC", "HT", "TL", "12", "PL", "TA", "TF", "LOT", "JJ", "TB", "SJ", "GB", "BFT", "INS", "CV", "CRE", "CHA", "TLO" ],
                    "currency" : "KRW",
                    "infantAge_max" : 2,
                    "infantAge_min" : 0,
                    "infant_gross" : 0,
                    "infant_net" : 0,
                    "kidAge_max" : 19,
                    "kidAge_min" : 3,
                    "kid_gross" : 70000,
                    "kid_net" : 55000
                }, {
                    "adultAge_max" : 99,
                    "adultAge_min" : 13,
                    "adult_gross" : 67,
                    "adult_net" : 50,
                    "agency" : [ "GG" ],
                    "currency" : "USD",
                    "infantAge_max" : 2,
                    "infantAge_min" : 0,
                    "infant_gross" : 0,
                    "infant_net" : 0,
                    "kidAge_max" : 12,
                    "kidAge_min" : 3,
                    "kid_gross" : 67,
                    "kid_net" : 50
                }, {
                    "adultAge_max" : 99,
                    "adultAge_min" : 13,
                    "adult_gross" : 63,
                    "adult_net" : 49,
                    "agency" : [ "VI" ],
                    "currency" : "USD",
                    "infantAge_max" : 2,
                    "infantAge_min" : 0,
                    "infant_gross" : 0,
                    "infant_net" : 0,
                    "kidAge_max" : 12,
                    "kidAge_min" : 3,
                    "kid_gross" : 63,
                    "kid_net" : 49
                }, {
                    "adultAge_max" : 99,
                    "adultAge_min" : 13,
                    "adult_gross" : 66.7,
                    "adult_net" : 50.02,
                    "agency" : [ "EXP" ],
                    "currency" : "USD",
                    "infantAge_max" : 2,
                    "infantAge_min" : 0,
                    "infant_gross" : 0,
                    "infant_net" : 0,
                    "kidAge_max" : 12,
                    "kidAge_min" : 3,
                    "kid_gross" : 66.7,
                    "kid_net" : 50.05
                } ],
                "description" : "Default price option",
                "forAll" : true,
                "reservationDate_from" : "2017-01-01 ",
                "reservationDate_to" : " 2020-12-31",
                "title" : "DEFAULT",
                "tourDate_from" : "2017-01-01 ",
                "tourDate_to" : " 2020-12-31"
            }
        }
    },
};
// let result = v2ProductConveter.mainConverter(v1ProductBulkData);
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
// test(tmpProduct)
// fbDB.ref('product').child('test4').update()
// fbDB.ref('product').remove().then(result => console.log(result));
// v2ProductConveter.checkEmptyElasticProduct();
// v2ProductConveter.checkEmptyElasticProduct(v1ProductBulkData)
// v2ProductConveter.doubleCheckBetweenSQLandElastic();
// v2ProductConveter.getElastic('남이엘리').then(result => console.log(result))

module.exports = v2ProductConveter;