const sqlDB = require('../../auth/postgresql');
const v1ProductData = require('../testFiles/v1ProductData');

class V2Product {
    constructor(v1ProductData, v2SQLData) {
        this.v1ProductData = v1ProductData;
        this.v2SQLData = v2SQLData;
        this.fbData = V2Product.generateFBObject(v1ProductData, v2SQLData);
        this.elasticData = V2Product.generateElasticObject(v1ProductData, v2SQLData);
    }
    static generateFBObject(v1ProductData, v2SQLData) {
        const result = {
            id : v1ProductData.id,
            name : v2SQLData.name,
            alias : v2SQLData.alias,
            category : v2SQLData.category || v1ProductData.info.category,
            area : v2SQLData.area || v1ProductData.info.area,
            timezone : 'UTC+9',
            incoming : v1ProductData.possibles,
            geos : {place : v2SQLData.area || v1ProductData.info.area, location : {lat:'',lng:''}},
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
                agency : v1ProductData.price.default.byAgencies[0].agency,
                currency : v1ProductData.price.default.byAgencies[0].currency,
                reserve_begin : v1ProductData.price.default.reservationDate_from,
                reserve_end : v1ProductData.price.default.reservationDate_to,
                tour_begin : v1ProductData.price.default.tourDate_from,
                tour_end : v1ProductData.price.default.tourDate_to,
                sales : [{type : 'adult', gross : v1ProductData.price.default.byAgencies[0].adult_gross, net : v1ProductData.price.default.byAgencies[0].adult_net},
                    {type : 'kid', gross : v1ProductData.price.default.byAgencies[0].kid_gross, net : v1ProductData.price.default.byAgencies[0].kid_net},
                    {type : 'infant', gross : v1ProductData.price.default.byAgencies[0].young_cost, net : v1ProductData.price.default.byAgencies[0].infant_net},
                    {type : '-', cost : 0}]
            }]
        };
        if (v1ProductData.info.pickup) {
            v1ProductData.info.pickup.forEach(each => {result.pickups.push({place:each, lat:"", lng:""})});
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
        return result;
    }
    static generateElasticObject(v1ProductData, v2SQLData) {
        const result = {
            id : v1ProductData.id,
            name : v2SQLData.name,
            alias : v2SQLData.alias,
            category : v2SQLData.category || v1ProductData.info.category,
            area : v2SQLData.area || v1ProductData.info.area,
            geos : {place : v2SQLData.area || v1ProductData.info.area, location : {lat:'',lng:''}},
            description : v1ProductData.info.description,
            memo : v1ProductData.info.memo,
            on : v1ProductData.info.status,
            reserve_begin : v1ProductData.price.default.reservationDate_from,
            reserve_end : v1ProductData.price.default.reservationDate_to,
            tour_begin : v1ProductData.info.period[0].from,
            tour_end : v1ProductData.info.period[0].to,
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
        return result;
    }
}

function importSQLData(id){
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM product where id = '${id}'`;
        sqlDB.query(query, (err, result) => {
           if (err) throw new Error('product import from SQL failed!');
           resolve(result.rows[0]);
        });
    })
}

function test(sqlID, fbID) {
    // p357 : 레남쁘
    let v2SQLData = {};
    return importSQLData(sqlID).then(result => {
        if (result.__proto__ === [].__proto__) result.map(p => v2SQLData[p.alias]=p);
        else v2SQLData = result;
        const v2Product = new V2Product(v1ProductData[fbID], v2SQLData);
        console.log('elastic data : ',v2Product.elasticData);
        console.log('fb data : ',v2Product.fbData);
    });
}
test('p357', '-Kxq-TuaU1DVVULpL2LU');

module.exports = V2Product;