const fbDB = require('../../databaseAuth/firebase').database;
const LANGUAGE_SET = new Set(['KOREAN', 'ENGLISH', 'CHINESE', 'CANTONESE', 'JAPANESE', 'INDONESIAN','THAI','VIETNAMESE','TAGALOG','FRENCH','SPANISH','GERMAN']);
class V2Guide {
    constructor(data) {
        this.guide_name = data.name;
        this.image_source = data.imgUrl;
        this.is_driver = data.driver;
        this.v_number = data.vNo;
        this.language = {
            KOREAN : false,
            ENGLISH : false,
            CHINESE : false,
            CANTONESE : false,
            JAPANESE : false,
            INDONESIAN : false,
            THAI : false,
            VIETNAMESE : false,
            TAGALOG : false,
            FRENCH : false,
            SPANISH : false,
            GERMAN : false
        };
        if (data.language) {
            Object.keys(data.language).forEach(idx => {
                if (LANGUAGE_SET.has(data.language[idx])) this.language[data.language[idx]] = true;
            });
        }
        this.memo = data.memo;
        this.status = {
            on_working : 'Has to be filled', // new
            started_date : data.start,
            ended_date : data.end,
            prefer_day : {
                MON : false,
                TUE : false,
                WED : false,
                THU : false,
                FRI : false,
                SAT : false,
                SUN : false
            }
        };
        if (data.preferDay) {
            data.preferDay.forEach(val => {
                this.status.prefer_day[val.toUpperCase()] = true;
            });
        }
        this.contact = {
            address : data.address,
            email : data.email,
            phone : data.phone
        };
        this.money = {
            account : data.account,
            currency : 'KRW',
            cash : data.cash,
            assets : {},
            payment : {
                card_number : data.card,
                wage : 'Has to be filled',
                bonus : data.bonus || 0,
            }
        };
        if (data.asset) {
            Object.keys(data.asset).forEach(asset => {
                this.money.assets[asset] = {
                    purpose : data.asset[asset].asset,
                    deposit : data.asset[asset].left || 0,
                    spent : data.asset[asset].got || 0,
                }
            });
        }
        this.schedule = {};
        if (data.schedule) {
            Object.keys(data.schedule).forEach(op_date => {
                this.schedule[op_date] = {
                    product_id : data.schedule[op_date].product,
                    team_id : data.schedule[op_date].team,
                    final_cash : data.schedule[op_date].cash || 0,
                    final_payment : data.schedule[op_date].wage || 0
                };
            });
        }
    }
}
function getFbData() {
    fbDB.ref('guide').once('value', (snapshot) => {
        const products = snapshot.val();
        console.log(JSON.stringify(products));
    })
}
// getFbData()
const testFile = require('./v1GuideData.json');
function convert(testFile) {
    const newProduct = {};
    Object.keys(testFile).forEach(id => {
        let guide_id = (!testFile[id].start) ? testFile[id].name + ' [No start_date info]' : testFile[id].name + ' [' + testFile[id].start + ']';
        newProduct[guide_id] = new V2Guide(testFile[id]);
    });
    console.log(JSON.stringify(newProduct));
}
convert(testFile);
function buildPromise(guide){
    return new Promise((resolve, reject) => {
        fbDB.ref('_guide').child(guide.guide_name).push(guide).then(result => {
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
const dataForInsert = require('./v2GuideData');
// insertToFB(dataForInsert);

