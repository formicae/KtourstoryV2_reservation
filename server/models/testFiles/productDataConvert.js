const fbDB = require('../../databaseAuth/firebase').database;
const testFile = require('./v1ProductData.json');
const LANGUAGE_MAP = { // 1 : THAI, 3 : VIETNAMESE, 5: TAGALOG, ... (Ktourstory 웹에서 확인)
    '0':'KOREAN',
    '2':'ENGLISH',
    '4':'CHINESE'
};
class V2Product {
    constructor(data) {
        this.id = data.id;
        this.name = data.info.name;
        this.alias = data.info.name;
        this.category = data.info.category;
        this.area = data.info.area;
        this.incoming = data.possibles;
        this.geos = [];
        this.pickups = [];
        if (data.info.pickup) {
            data.info.pickup.forEach(each => {this.pickups.push({place:each, lat:"", lng:""})});
        }
        this.timezone = 'UTC+9';
        this.description = data.info.description;
        this.memo = data.info.memo;
        if (data.info.cancellation) this.memo += ' / [cancellation] : ' + data.info.cancellation;
        this.expenses = [];
        if (data.cost.item) {
            data.cost.item.forEach(item => {
                let tempData = {
                    name : item.item,
                    expenses : [
                        {type : 'adult', cost : item.adult_cost},
                        {type : 'kid', cost : item.kid_cost},
                        {type : 'young', cost : item.young_cost},
                        {type : '-', cost : 0},
                    ]
                };
                this.expenses.push(tempData);
            });
        }
        this.on = data.info.status;
        this.deadline = data.info.deadline;
        this.days = data.info.available.filter((val, idx) => idx < 7);
        this.reserve_begin = data.info.period[0].from;
        this.reserve_end = data.info.period[0].to;
        this.tour_begin = data.info.period[0].from;
        this.tour_end = data.info.period[0].to;
        this.ignore_options = [];
        this.options = [];
        if (data.option) {
            Object.keys(data.option).forEach(op => {
                if (data.option[op].option === 'Ignore') {
                    data.option[op].possibles.forEach(each => {
                        if (each) this.ignore_options.push(each);
                    });
                } else {
                    let tempData = {
                        price : data.option[op].price,
                        name : data.option[op].option,
                        incoming : []
                    };
                    data.option[op].possibles.forEach(each => {
                        if (each) tempData.incoming.push(each);
                    });
                    this.options.push(tempData);
                }
            });
        }
        this.sales = [{
            default : true,
            name : data.price.default.title,
            agency : data.price.default.byAgencies[0].agency,
            currency : data.price.default.byAgencies[0].currency,
            reserve_begin : data.price.default.reservationDate_from,
            reserve_end : data.price.default.reservationDate_to,
            tour_begin : data.price.default.tourDate_from,
            tour_end : data.price.default.tourDate_to,
            sales : [{type : 'adult', gross : data.price.default.byAgencies[0].adult_gross, net : data.price.default.byAgencies[0].adult_net},
                {type : 'kid', gross : data.price.default.byAgencies[0].kid_gross, net : data.price.default.byAgencies[0].kid_net},
                {type : 'infant', gross : data.price.default.byAgencies[0].young_cost, net : data.price.default.byAgencies[0].infant_net},
                {type : '-', cost : 0}]
        }]
    }
}

function getFbData() {
    fbDB.ref('product').once('value', (snapshot) => {
        const products = snapshot.val();
        console.log(JSON.stringify(products));
    })
}
// getFbData()
function convert(testFile) {
    const newProduct = {};
    Object.keys(testFile).forEach(id => {
        newProduct[testFile[id].id] = new V2Product(testFile[id]);
    });
    console.log(JSON.stringify(newProduct));
}
// convert(testFile);

function buildPromise(product){
    return new Promise((resolve, reject) => {
        fbDB.ref('_product').push(product).then(result => {
            resolve();
        })
    })
}
function insertToFB(data){
    const arr = [];
    Object.keys(data).forEach(key => {
        arr.push(buildPromise(data[key]));
    });
    Promise.all(arr).then(result => {
        console.log(result);
    });
}
const v2Product = require('./v2ProductData.json');
const Product = require('../product');
const elasticProduct = {};
Object.keys(v2Product).forEach(id => {
    elasticProduct[id] = Product.generateElasticObject(v2Product[id]);
});
console.log(JSON.stringify(elasticProduct));
// const dataForInsert = require('./v2ProductData');
// insertToFB(dataForInsert);


