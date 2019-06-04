const fbDB = require('../auth/firebase').database;
const sqlDB = require('../auth/postgresql');
const TIME_OFFSET_MAP = {'UTC0':0,'UTC+1':-60,'UTC+2':-120,'UTC+3':-180,'UTC+4':-240,'UTC+5':-300,'UTC+6':-360, 'UTC+7':-420,'UTC+8':-480,'UTC+9':-540,'UTC+10':-600,'UTC+11':-660,'UTC+12':-720,'UTC-1':60,'UTC-2':120,'UTC-3':180,'UTC-4':240,'UTC-5':300,'UTC-6':360,'UTC-7':420,'UTC-8':480,'UTC-9':540,'UTC-10':600,'UTC-11':660};
let productMap = new Map();

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
        })
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
                resolve(productMap.get(input));
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
     * make object for postgreSQL
     * @param product {Object} product object from Firebase
     * @returns {{id: *, name: *, alias: *, category: (*|string|string|boolean), area: *, geos: (*|geos|{place, lat, lon}|Array)}}
     */
    static generateSQLObject(product) {
        return {
            id : product.id,
            name : product.name,
            alias : product.alias,
            category : product.category,
            area : product.area,
            geos : product.geos
        };
    }

    /**
     * return available price group from Firebase based on tour_date and sales status.
     * @param tour_date
     * @param product
     * @returns {Array}
     */
    static getAvailablePriceGroup(tour_date, product) {
        const availableGroup = [];
        product.sales.forEach(item => {
            if (item.default) {
                if (Product.checkTourDateInValidRange(tour_date, item.tour_begin, item.tour_end, product.timezone)) {
                    availableGroup.push(item);
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
    let areaCategoryalias = product.area + '_' + product.category + '_' + product.alias;
    productMap.set(product.alias, product);
    productMap.set(areaCategoryalias, product);
    if (!!product.incoming) {
        product.incoming.forEach(incoming => { productMap.set(incoming, product) })
    }
    if (!ignoreSet.has(product.id)) { productMap.set(product.id, product) }
    if (!!product.options) {
        product.options.forEach(option => {
            if (!!option.incoming) {
                option.incoming.forEach(incoming => {
                    if (!ignoreSet.has(incoming)) { productMap.set(incoming, product) }
                });
            }
        });
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
    // todo : important task!!!!
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
// const productObject = {};
// sqlDB.query('SELECT id, name, alias, category, area FROM product', (err, result) => {
//     result.rows.forEach(each => {
//         productObject[each.id] = each;
//     });
//     console.log(JSON.stringify(productObject))
// })
// fbDB.ref('geos').child("areas").push({
//     name:"Seoul",
//     pickups:[
//         {
//             name: "Dongdaemoon",
//             incoming: ["동대문", "동대문역","Dongdaemun"],
//             location: {
//                 lat: 37.5713101,
//                 lon: 127.0074567
//             }
//         },
//         {
//             name : "Myeongdong",
//             incoming : ["명동","명동역","명동역 4번출구","Myungdong"],
//             location : {
//                 lat:37.5609892,
//                 lon:126.9839981
//             }
//         }
//     ]
// })

monitorProduct();
module.exports = Product;