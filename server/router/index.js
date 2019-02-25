const express = require('express');
const api = express.Router();
const reservationRouter = require('./v2Reservation');

api.get('/reservation', reservationRouter.get);
api.get('/reservation/edit', reservationRouter.edit);
api.post('/reservation', reservationRouter.post);

module.exports = api;