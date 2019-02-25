const elastic = require('elasticsearch');
let client = new elastic.Client({ host:'35.243.80.37:9200' });
client.ping({ requestTimeout: 3000}, (err) => {
    if (err) {console.trace('elasticsearch cluster is down!')}
    else {console.log('elasticsearch connected well!')}
});

module.exports = client;