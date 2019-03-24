const productNameAlias = require('./dataFiles/productNameAlias.json');
const v1Product = require('./testFiles/v1ProductData.json');
// const result = productNameAlias;
// Object.keys(v1Product).forEach(key => {
//     let name = v1Product[key].info.name;
//     if (!!productNameAlias[name]) {
//         result[name] = {
//             name : productNameAlias[name].name,
//             alias : productNameAlias[name].alias,
//             category : v1Product[key].info.category,
//             area : v1Product[key].info.area
//         }
//     }
// });
// console.log(JSON.stringify(result));
// console.log(Object.keys(v1Product).length)
// console.log(Object.keys(result).length);
console.log(Object.keys(productNameAlias).length);
const promiseArr = [];
const missingItem = new Set(['내장산','단양','부산에버','경주단풍','에버지산']);
function buildPromise(data) {
    return new Promise((resolve, reject) => {
        let query;
        if (!data.category) query = `INSERT INTO product (name, alias) VALUES ('${data.name}', '${data.alias}')`;
        else query = `INSERT INTO product (name, alias, category, area) VALUES ('${data.name}', '${data.alias}','${data.category}','${data.area}')`
        sqlDB.query(query, (err, result) => {
            if (err) throw new Error('error!');
            console.log(result);
            resolve(result.rows[0]);
        });
    });
}
function insertProductTOSQL(){
    Object.keys(productNameAlias).forEach(key => {
        promiseArr.push(buildPromise(productNameAlias[key]));
    })
    Promise.all(promiseArr).then(result => {
        console.log(result);
    })
}

function insertProductToElastic(){

}

// let dataWithoutCategory = {"서울에버":{"_id":"96","id":"p96","name":"서울 출발 에버랜드","alias":"서울에버","category":null,"area":null},"서울벚꽃랜덤":{"_id":"101","id":"p101","name":"서울 출발 랜덤 벚꽃 투어","alias":"서울벚꽃랜덤","category":null,"area":null},"짚라인에버":{"_id":"130","id":"p130","name":"영진 짚라인+에버랜드","alias":"짚라인에버","category":null,"area":null},"민속촌우주":{"_id":"138","id":"p138","name":"민속촌+광명동굴+레일바이크","alias":"민속촌우주","category":null,"area":null},"제주서부":{"_id":"146","id":"p146","name":"제주 서부 해안","alias":"제주서부","category":null,"area":null},"서울포항불꽃":{"_id":"153","id":"p153","name":"서울 출발 포항 불꽃 축제","alias":"서울포항불꽃","category":null,"area":null},"부산보성녹차":{"_id":"173","id":"p173","name":"부산 출발 보성 녹차 축제","alias":"부산보성녹차","category":null,"area":null},"서울진해":{"_id":"99","id":"p99","name":"서울 출발 진해 벚꽃","alias":"서울진해","category":null,"area":null},"남이엘리":{"_id":"107","id":"p107","name":"남이섬+강촌 엘리시안 리조트","alias":"남이엘리","category":null,"area":null},"일루미아":{"_id":"137","id":"p137","name":"스케이트+일루미아 빛 축제","alias":"일루미아","category":null,"area":null},"제주벚꽃":{"_id":"144","id":"p144","name":"제주 벚꽃+유채꽃","alias":"제주벚꽃","category":null,"area":null},"대천스카이바이크":{"_id":"157","id":"p157","name":"대천 스카이바이크+포도","alias":"대천스카이바이크","category":null,"area":null},"부산프라이빗":{"_id":"124","id":"p124","name":"부산 개인 투어","alias":"부산프라이빗","category":null,"area":null},"남해":{"_id":"132","id":"p132","name":"부산 출발 남해","alias":"남해","category":null,"area":null},"해인사일루미아":{"_id":"140","id":"p140","name":"해인사+합천 영화 공원+일루미아 빛 축제","alias":"해인사일루미아","category":null,"area":null},"동부산에덴루지":{"_id":"148","id":"p148","name":"에덴 벨리 루지+아홉산 숲+죽성 드림성당+해동용궁사","alias":"동부산에덴루지","category":null,"area":null},"봉화은어":{"_id":"156","id":"p156","name":"봉화 은어 축제","alias":"봉화은어","category":null,"area":null},"부산진도":{"_id":"127","id":"p127","name":"부산 출발 진도 바닷길","alias":"부산진도","category":null,"area":null},"남이섬짚라인":{"_id":"135","id":"p135","name":"남이섬+가평 짚라인","alias":"남이섬짚라인","category":null,"area":null},"야간진해":{"_id":"142","id":"p142","name":"부산 출발 야간 진해 벚꽃","alias":"야간진해","category":null,"area":null},"부산광양구례":{"_id":"126","id":"p126","name":"부산 출발 광양 매화 축제+구례 산수유 축제","alias":"부산광양구례","category":null,"area":null},"덕유산탑사":{"_id":"134","id":"p134","name":"덕유산+마이산","alias":"덕유산탑사","category":null,"area":null},"에덴루지":{"_id":"141","id":"p141","name":"에덴 벨리 루지+밀양 케이블카+통도사+시례 호박소","alias":"에덴루지","category":null,"area":null},"서울프라이빗":{"_id":"150","id":"p150","name":"서울 개인 투어","alias":"서울프라이빗","category":null,"area":null},"서울진도":{"_id":"104","id":"p104","name":"서울 출발 진도 바닷길","alias":"서울진도","category":null,"area":null},"대구이월드":{"_id":"136","id":"p136","name":"대구 이월드","alias":"대구이월드","category":null,"area":null},"대구벚꽃야":{"_id":"145","id":"p145","name":"대구 이월드+벚꽃 야간","alias":"대구벚꽃야","category":null,"area":null},"머드공연일":{"_id":"152","id":"p152","name":"보령 머드 축제 공연일","alias":"머드공연일","category":null,"area":null},"서울단풍랜덤":{"_id":"169","id":"p169","name":"서울 출발 랜덤 단풍 투어","alias":"서울단풍랜덤","category":null,"area":null},"서울보성녹차":{"_id":"105","id":"p105","name":"서울 출발 보성 녹차 축제","alias":"서울보성녹차","category":null,"area":null},"서울광양구례":{"_id":"125","id":"p125","name":"서울 출발 광양 매화 축제+구례 산수유 축제","alias":"서울광양구례","category":null,"area":null},"민속촌":{"_id":"133","id":"p133","name":"민속촌","alias":"민속촌","category":null,"area":null},"대구벚꽃주":{"_id":"143","id":"p143","name":"대구 이월드+벚꽃 주간","alias":"대구벚꽃주","category":null,"area":null},"설악단풍":{"_id":"163","id":"p163","name":"설악산 단풍","alias":"설악단풍","category":null,"area":null},"부산단풍랜덤":{"_id":"170","id":"p170","name":"부산 출발 랜덤 단풍 투어","alias":"부산단풍랜덤","category":null,"area":null},"민속촌레일":{"_id":"131","id":"p131","name":"민속촌+레일바이크","alias":"민속촌레일","category":null,"area":null},"여수":{"_id":"139","id":"p139","name":"부산 출발 여수","alias":"여수","category":null,"area":null},"제주동부":{"_id":"147","id":"p147","name":"제주 동부 해안","alias":"제주동부","category":null,"area":null},"부산포항불꽃":{"_id":"155","id":"p155","name":"부산 출발 포항 불꽃 축제","alias":"부산포항불꽃","category":null,"area":null}};
// let aliasArr;
// const tempArr = [];
// sqlDB.query('select alias from product', (err, result) => {
//     aliasArr = result.rows;
//     aliasArr.forEach(each => {
//         tempArr.push(each.alias);
//     });
//     console.log(tempArr)
// })


let avlCount = 0;
// Object.keys(productNameAlias).forEach(key => {
//     if (allAlias.has(productNameAlias[key].alias)) avlCount += 1;
//     else console.log(productNameAlias[key].alias);
// })
// console.log('avlCount : ',avlCount);




// let count = 0;
// let notCount = 0;
// Object.keys(productNameAlias).forEach(key => {
//     if (!dataWithoutCategory[productNameAlias[key].alias]) {
//         notCount += 1
//         console.log('not saved : ',productNameAlias[key].alias);
//     }
// })
// console.log('not count : ',notCount)
// Object.keys(productNameAlias).forEach(key => {
//     if (!productNameAlias[key].category) {
//         count += 1
//         // console.log(productNameAlias[key]);
//     }
// })
// console.log('count : ',count);
// sqlDB.query(`INSERT INTO product (name, alias, category, area) VALUES ('지리산 단풍', '지리산', 'Autumn', 'Busan')`, (err, result) => {
//     console.log(err, result);
// })