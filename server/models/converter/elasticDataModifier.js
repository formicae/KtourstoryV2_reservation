const elasticDB = require('../../auth/elastic');
const TRIM = 100;
const REPLACE = 200;
const dayObj = {
	1: arrayMaker(31),
	2: arrayMaker(28),
	3: arrayMaker(31),
	4: arrayMaker(30),
	5: arrayMaker(31),
	6: arrayMaker(30),
	7: arrayMaker(31),
	8: arrayMaker(31),
	9: arrayMaker(30),
	10: arrayMaker(31),
	11: arrayMaker(30),
	12: arrayMaker(31)
};

function arrayMaker(endDate) {
	const arr = [];
	for (let i=1; i<=endDate; i++) {arr.push(i)}
	return arr
}

function dateProcessor(year, month, day) {
	let tempMonth;
	let tempDay;
	if (month < 10) tempMonth = '0' + month;
	else tempMonth = String(month);
	if (day < 10) tempDay = '0' + day;
	else tempDay = String(day);
	return year + '-' + tempMonth + '-' + tempDay;
}

function trimmer(counter, reservation, property) {
	if (reservation.hasOwnProperty(property)) {
		let trimmedData = reservation[property].trim();
		if (reservation[property] !== trimmedData) {
			counter.total += 1;
			console.log(` * [trim] ${date} - ${reservation.id} - [${reservation[property]}] --> [${trimmedData}] will be changed :`);
			updateElastic(reservation.id, property, trimmedData).then(result => {
				if (result) counter.success += 1;
			});
		}
	}
}

function replacer(counter, reservation, property, data) {
	if (reservation.hasOwnProperty(property)) {
		counter.total += 1;
		console.log(` * [replace] ${date} - ${reservation.id} - [${reservation[property]}] --> [${data}] will be changed :`);
		updateElastic(reservation.id, property, data),then(result => {
			if (result) counter.success += 1;
		})
	}
}


/**
 * main function
 * @param year {Number} : year
 * @param startMonth {Number} : start month
 * @param endMonth {Number} : end month
 * @param type {Number}: for trimmer, request code 100. for replacer, request code 200.
 * @param property {String} : target property
 * @param data {String} : target data
 * @returns {Promise<{total: *, success: *}>}
 */
async function mainModifier(year, startMonth, endMonth, type, property, data) {
	const counter = {total : 0,  success : 0};
	for (let month=1; month <= 12; month ++) {
		if (startMonth <= month && month <= endMonth) {
			for (let day of dayObj[month]) {
				let date = dateProcessor(year, month, day);
				console.log([date]);
				await searchElasticByDate(date)
					.then(result => {
						for (let reservation of result) {
							if (type === TRIM) {
								trimmer(counter, reservation, property)
							} else if(type === REPLACE) {
								replacer(counter, reservation, property, data)
							}
						}
					})
			}
		}
	}
	console.log('');
	console.log(' ## All process done!');
	console.log(` ## Main Result : [${counter.success}] data out of [${counter.total}] data had been modified! Success percentage : [${counter.success / counter.total * 100} %]`);
	return counter
}


function searchElasticByDate(date) {
	return new Promise((resolve, reject) => {
		elasticDB.search({
			index:'reservation',
			type:'_doc',
			body: {
				query: {
					bool:{
						filter: [{
								range:{
									"tour_date":{
										"gte":date, "lte":date
									}
								}
							}]
					}
				},
				size:500
			}
		}, (err, resp) => {
			if (err || resp.timed_out) {
				console.log(`error occurred in ${date}, ${JSON.stringify(err)}`)
			} else {
				// console.log(resp)
				// console.log(JSON.stringify(resp.hits.hits));
				for (let temp of resp.hits.hits) {
					let reservation = temp._source;
					// console.log(reservation.id)
				}
				console.log(`${resp.hits.hits.length} reservation found in ${date}!`)
				resolve(resp.hits.hits.map(data => data._source))
			}
		});
	})
}

function updateElastic(reservation_id, property, data) {
	return new Promise((resolve, reject) => {
		const target = {};
		target[property] = data;
		elasticDB.update({
			index : 'reservation',
			type : '_doc',
			id : reservation_id,
			body : {
				doc : {
					target
				}
			}
		}, (err, resp) => {
			if (err) resolve(false);
			if (!!resp) {
				console.log(`  >> update ${property} in Elastic - ${reservation_id} result : success`);
				resolve(true);
			} else {
				console.log(`${reservation_id} update failed!`);
				resolve(false);
			}
		});
	})
}

// mainModifier(2020,1,12, 100, 'agency_code', null)
