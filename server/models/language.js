const fbDB = require('../auth/firebase').database;
const log = require('../../log');
let languageMap = new Map();

class Language {
	constructor(data) {
		this.data = data;
	}

	static getLanguage(input) {
		return new Promise((resolve, reject) => {
			if (languageMap.size === 0) {
				setTimeout(() => { resolve(Language.getLanguage(input)) }, 200);
			} else {
				if (!input) {
					log.info('language.js', 'getLanguage', `no input!`);
					resolve({result : false, data : null});
				} else {
					log.debug('language.js', 'getLanguage', `language found. input : ${input} / result : ${languageMap.get(input)}`)
					if (typeof input === 'string') {
						resolve ({result : true, data : languageMap.get(input.toLowerCase())});
					} else {
						resolve({result:false, data: null})
					}
				}
			}
		})
	}
}

function monitorLanguage() {
	return new Promise((resolve, reject) => {
		fbDB.ref('configuration').on('value', snapshot => {
			const data = snapshot.val().language;
			for (let country of Object.keys(data)) {
				languageMap.set(data[country].key, data[country].value);
				data[country].incomming.map(temp => languageMap.set(temp, data[country].value));
			}
			resolve(languageMap);
		});
	});
}

monitorLanguage()
module.exports = Language;
