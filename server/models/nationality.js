const fbDB = require('../auth/firebase').database;
const log = require('../../log');
let nationalityMap = new Map();

class Nationality {
    constructor(data) {
        this.data = data;
    }

    static getNationality(input) {
        return new Promise((resolve, reject) => {
            if (nationalityMap.size === 0) {
                setTimeout(() => { resolve(Nationality.getNationality(input)) }, 200);
            } else {
                if (!input) {
                    log.info('nationality.js', 'getNationality', `no input!`);
                    resolve({result : false, data : null});
                } else {
                    log.debug('nationality.js', 'getNationality', `nationality found. input : ${input} / result : ${nationalityMap.get(input)}`)
                    resolve ({result : true, data : nationalityMap.get(input)});
                }
            }
        })
    }
}

function monitorNationality() {
    return new Promise((resolve, reject) => {
        fbDB.ref('nationality').on('value', snapshot => {
            const data = snapshot.val();
            Object.entries(data).forEach(async temp => {
                let abbreviation = temp[0];
                let nationData = temp[1];
                for (let data of nationData.possibles) {
                    nationalityMap.set(data, nationData.place);
                }
            });
            resolve(nationalityMap);
        });
    });
}

monitorNationality();
module.exports = Nationality;
