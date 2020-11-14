const request = require("request");
const fxp = require("fast-xml-parser");
const qs = require("querystring");

const utils = require("../utils.js");
const log = require("../log.js");

module.exports = {
    getAmenities: (req, res) => {
        log.inf("=> GET /osm/getamenities/:s/:w/:n/:e");
        if (isNaN(req.params.s) || isNaN(req.params.w) || isNaN(req.params.n) || isNaN(req.params.e)) {
            log.err(" <= RES /osm/getamenities/:s/:w/:n/:e ERROR not a number.", req.params);
            res.sendStatus(500);
            return;
        }
        if ((req.params.n - req.params.s) * (req.params.e - req.params.w) > 0.000003) {
            log.err(" <= RES /osm/getamenities/:s/:w/:n/:e ERROR bounding box too large.", (req.params.n - req.params.s) * (req.params.s - req.params.w));
            res.sendStatus(500);
            return;
        }
        var bbox = '(' + req.params.s + ',' + req.params.w + ',' + req.params.n + ',' + req.params.e + ')';
        request({
            url: 'https://www.overpass-api.de/api/interpreter?data=[out:json][timeout:25];(node["amenity"]' + bbox + ';node["shop"]' + bbox + ';);out;',
            method: "GET"
        }, (err, rs, body) => {
            if (err) {
                log.err(" <= RES /osm/getamenities/:s/:w/:n/:e ERROR problem with overpass query.", [ err, body ]);
                res.sendStatus(500);
            } else {
                if (body.startsWith("<")) {
                    log.err(" <= RES /osm/getamenities/:s/:w/:n/:e ERROR problem with overpass query.", body);
                    res.sendStatus(500);
                    return;
                }
                log.inf(" <= RES /osm/getamenities/:s/:w/:n/:e SUCCESS");
                res.send(body);
            }
        });
    },
    getUserDetails: (req, res) => {
        log.inf("=> GET /osm/getuserdetails");
        request({
            url: global.osm.endpoint + global.osm.api_version + "/user/details",
            method: "GET",
            oauth: {
                consumer_key: global.osm.consumer_key,
                consumer_secret: global.osm.consumer_secret,
                token: req.session.access_token,
                token_secret: req.session.access_token_secret
            },
            headers: {
                "content-type": "text/xml"
            }
        }, (err, rs, body) => {
            if (err) {
                log.err(" <= RES /osm/getuserdetails ERROR", [ err, body ]);
                res.sendStatus(500);
            } else {
                if(fxp.validate(body) === true) {
                    var jsonBody = fxp.parse(body, { ignoreAttributes: false });
                    log.inf(" <= RES /osm/getuserdetails SUCCESS");
                    res.send({
                        id: jsonBody.osm.user["@_id"],
                        name: jsonBody.osm.user["@_display_name"]
                    });
                }
            }
        });
    },
    uploadNodes: (req, res) => {
        log.alt("=> POST /osm/uploadnodes");
        if (!req.body || !req.body.pois || !req.session.access_token_secret) { 
            log.err(" <= RES /osm/uploadnodes ERROR no body, no pois or not authenticated.", [ req.body, req.session.access_token_secret ]); 
            res.sendStatus(500); 
            return;
        }
        var pois = req.body.pois;
        var oauth = {
            consumer_key: global.osm.consumer_key,
            consumer_secret: global.osm.consumer_secret,
            token: req.session.access_token,
            token_secret: req.session.access_token_secret
        };
        request({
            url: global.osm.endpoint + global.osm.api_version + "/changeset/create",
            method: "PUT",
            oauth: oauth,
            headers: {
                "content-type": "text/xml"
            },
            body: '<osm><changeset><tag k="created_by" v="PopulateOSM"/><tag k="comment" v="Added points of interest via PopulateOSM"/></changeset></osm>'
        }, (err, rs, changesetId) => {
            if (err || !changesetId) {
                log.err(" <= RES /osm/uploadnodes ERROR changeset creation went wrong.", [ changesetId, err ]);
                res.sendStatus(500);
            } else {
                var content = "<osmChange><create>";
                for (var poi of pois) {
                    if (poi.category === "-Select an option-" || (poi.type !== "amenity" && poi.type !== "shop")) { 
                        log.err(" <= RES /osm/uploadnodes ERROR invalid amenity or shop.", [ changesetId, poi ]); 
                        res.sendStatus(500); 
                        return;
                    }
                    content += '<node id="' + (Math.floor(Math.random() * 10000000) - 10000000) + '" changeset="' + changesetId + '" version="1" lat="' + poi.lat.toString().substr(0, 13) + '" lon="' + poi.lng.toString().substr(0, 13) + '">' +
                        '<tag k="name" v="' + utils.escapeXml(poi.name) + '"/>' + 
                        '<tag k="' + utils.escapeXml(poi.type) + '" v="' + utils.escapeXml(poi.category) + '"/>' +
                    '</node>';
                }
                content += "</create></osmChange>";
                request({
                    url: global.osm.endpoint + global.osm.api_version + "/changeset/" + changesetId + "/upload",
                    method: "POST",
                    oauth: oauth,
                    headers: {
                        "content-type": "text/xml"
                    },
                    body: content
                }, (err, rs, uploadbody) => {
                    if (err) {
                        log.err(" <= RES /osm/uploadnodes ERROR uploading nodes to changeset failed.", [ changesetId, err, uploadbody ]);
                        res.sendStatus(500);
                    } else if (uploadbody.startsWith("Fatal error")) {
                        log.err(" <= RES /osm/uploadnodes ERROR uploading nodes to changeset failed.", [ changesetId, uploadbody ]);
                        res.sendStatus(500);
                    } else {
                        request({
                            url: global.osm.endpoint + global.osm.api_version + "/changeset/" + changesetId + "/close",
                            method: "PUT",
                            oauth: oauth,
                            headers: {
                                "content-type": "text/xml"
                            }
                        }, (err, rs, body) => {
                            if (err) {
                                log.err(" <= RES /osm/uploadnodes ERROR closing changeset failed.", [ changesetId, err, body ]);
                                res.sendStatus(500);
                            } else {
                                log.suc(" <= RES /osm/uploadnodes SUCCESS. changeset " + changesetId);
                                res.send(utils.getNewNodeIds(uploadbody));
                            }
                        });
                    }
                });
            }     
        });
    },
    getRequestToken: (req, res) => {
        log.inf("=> POST /oauth/request");
        request.post({
            url: global.osm.endpoint + "/oauth/request_token", 
            oauth: {
                callback: global.localurl + "/api/osm/oauth/callback",
                consumer_key: global.osm.consumer_key,
                consumer_secret: global.osm.consumer_secret
            }
        }, (err, rs, body) => {
            if (err) {
                log.err(" <= RES /oauth/request ERROR request token failed.", [ err, body ]);
                res.sendStatus(500);
            } else {
                var bodyObject = qs.parse(body);
                req.session.oauth_token = bodyObject.oauth_token;
                req.session.oauth_token_secret = bodyObject.oauth_token_secret;
                log.inf(" <= RES /oauth/request SUCCESS");
                res.send(global.osm.endpoint + "/oauth/authorize?oauth_token=" + bodyObject.oauth_token);
            }
        });
    },
    doRequestTokenCallback: (req, res) => {
        log.alt("=> GET /oauth/callback");
        request.post({
            url: global.osm.endpoint + "/oauth/access_token", 
            oauth: {
                consumer_key: global.osm.consumer_key,
                consumer_secret: global.osm.consumer_secret,
                token: req.query.oauth_token,
                token_secret: req.session.oauth_token_secret,
                verifier: req.query.oauth_verifier
            }
        }, (err, rs, body) => {
            if (err) {
                log.err(" <= RES /oauth/callback ERROR token callback failed", [ err, body ]);
                res.sendStatus(500);
            } else {
                var perm_data = qs.parse(body);
                req.session.access_token = perm_data.oauth_token;
                req.session.access_token_secret = perm_data.oauth_token_secret;
                log.suc(" <= RES /oauth/callback SUCCESS");
                res.sendFile(global.appRoot + "/public/land.html");
            }
        });
    },
    getIsAuthenticated: (req, res) => {
        log.inf("=> GET /oauth/isauthenticated");
        if (req.session.access_token && req.session.access_token_secret) {
            log.inf(" <= RES /oauth/isauthenticated SUCCESS");
            res.send({ isAuthenticated: true });
        } else {
            log.inf(" <= RES /oauth/isauthenticated SUCCESS");
            res.send({ isAuthenticated: false });
        }
    },
    doLogout: (req, res) => {
        log.inf("=> GET /oauth/logout");
        req.session.destroy((err) => {
            if (err) {
                log.err(" <= RES /oauth/logout ERROR", err);
                res.sendStatus(500);
            } else {
                log.inf(" <= RES /oauth/logout SUCCESS");
                res.sendStatus(200);
            }
        });
    }
};