const Log = require("../log");
const express = require("express");
const bodyParser = require("body-parser");
const v2 = require('./router/index');
const app = express();
const path = require('path');
const env = require('../package.json').env;
const Auth = require('./auth/keys/reservationServerAuth');

app.set("PORT", process.env.PORT || 4500);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use('/', (req, res, next) => {
    let header = req.headers;
    let auth = new Auth(header.requester, header.authkey).getAuth;
    if (auth.result) {
        req.body.reservationRouterAuth = auth.reservation;
        req.body.accountRouterAuth = auth.account;
        next();
    } else {
        res.status(401).json({msg:'no authorized request!'});
    }
});
app.use('/v2', v2);
app.get('/healthcheck', (req, res, next) => {
    res.status(200).send('health check success!');
});
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/routes'));

app.use((req, res, next) => {
    //404
    res.status(404).json({msg: "No Result"});
});
app.use((err, req, res, next) => {
    //500
    console.log('Application error : ',err);
    res.status(500).json({msg: "Error Occurs"})
});

module.exports = app;

