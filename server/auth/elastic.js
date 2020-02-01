const elastic = require('elasticsearch');
const log = require('../../log');
let client = new elastic.Client({ host:'35.190.50.17'}); // for local-test (load-balancer)
// for virtualmachine in GCP : host = 10.0.0.108:9200
client.ping({ requestTimeout: 20000}, (err) => {
    if (err) {
        log.error('Elastic', 'Elasticserach', 'elastic server is down');
        console.trace('elasticsearch cluster is down!')
    } else {
        log.debug('elastic.js', 'Elasticserach', `elastic server is running : ${new Date()}`);
        console.log('elasticsearch connected well!')
    }
});

module.exports = client;
