const fbDB = require('../auth/firebase').database;
const log = require('../../log');
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
                if (!input) {
                    log.info('pickup.js', 'getPickup', 'no input!');
                    resolve(false);
                } else {
                    Pickup.pickupStringMatch(input).then(result => {
                        if (!result) {
                            log.info('pickup.js', 'getPickup', `no matching pickup information. input : ${input}`)
                            resolve(false);
                        } else {
                            // log.debug('pickup.js', 'getPickup', `pickup found. input : ${input} / result : ${result}`)
                            resolve(pickupMap.get(result));
                        }
                    });
                }
            }
        })
    }
}

function monitorPickup() {
    return new Promise((resolve, reject) => {
        fbDB.ref('geos').on('value', async snapshot => {
            const geos = await snapshot.val();
            for (let temp of Object.entries(geos.areas)) {
                let areaName = temp[0];
                let areaData = temp[1];
                if (areaData.hasOwnProperty('pickups')) {
                    for (let data of areaData.pickups) {
                        if (data.hasOwnProperty('name')) {
                            pickupMap.set(data.name, {
                                pickupPlace : data.name,
                                incoming : data.incoming,
                                location : data.location,
                                areaName : areaName
                            });
                            incomingMap.set(data.name, data.name);
                            data.incoming.forEach(incoming => {
                                incomingMap.set(incoming, data.name);
                            });
                        }
                    }
                }
            }
            resolve(pickupMap);
        });
    });
}

monitorPickup();
module.exports = Pickup;
