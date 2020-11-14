const log = require("./log.js");
log.inf("Loading middleware...");

const express = require("express");
const session = require("express-session"); 
const bodyParser = require("body-parser");
const uuid = require("uuid/v4");
const MongoStore = require("connect-mongo")(session);
const path = require("path");

require('dotenv').config()

const routeMain = require("./routes/main");
const routeOsm = require("./routes/osm");
const routeFoursquare = require("./routes/foursquare");

log.inf("Configuring middleware...");
const app = express();
const port = 8080;
global.appRoot = path.resolve(__dirname);
global.osm = {};
if (process.argv.includes("dev")) {
    log.alt("Dev mode");
    global.localurl = "http://lvh.me";
    global.osm.endpoint = process.env.OSM_DEV_ENDPOINT;
    global.osm.consumer_secret = process.env.OSM_DEV_CONSUMER_SECRET;
    global.osm.consumer_key = process.env.OSM_DEV_CONSUMER_KEY;
    global.osm.api_version = process.env.OSM_DEV_API_VERSION;
} else {
    log.alt("Production mode");
    global.localurl = "https://populateosm.com";
    global.osm.endpoint = process.env.OSM_ENDPOINT;
    global.osm.consumer_secret = process.env.OSM_CONSUMER_SECRET;
    global.osm.consumer_key = process.env.OSM_CONSUMER_KEY;
    global.osm.api_version = process.env.OSM_API_VERSION;
}
app.use(session({
    genid: (req) => {
        return uuid();
    },
    store: new MongoStore({
        url: process.env.MONGODB_CONNECTION,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true
}));
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

log.inf("Setting up routing...");
app.get("/api/main/getlocation", routeMain.getLocation);

app.post("/api/osm/oauth/request", routeOsm.getRequestToken);
app.get("/api/osm/oauth/callback", routeOsm.doRequestTokenCallback);
app.get("/api/osm/oauth/isauthenticated", routeOsm.getIsAuthenticated);
app.post("/api/osm/oauth/logout", routeOsm.doLogout);
app.get("/api/osm/getamenities/:s/:w/:n/:e", routeOsm.getAmenities);
app.get("/api/osm/getuserdetails", routeOsm.getUserDetails);
app.post("/api/osm/uploadnodes", routeOsm.uploadNodes);

app.get("/api/foursquare/search/:ne/:sw", routeFoursquare.searchPOIs);

log.inf("App setup finish. Starting server...");
app.listen(port, () => log.suc("Server running on port " + port));