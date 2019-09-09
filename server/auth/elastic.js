const elastic = require('elasticsearch');
let client = new elastic.Client({ host:'34.97.62.200:9200'});
client.ping({ requestTimeout: 10000}, (err) => {
    if (err) {console.trace('elasticsearch cluster is down!')}
    else {console.log('elasticsearch connected well!')}
});

module.exports = client;