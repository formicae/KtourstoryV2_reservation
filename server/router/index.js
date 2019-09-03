const express = require('express');
const api = express.Router();
const reservationRouter = require('./v2Reservation');
const accountRouter = require('./v2Account');
const env = require('../../package.json').env;
const log = require('../../log');

api.post('/reservation', reservationRouter.post);
api.put('/reservation', reservationRouter.update);
api.post('/account', accountRouter.post);
api.delete('/account', accountRouter.delete);
if (!env.released) {
    api.get('/', (req, res) => {res.render('../views/tempTemplate',{data:'local/v2'})});
    api.get('/reservation', (req, res) => {res.render('../views/tempTemplate',{data:'local/v2/reservation'})});
} else {
    api.get('/', (req, res) => {res.render('../views/tempTemplate',{data:'server/v2'})});
    api.get('/reservation', (req, res) => {res.render('../views/tempTemplate',{data:'server/v2/reservation'})});
}

process.on("uncaughtException", function (err) {
    "use strict";
    log.error('uncaughtException', `Reservation server died - ${new Date()}`, `unhandled error occurred! error : ${Object.getOwnPropertyNames(err)}`);
});

module.exports = api;