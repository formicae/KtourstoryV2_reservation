class V2Account {
    constructor(data){
        this.data = data;
    };
    static generateElastic(data){
        const tempObj = {};
        tempObj.id = data.id;
        tempObj.writer = data.writer;
        tempObj.category = data.category;
        tempObj.currency = data.currency;
        if (!!data.cash) {
            if (data.cash < 0) { tempObj.expenditure = data.cash}
            else{ tempObj.income = data.cash }
            tempObj.cash = true;
        } else if (!!data.card) {
            if (data.card < 0) { tempObj.expenditure = data.card}
            else { tempObj.income = data.card }
            tempObj.cash = false;
        }
        tempObj.created = data.date;
        return tempObj;
    }
}

const fs = require('fs');
function convert(data){
    return new Promise((resolve ,reject) => {
        const newAccount = {};
        Object.keys(data).forEach(account_id => {
            newAccount[account_id] = V2Account.generateElastic(data[account_id]);
        });
        // console.log(JSON.stringify(newAccount))
        resolve(JSON.stringify(newAccount));
    });
}
const v1Account = require('./intranet-64851-account-export (6).json');
convert(v1Account)
    .then(result => {
        console.log(result)
        return fs.writeFile('v2Elastic_AccountData.json', result, function(err) {
            console.log('비동기적 파일 쓰기 완료');
        });
    });