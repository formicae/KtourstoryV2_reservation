const express = require('express');
const api = express.Router();
const reservationRouter = require('./v2Reservation');
const accountRouter = require('./v2Account');

api.post('/reservation', reservationRouter.post);
api.update('/reservation', reservationRouter.update);
api.post('/account', accountRouter.post);
api.update('/account', accountRouter.update);

module.exports = api;