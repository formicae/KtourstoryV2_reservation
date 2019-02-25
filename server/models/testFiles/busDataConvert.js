const fbDB = require('../../databaseAuth/firebase').database;

class V2Bus {
    constructor(operation) {
        this.x = 1;
    }
}
const busSet = new Set();
let bus_min;
let bus_max;
let bus_cost;
function getAllBusDataSet() {
    fbDB.ref('product').once('value', (snapshot) => {
        const products = snapshot.val();
        Object.keys(products).forEach(id => {
            Object.keys(products[id].cost.bus[0].size).forEach(idx => {
                bus_min = products[id].cost.bus[0].size[idx].min;
                bus_max = products[id].cost.bus[0].size[idx].max;
                bus_cost = products[id].cost.bus[0].size[idx].cost;
                console.log([bus_min, bus_max, bus_cost])
                if (!busSet.has([bus_min, bus_max, bus_cost])) {
                    busSet.add([bus_min, bus_max, bus_cost]);
                }
            })
        })
        console.log(JSON.stringify(busSet));
    })
}
getAllBusDataSet()