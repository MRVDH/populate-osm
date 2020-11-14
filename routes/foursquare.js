const request = require("request");
const log = require("../log.js");

module.exports = {
    searchPOIs: (req, res) => {
        log.inf("=> GET /foursquare/search/:ne/:sw");
        request({
            url: "https://api.foursquare.com/v2/venues/search",
            method: "GET",
            qs: {
                client_id: process.env.FOURSQUARE_CLIENT_ID,
                client_secret: process.env.FOURSQUARE_CLIENT_SECRET,
                v: "20180323",
                intent: "browse",
                sw: req.params.sw,
                ne: req.params.ne
            }
        }, function(err, rs, body) {
            if (err) {
                log.err(" <= RES /foursquare/search/:ne/:sw ERROR", "foursquare venue search.", [ err, body ]);
                res.sendStatus(500);
            } else {
                log.inf(" <= RES /foursquare/search/:ne/:sw SUCCESS");
                res.send(body);
            }
        });
    }
};