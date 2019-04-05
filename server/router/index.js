const express = require('express');
const api = express.Router();
const reservationRouter = require('./v2Reservation');
const accountRouter = require('./v2Account');
const env = require('../../package.json').env;

api.post('/reservation', reservationRouter.post);
api.put('/reservation', reservationRouter.update);
api.post('/account', accountRouter.post);
api.put('/account', accountRouter.update);
if (!env.released) {
    api.get('/', (req, res) => {res.render('../views/tempTemplate',{data:'local/v2'})});
    api.get('/reservation', (req, res) => {res.render('../views/tempTemplate',{data:'local/v2/reservation'})});
}

module.exports = api;