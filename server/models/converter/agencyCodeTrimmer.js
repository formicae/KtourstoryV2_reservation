const elasticDB = require('../../auth/elastic');
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

async function trimmer(year ,startMonth, endMonth) {
	let tempMonth;
	let tempDay;
	let totalCount = 0;
	let successCount = 0;
	for (let month=1; month <= 12; month ++) {
		if (startMonth <= month && month <= endMonth) {
			for (let day of dayObj[month]) {
				if (month < 10) tempMonth = '0' + month;
				else tempMonth = String(month);
				if (day < 10) tempDay = '0' + day;
				else tempDay = String(day);
				let date = year + '-' + tempMonth + '-' + tempDay;
				console.log([date]);
				await searchElasticByDate(date)
					.then(result => {
						// console.log(' result : ',result.length,result);
						for (let reservation of result) {
							// console.log('reservation : ',reservation)
							if (reservation.hasOwnProperty('agency_code')) {
								let trimmedAgencyCode = reservation.agency_code.trim();
								if (reservation.agency_code !== trimmedAgencyCode) {
									totalCount += 1;
									console.log(`${date} - ${reservation.id} - [${reservation.agency_code}] --> [${trimmedAgencyCode}] will be changed :`);
									updateElastic(reservation.id, trimmedAgencyCode).then(result => {
										if (result) successCount += 1;
									});
								}
							}
						}
					})
			}
		}
	}
	return {total:totalCount, success:successCount};
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
				size:300
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

// searchElasticByDate('2019-08-06').then(result => console.log('result : ',result))

function updateElastic(reservation_id, trimmedAgencyCode) {
	return new Promise((resolve, reject) => {
		elasticDB.update({
			index : 'reservation',
			type : '_doc',
			id : reservation_id,
			body : {
				doc : {
					agency_code: trimmedAgencyCode
				}
			}
		}, (err, resp) => {
			if (err) resolve(false);
			if (!!resp) {
				console.log(`  >> update agencyCode in Elastic - ${reservation_id} result : success`);
				resolve(true);
			} else {
				console.log(`${reservation_id} update failed!`);
				resolve(false);
			}
		});
	})
}

trimmer(2020,1,12).then((result) => {
	console.log(`all process done. total : ${result.total} / success : ${result.success}`)
});
