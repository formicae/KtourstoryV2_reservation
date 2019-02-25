const fs = require("fs");
const path = require("path");
const readline = require("readline");
const {google} = require("googleapis");

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
const CREDENTIAL_PATH = path.resolve(__dirname, "gmail-client.credential.json");
const TOKEN_PATH = path.resolve(__dirname, "gmail-token.credential.json");
const AUTH_TIMEOUT = 1000 * 60 * 10;
let AUTH = undefined;
module.exports = function auth() {
    return new Promise((resolve, reject) => {
        if(AUTH) return resolve(auth);
        fs.readFile(CREDENTIAL_PATH, (err, credential) => {
            if (err) return console.log("Error loading client secret file:", err);
            const timeoutTimer = setTimeout(() => {
                reject(new Error("Delayed authentication"))
            }, AUTH_TIMEOUT);
            _authorize(JSON.parse(credential), (auth) => {
                clearTimeout(timeoutTimer);
                AUTH = auth;
                resolve(auth);
            });
        });
    })
};


function _authorize(credentials, callback) {
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return _getNewToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    });
}

function _getNewToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
    });
    console.log("Authorize this app by visiting this url:", authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question("Enter the code from that page here: ", (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error("Error retrieving access token", err);
            oAuth2Client.setCredentials(token);
            // Store the token to disk for later program executions
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
                console.log("Token stored to", TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    });
}
