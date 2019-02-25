const ALTER_TABLE = {
    'agencyCode':'agency_id',
    'clientName':'reserved_name',
    'nationality':'nationality',
    'pickupPlace':'pickup_place',
    'product':'product_id',
    'adult':'adult',
    'kid':'child',
    'infant':'infant',
    'memo':'memo',
    'tel':'phone',
    'email':'email',
    'messenger':'messenger',
    'reservedDate':'temp_date',
    'reservedTime':'temp_time',
    'modify_date':'temp',
};
const RESERVATION_KEY_MAP = new Set(['id', 'mail_id', 'product_id', 'agency_id', 'reserved_name', 'nationality', 'operation_date', 'pickup_place', 'name', 'option', 'adult', 'child', 'infant', 'memo', 'phone', 'email', 'messenger', 'canceled', 'reserved_date', 'modify_date', 'cancel_comment']);
const newData = {};
const oldData = require('./v1ReservationData');
let i = 0;
Object.keys(oldData).forEach(id => {
    newData[i] = {};
    let tempdate = '';
    let temptime = '';
    Object.keys(oldData[id]).forEach(property => {
        if (property === 'reservedDate') { tempdate = oldData[id][property]; }
        else if (property === 'reservedTime') { temptime = oldData[id][property]; }
        if (RESERVATION_KEY_MAP.has(ALTER_TABLE[property])) {
            newData[i][ALTER_TABLE[property]] = oldData[id][property];
        }
    });
    newData[i].operation_date = '';
    newData[i].reserved_date = tempdate + 'T' + temptime;
    newData[i].modify_date = tempdate + 'T' + temptime;
    newData[i].canceled = false;
    newData[i].option = {};
    newData[i].cancel_comment = 'not canceled';
    newData[i].id = Math.floor(Math.random()*1000)+1;
    newData[i].mail_id = Math.floor(Math.random()*1000)+1;
    newData[i].product_id = Math.floor(Math.random()*1000)+1;
    i += 1;
});
// console.log(JSON.stringify(newData));

class V2Reservation {
    constructor(data) {
        this.id = data.id;
        this.message_id = data.id;
        this.product_id = data.product;
        this.agency_id = data.agency;
        this.name = data.product.split('_')[2];
        this.nationality = data.nationality;
        this.date = data.date;
        this.pickup = data.pickupPlace;
        this.option = [];
        if (!!data.option) {
            data.option.forEach(option => {
                this.option.push({
                    name : option.option,
                    number : option.people
                })
            });
        }
        this.adult = ''
        this.kid = ''
        this.infant = ''
        this.memo = ''
        this.phone = ''
        this.email = ''
        this.messenger = ''
        this.canceled = ''
        this.reserved_date = ''
        this.modify_date = ''

    }
    static generateElastic(data) {
        const tempObj = {};
        tempObj.id = data.id;
        tempObj.message_id = data.id;
        tempObj.product = {
            id: data.product,
            name: data.product.split('_')[2],
            category: data.product.split('_')[1],
            area: data.area,
            geos: [{place: data.area, lat: "", lng: ""}]
        };
        tempObj.agency = data.agency;
        tempObj.name = data.clientName;
        tempObj.nationality = data.nationality;
        tempObj.date = data.date;
        tempObj.option = [];
        if (!!data.option) {
            data.option.forEach(option => {
                tempObj.option.push({
                    name: option.option,
                    number: option.people
                })
            });
        }
        tempObj.adult = data.adult;
        tempObj.child = data.kid;
        tempObj.infant = data.infant;
        tempObj.memo = data.memo;
        tempObj.phone = data.tel;
        tempObj.email = data.email;
        tempObj.messenger = data.messenger;
        tempObj.canceled = false;
        tempObj.reserved_date = data.reservedDate;
        tempObj.modify_date = data.reservedDate;
        tempObj.timezone = 'UTC+9';
        return tempObj
    }

}
const fs = require('fs');
function convert(data){
    return new Promise((resolve ,reject) => {
        const newReservation = {};
        Object.keys(data).forEach(date => {
            if (date !== "teams") {
                Object.keys(data[date]).forEach(operation_id => {
                    if (!!data[date][operation_id].teams) {
                        Object.keys(data[date][operation_id].teams).forEach(team_id => {
                            if (!!data[date][operation_id].teams[team_id].reservations) {
                                Object.keys(data[date][operation_id].teams[team_id].reservations).forEach(reservation_id => {
                                    if (!!data[date][operation_id].teams[team_id].reservations[reservation_id] && !!data[date][operation_id].teams[team_id].reservations[reservation_id].product) {
                                        newReservation[reservation_id] = V2Reservation.generateElastic(data[date][operation_id].teams[team_id].reservations[reservation_id]);
                                    }
                                })
                            }
                        })
                    }
                });
            }
        });
        // console.log(JSON.stringify(newReservation));
        resolve(JSON.stringify(newReservation));
    });
}
// const v1Operation = require('./intranet-64851-operation-export (6).json');
// convert(v1Operation)
//     .then(result => {
//         console.log('result : ',result)
//         return fs.writeFile('v2Elastic_ReservationData.json', result, function(err) {
//             console.log('비동기적 파일 쓰기 완료');
//         });
//     });



function dataBaseToTestData() {
    const tempJSON = {};
    sqlDB.query(`SELECT * FROM reservation`, (err, result) => {
        const data = result.rows
        for (let i=0; i<data.length; i++){
            tempJSON[data[i].id] = data[i];
        };
        console.log(JSON.stringify(tempJSON));
    });
}