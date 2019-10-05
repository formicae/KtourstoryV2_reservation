const elastic = require('elasticsearch');
const log = require('../../log');
let client = new elastic.Client({ host:'34.97.62.200:9200'});
client.ping({ requestTimeout: 10000}, (err) => {
    if (err) {
        log.warn('Database', 'Elasticserach', 'elastic server is down');
        console.trace('elasticsearch cluster is down!')
    } else {
        log.debug('Database', 'Elasticserach', `elastic server is running : ${new Date()}`);
        console.log('elasticsearch connected well!')
    }
});

module.exports = client;