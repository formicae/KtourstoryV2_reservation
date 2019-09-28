const fbDB = require('../auth/firebase').database;
const sqlDB = require('../auth/postgresql');
const log = require('../../log');
const TIME_OFFSET_MAP = {'UTC0':0,'UTC+1':-60,'UTC+2':-120,'UTC+3':-180,'UTC+4':-240,'UTC+5':-300,'UTC+6':-360, 'UTC+7':-420,'UTC+8':-480,'UTC+9':-540,'UTC+10':-600,'UTC+11':-660,'UTC+12':-720,'UTC-1':60,'UTC-2':120,'UTC-3':180,'UTC-4':240,'UTC-5':300,'UTC-6':360,'UTC-7':420,'UTC-8':480,'UTC-9':540,'UTC-10':600,'UTC-11':660};
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
let productMap = new Map();
const elasticDB = require('../auth/elastic');

class Product {
    constructor(data) {
        if (!!data.id) this.id = data.id;
        this.name = data.name;
        this.alias = data.alias;
        this.category = data.category;
        this.area = data.area;
        this.timezone = (!data.timezone) ? 'UTC+9' : data.timezone;
        this.incoming = data.incoming;
        this.geos = (!data.geos) ? [] : data.geos;
        this.pickups = (!data.pickups) ? [] : data.pickups;
        this.memo = data.memo;
        this.expenses = (!data.expenses) ? [] : data.expenses;
        this.on = data.on;
        this.deadline = data.deadline;
        this.days = Product.objectPreprocess(data.days);
        this.reserve_begin = data.reserve_begin;
        this.reserve_end = data.reserve_end;
        this.tour_begin = data.tour_begin;
        this.tour_end = data.tour_end;
        this.ignore_options = data.ignore_options;
        this.options = [];
        if (!!data.options && typeof data.options === 'object') {
            data.options.forEach(option => {
                let tempData = {
                    price : option.price,
                    name : option.name,
                    incoming : option.incoming
                };
                this.options.push(tempData);
            })
        }
        this.sales = [];
        data.sales.forEach(saleObj => {
            let tempObj = {};
            if (saleObj.default) {
                tempObj.default = true;
                tempObj.name = saleObj.name;
                tempObj.agency = saleObj.agency;
                tempObj.currency = saleObj.currency;
                tempObj.reserve_begin = saleObj.reserve_begin;
                tempObj.reserve_end = saleObj.reserve_end;
                tempObj.tour_begin = saleObj.tour_begin;
                tempObj.tour_end = saleObj.tour_end;
                tempObj.sales = saleObj.sales;
                this.sales.push(tempObj);
            }
        });
    }

    static getTimeOffset(utc) {
        return TIME_OFFSET_MAP[utc.toUpperCase()];
    }
    static objectPreprocess(object) {
        if (!object) return {};
        if (typeof object === 'string') return JSON.parse(object);
        return object;
    }
    static getProduct(input) {
        return new Promise((resolve, reject) => {
            if (productMap.size === 0) {
                setTimeout(() => { resolve(Product.getProduct(input)) }, 200);
            } else {
                let target = input;
                if (V1_V2_PRODUCT_EXCEPTIONAL_NAME_MAP.has(input)) target = V1_V2_PRODUCT_EXCEPTIONAL_NAME_MAP.get(input);
                resolve(productMap.get(target));
            }
        })
    }

    /**
     * make product for Elastic search
     * @param product {Object} product object from Firebase
     * @returns {{id: *, name: *, alias: *, category: (*|string|string|boolean), area: *, geos: {place: *, lat: *, lon: *}, description: string | string, memo: *, on: *, reserve_begin: *, reserve_end: *, tour_begin: *, tour_end: *, options: {price: *, name: *}}}
     */
    static generateElasticObject(product) {
        return {
            id : product.id,
            name : product.name,
            alias : product.alias,
            category : product.category,
            area : product.area,
            geos : {
                place : product.geos.place,
                lat : product.geos.lat,
                lon : product.geos.lon
            },
            description : product.description,
            memo : product.memo,
            on : product.on,
            reserve_begin : product.reserve_begin,
            reserve_end : product.reserve_end,
            tour_begin : product.tour_begin,
            tour_end : product.tour_end,
            options : {
                name : product.options.name,
                price : product.options.price,
            }
        }
    }

    /**
     * return available price group from Firebase based on tour_date and sales status.
     * @param tour_date {String} tour date
     * @param product {Object} product object
     * @param agency {String} agency
     * @returns {Array}
     */
    static getAvailablePriceGroup(tour_date, product, agency) {
        const availableGroup = [];
        product.sales.forEach(item => {
            if (item.default) {
                availableGroup.push(item);
            } else {
                let reserveValid = Product.checkTourDateInValidRange(Product.getLocalDate(new Date(), product.timezone), item.reserve_begin, item.reserve_end, product.timezone);
                let tourValid = Product.checkTourDateInValidRange(tour_date, item.tour_begin, item.tour_end, product.timezone);
                if (reserveValid && tourValid) {
                    item.byAgency.forEach(agencyData => {
                        if (agencyData.hasOwnProperty('agencies')) {
                            if (agencyData.agencies.includes(agency)) {
                                availableGroup.push(item);
                            }
                        } else {
                            availableGroup.push(item);
                        }
                    });
                }
            }
        });
        return availableGroup;
    }

    /**
     * Compare tour_date and product's begin / end date with year, month, day
     * @param tour_date {Object || String} operation date from SQL or String which contains timezone information
     * @param begin {String} price group's available begin date from Firebase
     * @param end {String} price group's available end date from Firebase
     * @param timezone {String} product's timezone information
     */
    static checkTourDateInValidRange(tour_date, begin, end, timezone) {
        const array = {begin:[],target:[],end:[]};
        if (typeof tour_date === 'string') {
            array.target = tour_date.split('-')
        } else {
            array.target = tour_date.toISOString().slice(0,10).split('-')
        }
        array.begin = begin.trim().split('-');
        array.end = end.trim().split('-');
        const newBegin = new Date(array.begin[0], array.begin[1]-1, array.begin[2]);
        const newTarget = new Date(array.target[0], array.target[1]-1, array.target[2]);
        const newEnd = new Date(array.end[0], array.end[1]-1,array.end[2]);
        log.debug('model', 'checkTourDateInValidRange', `checkTourDateInValidRange : ${newBegin} < ${newTarget} < ${newEnd}`);
        return newBegin <= newTarget && newTarget <= newEnd;
    }

    static getLocalDate(date, utc) {
        if (typeof date === 'string') return new Date(new Date(date) - (Number(Product.getTimeOffset(utc)) * 60000));
        return new Date(date - (Number(Product.getTimeOffset(utc)) * 60000));
    }

    static getReverseTimezoneDate(date, utc) {
        let timeOffset;
        if (typeof utc === 'number') timeOffset = utc;
        else timeOffset = Number(Product.getTimeOffset(utc));
        if (typeof date === 'string') return new Date(new Date(date) - ((-1) * timeOffset * 60000));
        else return new Date(date - ((-1) * timeOffset * 60000));
    }

    static async agencyMatching(data, productData, salesItem, task) {
        let result = {income : 0, currency : null};
        for (let agencyData of salesItem.byAgency) {
            if (agencyData.hasOwnProperty('agencies')) {
                task.has_agencies = true;
                if (agencyData.agencies.includes(data.agency)) {
                    task.priceAgencyMatch = true;
                    result.income = Product.incomeCalculation(data, productData, agencyData.sales);
                    result.currency = agencyData.currency
                }
            } else {
                task.has_agencies = false;
                task.priceAgencyMatch = true;
                result.income = Product.incomeCalculation(data, productData, agencyData.sales);
                result.currency = agencyData.currency
            }
        }
        if (task.has_agencies && !task.priceAgencyMatch) {
            log.warn('Model', 'Product - agencyMatching', `agencyMatching failed : ${data.agency} / product : ${data.product}, ${data.productData.id}`);
        }
        result.task = task;
        return result;
    }

    /**
     * sales matching function
     * @param data {Object} requested data
     * @param productData {Object} product data
     * @param task {Object} internal task object
     * @returns {Promise<{task: Object}>}
     */
    static async salesMatch(data, productData, task) {
        task.salesMatch = false;
        for (let item of productData.sales) {
            if (item.default) {
                task.salesMatch = true;
                task.defaultPrice = true;
                return await this.agencyMatching(data, productData, item, task);
            } else {
                let timezone = (data.hasOwnProperty('timezone')) ? data.timezone : 'UTC+9';
                task.reserveValid = Product.checkTourDateInValidRange(Product.getLocalDate(new Date(), timezone), item.reserve_begin, item.reserve_end, timezone);
                task.tourValid = Product.checkTourDateInValidRange(data.date, item.tour_begin, item.tour_end, timezone);
                if (task.reserveValid && task.tourValid) {
                    task.salesMatch = true;
                    return await this.agencyMatching(data, productData, item, task);
                }
            }
        }
        if (!task.salesMatch) {
            log.warn('Router', 'salesMatch', `sales data matching failed! ${data.product}, ${data.agency}`);
            return {task : task};
        }
    }

    static async productDataExtractFromFB(data) {
        let productExtractTask = {getProduct :false, defaultPrice:false, reserveValid : false, tourValid : false, priceAgencyMatch:false};
        let productData = await Product.getProduct(data.product);
        if (!productData) {
            log.warn('Router', 'productDataExtractFromFB', `product find failed. product : ${data.product}`);
            return {result : false, priceGroup : null, detail : productExtractTask};
        } else {
            productExtractTask.getProduct = true;
            let priceGroup = {
                id : productData.id,
                name : productData.name,
                alias : productData.alias,
                category : productData.category,
                area : productData.area,
                geos : productData.geos,
                currency : null,
                income : 0,
                expenditure : 0,
                bus : {}
            };
            let salesData = await this.salesMatch(data, productData, productExtractTask);
            if (!salesData.task.salesMatch) {
                return {result : false, priceGroup : null, detail:salesData.task};
            } else {
                productExtractTask = salesData.task;
                priceGroup.income = salesData.income;
                priceGroup.currency = salesData.currency;
                console.log('sales data : ',salesData);
                if (!productExtractTask.priceAgencyMatch) {
                    log.warn('product', 'productDataExtractFromFB', `price data matching failed : ${productData.id} / ${productData.alias} / ${data.agency}`);
                    return {result : false, priceGroup : null, detail : productExtractTask};
                } else {
                    if (!!productData.bus) priceGroup.bus = productData.bus;
                    else priceGroup.bus = {company : 'busking', size : 43, cost : 0};
                    return {id : productData.id, result : true, priceGroup : priceGroup, detail : productExtractTask};
                }
            }
        }
    }

    static incomeCalculation(data, product, targetItem) {
        let income = 0;
        targetItem.forEach(priceItem => {
            let price = Product.priceCalculation(priceItem, data);
            income += price;
        });
        if (!!data.options && typeof data.options === 'object' && !!product.options) {
            if (data.options.length > 0 && product.options.length > 0) {
                data.options.forEach(option => {
                    product.options.forEach(productOption => {
                        if (productOption.name === option.name) income += productOption.price * option.number;
                    });
                });
            }
        }
        return income;
    }

    static priceCalculation(item, data) {
        if (item.type === 'adult' && !!Number(data.adult)) return Number(item.net * data.adult) || 0;
        else if (item.type === 'adolescent' && !!Number(data.adolescent)) return Number(item.net * data.adolescent) || 0;
        else if (item.type === 'kid' && !!Number(data.kid)) return Number(item.net * data.kid) || 0;
        else if (item.type === 'infant' && !!Number(data.infant)) return Number(item.net * data.infant) || 0;
        else return 0;
    }

    static insertElastic(product) {
        return new Promise((resolve, reject)=> {
            elasticDB.create({
                index : 'product',
                type : '_doc',
                id : product.id,
                body: product
            },(err, resp) => {
                if (err) {
                    console.log('error : ', JSON.stringify(err))
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    }

}

/**
 * generate productMap for searching product from outside of this module.
 * key of productMap : [Alias], [Area]_[Category]_[Alias], incoming (which is not in ignoreSet), options.incoming
 * @param productMap {Map} result product Map
 * @param ignoreSet {Set} data Set which should not be included in productMap as a key
 * @param product {Object} product object
 * @returns {*}
 */
function productMapProcessing(productMap, ignoreSet, product) {
    let areaCategoryAlias = product.area + '_' + product.category + '_' + product.alias;
    if (product.category !== 'test') {
        if (!ignoreSet.has(product.name) && !ignoreSet.has(product.alias)) {
            productMap.set(product.alias, product);
            productMap.set(areaCategoryAlias, product);
            productMap.set(product.name, product);
            productMap.set(product.id, product);
            if (!!product.incoming) {
                product.incoming.forEach(incoming => {
                    if (!ignoreSet.has(incoming)) productMap.set(incoming, product);
                })
            }
            if (!!product.options) {
                product.options.forEach(option => {
                    if (!!option.incoming) {
                        option.incoming.forEach(incoming => {
                            if (!ignoreSet.has(incoming)) { productMap.set(incoming, product) }
                        });
                    }
                });
            }
        }
    }
    return productMap;
}

/**
 * Query should be like :
 * [reservation.product_id = product.id] &&
 * [product.area = place.area] &&
 * [product.id = {input}]
 * @param product_id {Number} product id
 * @param fbProduct {Object} product object from firebase by trigger (create || update || delete)
 * @returns {Promise<any>}
 */
function changeProductToSQL(product_id, fbProduct) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM reservation, product, place WHERE reservation.product_id = product.id and product.area = place.area and product.id = ${product_id}';
        // id 가 reservation, product에서 겹치지만 여기에서 나오는 id는 query 순서에 의해 reservation의 것이다.
        sqlDB.query(query, (err, result) => {
            const bool = (result.command === 'SELECT' && result.rowCount === 1);
            if (err || bool) reject();
            resolve(result.rows[0])})})
        .then(data => {

        })
}

function monitorProduct() {
    // 1. SQL 에 product 업데이트하러 보내기.
    // 2. Elasticsearch 에 product 업데이트하러 보내기
    // 3. 해당 product_id를 가지는 reservation 을 SQL에서 불러오기
    // 4. 해당 product_id를 가지는 reservation 을 Elasticsearch에서 불러오기
    // 5. Reservation.updateProduct 실행 (reservation 가서 만들어야 함.)
    // 6. 업데이트 된 Reservation -> SQL / Elasticsearch로 다시 보냄.
    fbDB.ref('product').on('child_added', (snapshot, key) => {
        let newProduct = snapshot.val();
        let ignoreSet = new Set(newProduct.ignore_options);
        productMap = productMapProcessing(productMap, ignoreSet, newProduct);
        // Promise.resolve(changeProductToSQL(newProduct.id, newProduct))
    });

    fbDB.ref('product').on('child_changed', (snapshot) => {
        let changedProduct = snapshot.val();
        let ignoreSet = new Set(changedProduct.ignore_options);
        productMap = productMapProcessing(productMap, ignoreSet, changedProduct);
        // changeProductToSQL(changedProduct.id, changedProduct);
    });

    fbDB.ref('product').on('child_removed', (snapshot) => {
        let deletedProduct = snapshot.val();
        let ignoreSet = new Set(deletedProduct.ignore_options);
        if (!ignoreSet.has(deletedProduct.id)) { productMap.delete(deletedProduct.id) }
        if (!!deletedProduct.options) {
            deletedProduct.options.forEach(option => {
                if (!!options.incoming) {
                    option.incoming.forEach(incoming => {
                        if (!ignoreSet.has(incoming)) { productMap.delete(incoming) }
                    })
                }
            })
        }
        // changeProductToSQL(deletedProduct.id, deletedProduct);
    });
}

function testTourDateCheck(id) {
    sqlDB.query(`SELECT tour_date from reservation where id = ${id}`, (err, result) => {
        console.log('date from SQL : ', result.rows[0].tour_date);
        const date = result.rows[0].tour_date;
        const FBbegin = '2018-04-10';
        const FBend = '2018-04-11';
        const timezone = 'UTC+9';
        console.log('FB valid check : ',Product.checkTourDateInValidRange(date, FBbegin, FBend, timezone))
    })
}
function testGetPriceGroup(id) {
    let product;
    Product.getProduct(id)
        .then(result => {
            product = result;
            return new Promise((resolve, reject) => {
                sqlDB.query(`SELECT tour_date from reservation WHERE id = '${id}'`, (err, result) => {
                    console.log(result.rows);
                    const date = result.rows[0].tour_date;
                    console.log('sql database result : ',date);
                    resolve(date); })})})
        .then(tour_date => {
            const finalResult =  Product.checkTourDateInValidRange(tour_date, product.reserve_begin, product.reserve_end, product.timezone)
            console.log(finalResult);
            return finalResult;
        });
}
function testGetProductWithReservation(){
    let finalObj = {};
    Product.getProduct('Seoul_Regular_레남쁘')
        .then(result => {
            Object.keys(result).forEach(key => {finalObj[key] = result[key]})})
        .then(() => {
            return new Promise((resolve, reject) => {
                sqlDB.query(`SELECT * FROM reservation WHERE id = 'Seoul_Regular_레남쁘'`, (err, result) => {
                    resolve(result.rows[0])})})})
        .then((result => {
            Object.keys(result).forEach(key => {
                if (!finalObj[key]) {
                    finalObj[key] = result[key];
                }
            });
            console.log(JSON.stringify(finalObj));
        }));
}

function testOperationDateCheck(){
    let tour_date;
    let product;
    Product.getProduct('Seoul_Regular_레남쁘')
        .then(result => {
            console.log('Before Class : ', [result.sales.default.tour_begin, result.sales.default.tour_end]);
            product = new Product(result);
            console.log('after Class : ', [result.sales.default.tour_begin, result.sales.default.tour_end]);
            return new Promise((resolve, reject) => {
                sqlDB.query(`SELECT * FROM reservation WHERE id = 'Seoul_Regular_레남쁘'`, (err, result) => {
                    resolve(result.rows[0])
                })})})
        .then(result => {
            tour_date = result.tour_date;
            return Product.checkTourDateInValidRange(result.tour_date,product.sales.default.tour_begin, product.sales.default.tour_end, product.timezone)})
        .then(result => {
            console.log('final result : ',result)
        });
}

async function KKdayIncomingUpdate(incomingMap) {
    for (let key of Object.keys(incomingMap)) {
        let incoming = incomingMap[key];
        let productData = await Product.getProduct(key);
        console.log(productData.name, 'before : ', productData.incoming)
        let incomingSet = await new Set(productData.incoming);
        let newIncoming = [];
        for (let each of incomingSet) {
            newIncoming.push(each);
        }
        if (!productData.hasOwnProperty('incoming')) {
            productData.incoming = [];
        }
        if (!newIncoming.includes(incoming)) {
            await newIncoming.push(incoming);
        }
        productData.incoming = newIncoming;
        console.log(productData.name, 'after : ', productData.incoming)
        let data = {};
        data[productData.id] = productData;
        await fbDB.ref('product').update(data);
        console.log();
    }
}

// Product.getProduct('Seoul_Regular_남쁘아').then(result=>console.log(result));
monitorProduct();

const incomingMap = {
    '대구내장산' : 'Magnificent Naejangsan National Park One Day Tour from Daegu',
    '대구이월드' : 'Daegu E-world and Kim Kwangseok-gil Street One Day Tour from Busan',
    '어묵체험' : 'Busan Fish Cake Experience & Local Market Food Trip Half Day Tour',
    'BTS' : 'BTS Fan Day Tour',
    '민속촌우주' : 'Korean Folk Village Uiwang Railbike OOZOO Light Garden One Day Tour',
    '부산딸기' : 'Busan Strawberry Picking & Gamcheon Culture Village One Day Tour',
    '베어스타운' : 'Bears Town Ski Resort Day Tour from Seoul',
    '부산단풍랜덤' : 'Busan Autumn Foliage Random Tour',
    '경주단풍' : 'Gyeongju Autumn Foliage One day Tour',
    '가을팔공산' : 'Palgongsan Natural Park Autumn Foliage Day Tour',
    '속리산' : 'Songnisan National Park Autumn Foliage Tour',
    '단양' : '【夏日私藏景點】清風文化財園區、九景市場、丹陽滿天下 Sky Walk（首爾出發）',
    '대구시티투어' : '【夏日私藏景點】八公山、桐華寺、金光石街、青羅之丘、E-world（大邱出發）',
    '부산Scenic' : '【釜山名勝一日遊】蔚山艮絕岬、竹城教堂、海東龍宮寺、青沙浦天空步道、特麗愛3D美術館',
    '남이섬짚라인' : 'Nami Island and Gapyeong Kalbongsan Zipline Day Tour',
    '동부산에덴루지' : '【韓國釜山一日遊】伊甸園斜坡滑車、九頭山竹林、海東龍宮寺、竹城教堂一日遊',
    '포천' : '【秋季唯美楓之旅】抱川藝術谷、迷你蘋果採摘、香草島樂園一日遊（首爾出發）',
    '부산야경투어' : '【釜山夜景遊】 歷史的 Diorama＆山腹道路、松島海洋公園、虎泉村南日 Bar、荒嶺山',
    '여수' : '【夏日私藏景點】 向日庵、麗水海上纜車、麗水海洋鐵路自行車一日遊',
    '민속촌레일광명' : '【楓遊京畿道】韓國民俗村、光明洞窟、義王鐵道自行車一日遊',
    '제주동부' : '【韓國濟州東部】Eco Land、城山日出峰、萬丈窟、月汀里一日遊',
    '제주서부' : '【韓國濟州西部】挾才海水浴場、山房窟寺、O‘sulloc 綠茶博物館、松岳山一日遊',
    '라이트월드' : 'Wonju Suspension Bridge and Chung ju Light World One Day Tour',
    'DMZ' : 'Cheorwon Korean Demilitarized Zone (DMZ) Day Tour',
    '안동' : '【夏日私藏景點】世界遺產安東河回村、 月映橋、晚休亭一日遊',
    '알파카' : '【江原道新興景點】草泥馬牧場、九峰山觀景臺咖啡街、 JADE GARDEN樹木園春川一日遊',
    '남설' : 'Nami Island & Mountain Seoraksan Day Tour from Seoul',
    '제주벚꽃' : '【濟州賞櫻推薦】三姓穴、東門傳統市場、濟州大學櫻花路、鹿山路一日遊',
    '서울광양구례' : 'Gwangyang Maehwa & Gurye Sansuyu Festival Day Tour from Seoul',
    '태안딸기' : '【韓國鬱金花慶典】泰安鬱金香節＋現採草莓一日遊（首爾出發）',
    '부산보성녹차' : 'Boseong Green Tea Festival from Seoul or Busan / Busan',
    '서울보성녹차' : 'Boseong Green Tea Festival from Seoul or Busan / Seoul',
    '대구벚꽃주' : 'Daegu E-World Cherry Blossom Viewing Day / Night Tour from Busan',
    '남해' : 'Namhae Day Tour from Busan: Geumsan Boriam Temple, Daraengi Village, and Yangmori Sheep Farm',
    '서울해돋이' : 'COEX Fireworks Display and Gyeongpo Beach Sunrise Tour',
    '남이비발디' : 'Nami Island and Vivaldi Ski Resort Day Tour from Seoul',
    '주왕산' : '(한국 관광 메이플 투어) 조완산, 다댕 사원 (부산 출항)',
    '경주벚꽃' : 'Romantic Gyeongju Cherry Blossom Festival (Depart from Busan)',
    '서울진해' : 'Romantic Jinhae Cherry Blossom Festival Day Tour from Seoul',
    '경주' : '[Funtastic Summer] Day Tour from Busan: Gyeongju UNESCO World Heritage Site',
    '에덴감천' : 'Eden Valley Ski Resort and Gamcheon Culture Village Day Tour from Busan',
    '지리산' : 'Jirisan Mountain Autumn Maple Day Tour from Busan',
    '가야산' : 'South Gyeongsang Autumn Maple Day Tour from Busan: Gayasan Mountain & Haeinsa Temple',
    '부산내장산' : 'Jeolla-buk Do Autumn Day Tour: Naejangsan National Park from Busan',
    '대둔산' : 'Daedunsan Mountain Autumn Day Tour from Seoul',
    '오대산' : 'Gangwon-do Maple Day Tour from Seoul: Odaesan National Park and Woljeongsa Temple',
    '외도' : 'Korea Geoje Island Day Tour from Busan: Windy Hill and Oedo Island',
    '부산머드' : '2019 Boryeong Mud Festival & K-POP Concert (From Seoul or Busan) / Busan',
    '머드' : '2019 Boryeong Mud Festival & K-POP Concert (From Seoul or Busan) / Seoul',
    '통영' : 'Busan Day Tour in Korea: Tongyeong Jungang Market, Hallyeosudo Cable Car and Skyline Luge',
    '레송감국' : '[Funtastic Summer] Day Tour: Gamcheon Culture Village, Gimhae Bike, Raspberry Wine Cave, Songdo Skywalk & BIFF Square (Nampo-dong)',
    '태감송해' : 'Busan Day Tour: Haedong Yonggungsa Temple, Gamcheon Culture Village & Taejongdae',
    '서울진도' : 'Jindo Miracle Sea Road Festival Tour from Seoul or Busan / Seoul',
    '부산진도' : 'Jindo Miracle Sea Road Festival Tour from Seoul or Busan / Busan',
    '서울벚꽃랜덤' : 'Seoul Cherry Blossom Day Tour 2019',
    '딸남쁘아' : 'Strawberry Picking Day Tour from Seoul: Nami Island, Petite France & Garden of Morning Calm',
    '전주' : 'Jeonju Hanok Village, Korean Traditional Cuisine Lesson, and Korean Dessert Making Day Tour from Seoul',
    '서울에버' : 'Everland Theme Park Day Tour (Depart from Seoul)',
    '쁘남레아' : 'Chuncheon Day Tour from Seoul: Gangchon Rail Bike, Nami Island, Petite France, and The Garden of Morning Calm',
    '설낙' : 'Mt. Seorak，Naksansa Temple One Day Tour',
    '남쁘아' : 'Day Tour from Seoul: Nami Island, Petite France, and Garden of Morning Calm',
};
// KKdayIncomingUpdate(incomingMap);
module.exports = Product;