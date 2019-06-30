fbDB = require('../auth/firebase').database;
let busMap = {
    byId : new Map(),
    byNumPeople : new Map(),
    simpleData : {}
};

class Bus {
    constructor(data) {
        if (!!data.bus_id) this.bus_id = data.bus_id;
        this.vehicle_number = (!data.vehicle_number) ? 'No vehicle number' : data.vehicle_number;
        this.fee = data.fee;
        this.currency = data.currency;
        this.rental_company = data.rental_company;
        this.bus_garage = data.bus_garage;
        this.max_people_number = data.max_people_number;
        this.min_people_number = data.min_people_number;
        this.is_private = data.is_private;
        this.memo = data.memo;
    }

    static getBusById(bus_id) {
        return new Promise((resolve, reject) => {
            if (busMap.byId.size === 0) {
                setTimeout(() => { resolve(Bus.getBusById(bus_id)) }, 200);
            } else {
                resolve(busMap.byId.get(bus_id));
            }
        })
    }
    static getBusByNumPeople(numPeople) {
        return new Promise((resolve, reject) => {
            if (busMap.byNumPeople.size === 0) {
                setTimeout(() => { resolve(Bus.getBusByNumPeople(numPeople)) }, 200);
            } else {
                resolve(busMap.get(numPeople));
            }
        })
    }
    static getSimpleData() {
        return new Promise((resolve, reject) => {
            if (Object.keys(busMap.simpleData).length === 0) {
                setTimeout(() => { resolve(Bus.getSimpleData()) }, 200);
            } else {
                resolve(busMap.simpleData);
            }
        })
    }
}

function updateBusMap() {
    fbDB.ref('bus').on('value', (snapshot) => {
        let buses = snapshot.val();
        let tempMap = {
            byId : new Map(),
            byNumPeople : new Map(),
            simpleData : {}
        };
        let tempBus;
        for (let numPeople in buses) {
            tempBus = buses[numPeople];
            tempMap.byNumPeople.set(numPeople, buses[numPeople]);
            for (let id in buses[numPeople]) {
                tempMap.byId.set(id, buses[numPeople][id]);
                tempMap.simpleData[id] = {};
                tempMap.simpleData[id].max_people_number = buses[numPeople][id].max_people_number;
                tempMap.simpleData[id].min_people_number = buses[numPeople][id].min_people_number;
                tempMap.simpleData[id].fee = buses[numPeople][id].fee;
            }
        }
        busMap = tempMap;
    });
}
updateBusMap();
module.exports = Bus;

// const data = {
//     id:'',
//     max_people_number : 25,
//     min_people_number : 20,
//     fee : 330000,
//     currency : 'Won',
//     bus_garage : 'Dongdaemun',
//     rental_company : 'Unknown'
// }

// const idMAp = { '16':
//         ['-LUPTrSoxP8utTfDU_DP','-LUPU7rTmMCOPoxOI7oh' ],
//     '25':
//         ['-LUPUQ8LCejMEH7TiTGW','-LUPUVMZAeLEnpXy_3TE' ],
//     '44':
//         ['-LUPUF6lCg9nqpmxNBQM','-LUPUHM1xT9IxPcfePVL' ] }
// fbDB.ref('bus').on('value', (snapshot) => {
//     buses = snapshot.val();
//     for (let numPeople in buses) {
//         idMAp[numPeople] = {}
//         for (let id in buses[numPeople]) {
//             console.log(numPeople, id)
//             idMAp[numPeople][id] = id;
//         }
//     }
//     console.log(idMAp)
// });
// const curId = '44';
// fbDB.ref('bus').kid(curId).kid(idMAp[curId][1]).kid('id').set(idMAp[curId][1]);