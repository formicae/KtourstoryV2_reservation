const fbDB = require('../auth/firebase').database;
let incomingMap = new Map();
let pickupMap = new Map();

class Pickup {
    constructor(data) {
        this.data = data;
    }

    static pickupStringMatch(input) {
        return new Promise((resolve ,reject) => {
            incomingMap.forEach((value, key) => {
                if (input.match(key)) {
                    resolve(value);
                }
            });
            resolve(false);
        })
    }

    static getPickup(input) {
        return new Promise((resolve, reject) => {
            if (pickupMap.size === 0 || incomingMap.size === 0) {
                setTimeout(() => { resolve(Pickup.getPickup(input)) }, 200);
            } else {
                if (!input) resolve({location : {lat:0, lon:0}});
                else {
                    Pickup.pickupStringMatch(input).then(result => {
                        if (!result) resolve(false);
                        else resolve(pickupMap.get(result));
                    });
                }
            }
        })
    }
}

function monitorPickup() {
    return new Promise((resolve, reject) => {
        fbDB.ref('geos').on('value', snapshot => {
            const geos = snapshot.val();
            Object.entries(geos.areas).forEach(async temp => {
                let areaName = temp[0];
                let areaData = temp[1];
                await areaData.pickups.forEach(async data => {
                    await pickupMap.set(data.name, {
                        pickupPlace : data.name,
                        incoming : data.incoming,
                        location : data.location,
                        areaName : areaName
                    });
                    await data.incoming.forEach(incoming => {
                        incomingMap.set(incoming, data.name);
                    });
                });
            });
            resolve(pickupMap);
        });
    });
}

monitorPickup();
module.exports = Pickup;