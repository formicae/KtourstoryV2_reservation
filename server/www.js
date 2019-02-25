const Log = require("../log");
const http = require("http");
const app = require("./app");

const server = http.createServer(app);

server.listen(normalizePort(app.get("PORT")), () => {
    console.log('\x1b[36m%s\x1b[0m', `Server is running on port:${normalizePort(app.get("PORT"))}`);
});

function normalizePort(val) {
    let port = parseInt(val, 10);
    if (isNaN(port)) {
        return val;
    }
    if (port >= 0) {
        return port;
    }
    return false;
}