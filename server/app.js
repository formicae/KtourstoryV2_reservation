const Log = require("../log");
const express = require("express");
const bodyParser = require("body-parser");
const v2 = require('./router/index');
const app = express();

app.set("PORT", process.env.PORT || 3000);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use('/v2', v2);

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

