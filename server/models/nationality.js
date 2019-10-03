const fbDB = require('../auth/firebase').database;
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
                if (!input) resolve({result : false, data : null});
                else {
                    resolve ({result : true, data : nationalityMap.get(input)});
                }
            }
        })
    }
}

function monitorNationality() {
    return new Promise((resolve, reject) => {
        fbDB.ref('geos').on('value', snapshot => {
            const geos = snapshot.val();
            Object.entries(geos.nationality).forEach(async temp => {
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