const elastic = require('elasticsearch');
const log = require('../../log');
const nodeEnv = process.env.NODE_ENV;
let client;
if (nodeEnv === 'PRODUCTION') {
    client = new elastic.Client({ host:'10.0.0.108:9200'}); // for local-test (load-balancer)
} else {
    client = new elastic.Client({ host:'35.190.50.17'}); // for local-test (load-balancer)
}
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
