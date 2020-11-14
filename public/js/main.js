class AuthControl {
    constructor(map, osmRequestHandler) {
        this._map = map;
        this._osmRequestHandler = osmRequestHandler;
        this._btnGroup = $("<div id='authControlGroup' class='btn-control-group'>" +
            "<a target='_blank' id='btn-login' class='mapboxgl-custombtn-disabled br-left'>Checking login status...</a>" +
            "<a id='btn-upload' class='mapboxgl-custombtn-disabled br-right'>Upload</a>" +
        "</div>");
        this._btnGroup.find("#btn-login").click(this.clickLogin);
        this._btnGroup.find("#btn-upload").click(this, this.clickUpload);
    }

    addToMap() {
        $("#map").append(this._btnGroup);
    }

    clickLogin() {
        if (!$("#btn-login").hasClass("mapboxgl-custombtn-disabled")) {
            $("#loading-icon").removeClass("hidden");
            $("#btn-login").addClass("mapboxgl-custombtn-disabled");
            $("#btn-login").removeClass("mapboxgl-custombtn");
            osmRequestHandler.checkUserLoggedIn((loggedIn) => {
                if (loggedIn) {
                    osmRequestHandler.logout((done) => {
                        if (done) {
                            notify(NOTIFICATIONS.SUCCESS, "Succesfully logged out.");
                            $("#btn-login").removeClass("mapboxgl-custombtn-disabled");
                            $("#btn-login").addClass("mapboxgl-custombtn");
                            $("#btn-login").text("Login");
                            $.post("/api/osm/oauth/request").done((data) => {
                                $("#loading-icon").addClass("hidden");
                                $("#btn-login").attr("href", data);
                            }).fail((jqXHR, textStatus, errorThrown) => {
                                $("#loading-icon").addClass("hidden");
                                notify(NOTIFICATIONS.ERROR, textStatus + ": " + errorThrown);
                                console.error(jqXHR);
                            });
                        } else {
                            $("#loading-icon").addClass("hidden");
                            notify(NOTIFICATIONS.ERROR, "Error logging out.");
                        }
                    });
                } else if (loggedIn === null) {
                    $("#loading-icon").addClass("hidden");
                    notify(NOTIFICATIONS.ERROR, "Error while checking if user is logged in. Please check your internet connection.");
                }
            });
        }
    }

    addUsernameToLoginButton() {
        osmRequestHandler.getUserDetails((res) => {
            if (res) {
                $("#btn-login").text("Logout (" + res.name + ")");
                $("#btn-login").removeClass("mapboxgl-custombtn-disabled");
                $("#btn-login").addClass("mapboxgl-custombtn");
                $("#btn-login").removeAttr("href");
                if (poiStorage.getPois().length >= 1) {
                    $("#btn-upload").removeClass("mapboxgl-custombtn-disabled");
                    $("#btn-upload").addClass("mapboxgl-custombtn");
                }
                $("#loading-icon").addClass("hidden");
                notify(NOTIFICATIONS.SUCCES, "Succesfully logged in!");
            }
        });
    }

    clickUpload(inst) {
        if (!$("#btn-upload").hasClass("mapboxgl-custombtn-disabled")) {
            inst.data._osmRequestHandler.uploadPois();
        }
    }

    updateText(text) {
        $("#btn-login").text(text);
    }
    
    updateUploadCounter(amount) {
        $("#btn-upload").text("Upload (" + amount + ")");
    }

    updateUploadText(text) {
        $("#btn-upload").text(text);
    }
}
class OsmRequestHandler {
    constructor() {
        this._poisToAdd = [];
    }

    checkUserLoggedIn(callback) {
        $.get("/api/osm/oauth/isauthenticated").done((body) => {
            callback(body.isAuthenticated);
        }).fail((jqXHR, textStatus, errorThrown) => {
            notify(NOTIFICATIONS.ERROR, textStatus + ": " + errorThrown);
            console.error(jqXHR);
            callback(null);
        });
    }

    logout(callback) {
        $.post("/api/osm/oauth/logout").done((done, textStatus, jqXHR) => {
            if (jqXHR.status === 200) {
                callback(true);
            } else {
                callback(false);
            }
        }).fail((jqXHR, textStatus, errorThrown) => {
            notify(NOTIFICATIONS.ERROR, textStatus + ": " + errorThrown);
            console.error(jqXHR);
            callback(false);
        });
    }

    getUserDetails(callback) {
        $.get("/api/osm/getuserdetails").done((body) => {
            callback(body);
        }).fail((jqXHR, textStatus, errorThrown) => {
            notify(NOTIFICATIONS.ERROR, textStatus + ": " + errorThrown);
            console.error(jqXHR);
            callback(null);
        });
    }

    getPoisInBoundingBox(s, w, n ,e, callback) {
        $.get("/api/osm/getamenities/" + s + "/" + w + "/" + n + "/" + e).done((data) => {
            callback(JSON.parse(data).elements);
        }).fail((jqXHR, textStatus, errorThrown) => {
            notify(NOTIFICATIONS.ERROR, textStatus + ": " + errorThrown);
            console.error(jqXHR);
            callback(null);
        });
    }

    addPoi(poi) {
        this._poisToAdd.push({
            name: poi.name,
            category: poi.category,
            type: poi.type,
            lng: poi.lng,
            lat: poi.lat
        });
    }

    uploadPois() {
        var instance = this;
        var pois = this._poisToAdd;

        authControl.updateUploadText("Uploading...");
        $("#btn-upload").addClass("mapboxgl-custombtn-disabled");
        $("#btn-upload").removeClass("mapboxgl-custombtn");
        $("#loading-icon").removeClass("hidden");

        $.post("/api/osm/uploadnodes", { pois: pois }).done((body) => {
            notify(NOTIFICATIONS.SUCCES, "Changes succesfully uploaded!");
            authControl.updateUploadText("Upload succesful");
            instance._poisToAdd = [];
            poiStorage.clearPoiList();
            $("#loading-icon").addClass("hidden");
            var uploadedMarkers = [];
            for (var i in pois) {
                let mark = pois[i];
                mark.id = body[i];
                uploadedMarkers.push(mark);
            }
            replaceAllIcons(uploadedMarkers);
        }).fail((jqXHR, textStatus, errorThrown) => {
            notify(NOTIFICATIONS.ERROR, "Upload failed.");
            authControl.updateUploadCounter(osmRequestHandler._poisToAdd.length);
            $("#loading-icon").addClass("hidden");
            console.error(jqXHR);
        });
    }
}
class FoursquareRequestHandler {
    constructor() {

    }

    getPoisInBoundingBox(nelat, nelng, swlat, swlng, callback) {
        $.get("/api/foursquare/search/" + nelat + "," + nelng + "/" + swlat + "," + swlng, (data) => {
            callback(JSON.parse(data).response.venues);
        });
    }
}
class PoiStorage {
    constructor() {
        this._storage = "pois";
        this._pois = JSON.parse(localStorage.getItem(this._storage)) || [];
    }

    getPois() {
        return this._pois;
    }

    addPoi(poi) {
        poiStorage._pois.push(poi);
        localStorage.setItem(poiStorage._storage, JSON.stringify(poiStorage._pois));
    }

    clearPoiList() {
        poiStorage._pois = [];
        localStorage.removeItem(poiStorage._storage);
    }
}
class LocationStorage {
    constructor() {
        this._storage = "loc";
        this._location = JSON.parse(localStorage.getItem(this._storage));
    }

    setLocation(zoom, lng, lat) {
        this._location = {
            zoom: zoom.toString().substr(0, 4),
            lng: lng.toString().substr(0, 13),
            lat: lat.toString().substr(0, 13)
        };
        localStorage.setItem(this._storage, JSON.stringify(this._location));
        window.location.hash = "#" + this._location.zoom + "/" + this._location.lng + "/" + this._location.lat;
    }

    getLocation() {
        this._location = JSON.parse(localStorage.getItem(this._storage));
        return this._location;
    }
}
class RefreshControl {
    onAdd(map) {
        this._map = map;
        this._container = document.createElement("div");
        this._container.className = "mapboxgl-ctrl mapboxgl-custombtn";
        this._container.textContent = "Refresh";
        this._container.onclick = () => {
            if (isBoundingBoxTooLarge()) {
                notify(NOTIFICATIONS.INFO, "Please zoom in more.");
            }
            replaceAllIcons();
        }
        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}
class MarkerHandler {
    constructor(map, name, url, color, css) {
        this._map = map;
        this._name = name;
        this._url = url;
        this._color = color;
        this._css = css;
        this._markers = {};
        this._markertext = {};
        this._openPopup;
    }

    addMarker(point, lng, lat, id, name = "&lt;no name&gt;", category, type = null) {
        var popup = new mapboxgl.Popup({ offset: 37 }).setHTML(
            "<div class='markerid' " + (id ? ("id='" + this._name + "_" + id + "'") : "") + ">" +
                "<strong class='marker-name'>" + name + "</strong><br/>" +
                (this._name === "Foursquare" ? (category ? category + "<br/>" : "") : (category ? (type ? type + ": " : "") + category + "<br/>" : "")) +
                (id ? ("<a target='_blank' href='" + this._url + id + "'>" + this._name + "-link</a><br/>") : ("<span>Marker not uploaded yet.</span><br/>")) +
                "<div class='popup-btn-group'>" +
                    //(this._name === "Foursquare" ? "<p class='popup-btn action-add'>Add to OSM</p>" : "") +
                    (name !== "&lt;no name&gt;" ? "<p class='popup-btn action-add'>Add to " + (this._name === "OSM" ? "Foursquare" : "OSM") + "</p>" : "") +
                "</div>" +
            "</div>");
        var marker = new mapboxgl.Marker({ color: this._color })
            .setLngLat([lng, lat])
            .setPopup(popup)
            .addTo(this._map);
        marker.name = name;
        var el = document.createElement('div');
        el.className = 'cmarkertext';
        el.innerText = name;
        var markertext = new mapboxgl.Marker(el)
            .setLngLat([lng, lat])
            .setOffset([ 0, 12 ])
            .addTo(map);
        //$(popup._content).find(".action-add").click({ point: point }, showAddModal);
        $(popup._content).find(".action-add").click(() => {
            notify(NOTIFICATIONS.ERROR, "Adding data has been temporarily disabled.");
        });
        if (id === null) {
            id = Math.floor((Math.random() * 99999990) + 2);
        }
        this._markers[id] = marker;
        this._markertext[id] = markertext;
    }

    removeMarkers(ins) {
        for (var marker in ins._markers) {
            ins._markers[marker].remove();
        }
        ins._markers = {};
        for (var marker in ins._markertext) {
            ins._markertext[marker].remove();
        }
        ins._markertext = {};
    }
}
class Modal {
    constructor(id) {
        this._instance = this;
        this._id = id;
        this._jqModal = $("body").append(
            "<div id='" + id + "' class='contain'>" + 
                "<div id='modal-content' class='animate modal modal-content active'>" +
                    "<form id='modal-name' class='modal-popup'>" +
                        "<div id='modal-elements' class='col6 modal-body fill-white contain'>" +
                            "<a href='#close' class='quiet icon fr close'></a>" +
                            "<div id='modal-inputelements' class='pad2'></div>" +
                        "</div>" +
                    "</form>" +
                "</div>" +
            "</div>"
        );
        $("#modal-name").click(this.destroy);
        $("#modal-elements").click((e) => {
            e.stopPropagation();
        });
    }

    addText(label, id) {
        this._jqModal.find("#modal-inputelements").append(
            "<fieldset>" +
                "<label>" + label + "</label>" +
            "</fieldset>"
        );
        return this;
    }
    addTextInput(label, id, placeholder, defaultText) {
        this._jqModal.find("#modal-inputelements").append(
            "<fieldset>" +
                "<label>" + label + "</label>" +
                "<input id='" + this._id + "_" + id + "' type='text' " + (placeholder ? "placeholder='" + placeholder + "'" : "") + "' value='" + (defaultText ? defaultText : "") + "' class='stretch'></input>" +
            "</fieldset>"
        );
        return this;
    }
    addTextIconInput(label, id, placeholder, defaultText, icon, click) {
        this._jqModal.find("#modal-inputelements").append(
            "<fieldset style='margin-bottom: 0;'>" +
                "<label>" + label + "</label>" +
            "</fieldset>" +
            "<fieldset class='with-icon'>" +
                "<span id='" + this._id + "_" + id + "_icon' class='icon " + icon + "' style='cursor: pointer'></span>" +
                "<input id='" + this._id + "_" + id + "' type='text' " + (placeholder ? "placeholder='" + placeholder + "'" : "") + "' value='" + (defaultText ? defaultText : "") + "' class='stretch'></input>" +
            "</fieldset>"
        );
        $("#" + this._id + "_" + id + "_icon").click(click);
        return this;
    }
    addDropdown(label, id, itemList, defaultItem) {
        var selectHtml = "<option value='none'>-Select an option-</option>";
        for (var item of itemList) {
            selectHtml += "<option value='" + item + "' " + (defaultItem === item ? "selected='selected'" : "") + ">" + item + "</option>"
        }
        this._jqModal.find("#modal-inputelements").append(
            "<fieldset>" +
                "<label>" + label + "</label>" +
                "<select id='" + this._id + "_" + id + "'>" + selectHtml + "</select>" +
            "</fieldset>"
        );
        return this;
    }
    addSubmitCancelButtons(clickSubmit, clickCancel) {
        this._jqModal.find("#modal-elements").append(
            "<div class='fill-gray pad2y pad2x clearfix'>" +
                "<div class='fr space clearfix'>" +
                    "<input type='button' class='button cs-submit' value='Submit'/>" +
                    "<input type='button' class='button fill-red cs-cancel' value='Cancel'/>" +
                "</div>" +
            "</div>"
        );
        $("#modal-elements .cs-submit").click(clickSubmit);
        $("#modal-elements .cs-cancel").click(clickCancel);
        return this;
    }
    updateInputContent(id, content) {
        this._jqModal.find("#" + this._id + "_" + id).attr("value", content);
    }
    show() {
        this._jqModal.find("#modal-content").addClass("active");
        return this;
    }
    hide() {
        this._jqModal.find("#modal-content").removeClass("active");
        return this;
    }
    destroy() {
        addPlaceModal._jqModal.find("#" + addPlaceModal._id).remove();
        addPlaceModal = undefined;
    }
}


// constants
var PROVIDERS = {
    OSM: "osm",
    FOURSQUARE: "fs"
};
var NOTIFICATIONS = {
    SUCCES: "succes",
    WARNING: "warning",
    ERROR: "error",
    INFO: "info"
};
var AMENITIES = [
    "animal_boarding",
    "animal_shelter",
    "archive",
    "arts_centre",
    "atm",
    "baby_hatch",
    "baking_oven",
    "bank",
    "bar",
    "bbq",
    "bench",
    "bicycle_parking",
    "bicycle_rental",
    "bicycle_repair_station",
    "biergarten",
    "blood_donation",
    "boat_rental",
    "boat_sharing",
    "brothel",
    "buggy_parking",
    "bureau_de_change",
    "bus_station",
    "cafe",
    "car_rental",
    "car_sharing",
    "car_wash",
    "casino",
    "charging_station",
    "cinema",
    "clinic",
    "clock",
    "college",
    "community_centre",
    "courthouse",
    "coworking_space",
    "crematorium",
    "crypt",
    "dentist",
    "dive_centre",
    "doctors",
    "dojo",
    "drinking_water",
    "driving_school",
    "embassy",
    "fast_food",
    "ferry_terminal",
    "fire_station",
    "food_court",
    "fountain",
    "fuel",
    "gambling",
    "game_feeding",
    "grave_yard",
    "grit_bin",
    "hospital",
    "hunting_stand",
    "ice_cream",
    "internet_cafe",
    "kindergarten",
    "kitchen",
    "kneipp_water_cure",
    "language_school",
    "library",
    "marketplace",
    "motorcycle_parking",
    "music_school",
    "nightclub",
    "nursing_home",
    "parking",
    "parking_entrance",
    "parking_space",
    "pharmacy",
    "photo_booth",
    "place_of_worship",
    "planetarium",
    "police",
    "post_box",
    "post_office",
    "prison",
    "pub",
    "public_bath",
    "public_bookcase",
    "ranger_station",
    "recycling",
    "rescue_station",
    "research_institute",
    "restaurant",
    "sanitary_dump_station",
    "school",
    "shelter",
    "shower",
    "social_centre",
    "social_facility",
    "stripclub",
    "studio",
    "swingerclub",
    "table",
    "taxi",
    "telephone",
    "theatre",
    "ticket_validator",
    "toilets",
    "townhall",
    "university",
    "vehicle_inspection",
    "vending_machine",
    "veterinary",
    "waste_basket",
    "waste_disposal",
    "waste_transfer_station",
    "water_point",
    "watering_place"
];
var SHOPS = [
    "agrarian","alcohol","anime","antiques","appliance","art","atv","baby_goods","bag","bakery","bathroom_furnishing","beauty","bed","beverages","bicycle","boat","bookmaker","books","boutique","brewing_supplies","butcher","camera","candles","cannabis","car","car_parts","car_repair","carpet","charity","cheese","chemist","chocolate","clothes","coffee","collector","computer","confectionery","convenience","copyshop","cosmetics","craft","curtain","dairy","deli","department_store","doityourself","doors","dry_cleaning","e-cigarette","electrical","electronics","energy","erotic","fabric","farm","fashion","fireplace","fishing","flooring","florist","frame","free_flying","frozen_food","fuel","funeral_directors","furniture","games","garden_centre","garden_furniture","gas","general","gift","glaziery","greengrocer","hairdresser","hairdresser_supply","hardware","health_food","hearing_aids","herbalist","hifi","houseware","hunting","ice_cream","interior_decoration","jetski","jewelry","kiosk","kitchen","lamps","laundry","leather","locksmith","lottery","mall","massage","medical_supply","mobile_phone","model","money_lender","motorcycle","music","musical_instrument","newsagent","nutrition_supplements","optician","organic","outdoor","paint","party","pasta","pastry","pawnbroker","perfumery","pet","photo","pyrotechnics","radiotechnics","religion","robot","scuba_diving","seafood","second_hand","security","sewing","shoes","ski","snowmobile","spices","sports","stationery","storage_rental","supermarket","swimming_pool","tailor","tattoo","tea","ticket","tiles","tobacco","toys","trade","travel_agency","trophy","tyres","vacant","vacuum_cleaner","variety_store","video","video_games","watches","water","weapons","wholesale","window_blind","wine"
];

// global variables
var userDetails;
var flying = false;
var markerSelectMode = false;
var clickedLngLat = {};
var clickOverlay = false;
var addPlaceModal;
var loadingFsMarkers = false;
var loadingOsmMarkers = false;
var canLoadData = true;

// map setup
var map = new mapboxgl.Map({
    container: "map",
    style: "https://tiles.stadiamaps.com/styles/alidade_smooth.json",
});
mapboxgl.setRTLTextPlugin("https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.1/mapbox-gl-rtl-text.js");

// classes
var osmRequestHandler = new OsmRequestHandler();
var foursquareRequestHandler = new FoursquareRequestHandler();
var locationStorage = new LocationStorage();
var poiStorage = new PoiStorage();
var authControl = new AuthControl(map, osmRequestHandler);
var osmMarkerHandler = new MarkerHandler(map, "OSM", "https://openstreetmap.org/node/", "#7EBC6F", "marker-osm");
var foursquareMarkerHandler = new MarkerHandler(map, "Foursquare", "https://foursquare.com/v/", "#F94877", "marker-fs");
var uploadMarkerHandler = new MarkerHandler(map, "Upload", "https://openstreetmap.org/node/", "#FDA50F", "marker-upload");

// map controls
authControl.addToMap();
map.addControl(new RefreshControl(map), "top-left");
map.addControl(new mapboxgl.NavigationControl());
var geolocate = new mapboxgl.GeolocateControl({
    positionOptions: {
        enableHighAccuracy: true
    },
    fitBoundsOptions: {
        maxZoom: 19
    },
    trackUserLocation: true
});
map.addControl(geolocate);

// checks
osmRequestHandler.checkUserLoggedIn((loggedIn) => {
    if (loggedIn) {
        $("#btn-login").removeClass("mapboxgl-custombtn-disabled");
        $("#btn-login").addClass("mapboxgl-custombtn");
        authControl.updateText("Logout");
        osmRequestHandler.getUserDetails((res) => {
            userDetails = res;
            authControl.updateText("Logout (" + res.name + ")");
            notify(NOTIFICATIONS.SUCCES, "Welcome back, " + res.name);
        });
    } else if (loggedIn === false) {
        $("#btn-login").removeClass("mapboxgl-custombtn-disabled");
        $("#btn-login").addClass("mapboxgl-custombtn");
        authControl.updateText("Login");
        $.post("/api/osm/oauth/request").done((data) => {
            $("#btn-login").attr("href", data);
        }).fail((jqXHR, textStatus, errorThrown) => {
            notify(NOTIFICATIONS.ERROR, textStatus + ": " + errorThrown);
            console.error(jqXHR);
        });
    } else if (loggedIn === null) {
        notify(NOTIFICATIONS.ERROR, "Error while checking if user is logged in. Please check your internet connection.");
    }
});
if(loc = locationStorage.getLocation()) {
    map.jumpTo({
        zoom: loc.zoom,
        center: [loc.lng, loc.lat]
    });
    window.location.hash = "#" + loc.zoom + "/" + loc.lng + "/" + loc.lat;
} else {
    $.get("/api/main/getlocation", (data) => {
        map.jumpTo({
            zoom: 13,
            center: [data[1], data[0]]
        });
    });
}
if (pois = poiStorage.getPois()) {
    for (var poi of pois) {
        osmRequestHandler.addPoi(poi);
        authControl.updateUploadCounter(osmRequestHandler._poisToAdd.length);
    }
    osmRequestHandler.checkUserLoggedIn((res) => {
        if (res && pois.length >= 1) {
            $("#btn-upload").removeClass("mapboxgl-custombtn-disabled");
            $("#btn-upload").addClass("mapboxgl-custombtn");
        }
    });
}

// event listeners
map.on("click", (e) => {
    clickedLngLat = e.lngLat;
    if (clickOverlay) {
        $(".mapboxgl-canvas").removeClass("cursor-crosshair");
        notify(NOTIFICATIONS.SUCCES, "Selected: " + clickedLngLat.lng.toString().substr(0, 13) + "," + clickedLngLat.lat.toString().substr(0, 13));
        addPlaceModal.show();
        addPlaceModal.updateInputContent("location", clickedLngLat.lng.toString().substr(0, 13) + "," + clickedLngLat.lat.toString().substr(0, 13));
        clickOverlay = false;
    }
});
map.on("moveend", () => {
    if (flying) {
        replaceAllIcons();
        map.fire("flyend");
    }
    locationStorage.setLocation(map.getZoom(), map.getCenter().lng, map.getCenter().lat);
    replaceAllIcons();
});
map.on("flystart", () => {
    flying = true;
});
map.on("flyend", () => {
    flying = false;
});
geolocate.on("trackuserlocationstart", () => {
    map.fire("flystart");
});
$(document).ready(() => {
    if (isBoundingBoxTooLarge()) { notify(NOTIFICATIONS.INFO, "Please zoom in more."); }
    replaceAllIcons();
});

// functions
function isBoundingBoxTooLarge() {
    return (map.getBounds().getNorth() - map.getBounds().getSouth()) * (map.getBounds().getEast() - map.getBounds().getWest()) > 0.000003;
}
function notify(type, message) {
    nativeToast({
        message: message,
        position: "north",
        timeout: 5000,
        type: type
    });
}
function checkDuplicateMarkers() {
    var osmMrks = osmMarkerHandler._markers;
    var fsMrks = foursquareMarkerHandler._markers;
    for (var osmMarker in osmMrks) {
        var found = false;
        var foundFourquareItem;
        for (var foursquareMarker in fsMrks) {
            if (osmMrks[osmMarker].name.toLowerCase() === fsMrks[foursquareMarker].name.toLowerCase()) {
                foundFourquareItem = fsMrks[foursquareMarker];
                found = true;
                break;
            }
        }
        if (found) {
            $(osmMrks[osmMarker]._element).addClass("low-opacity");
            $(foundFourquareItem._element).addClass("low-opacity");
            $(osmMarkerHandler._markertext[osmMarker]._element).addClass("low-opacity");
            $(foursquareMarkerHandler._markertext[foursquareMarker]._element).addClass("low-opacity");
            $(osmMrks[osmMarker]._popup._content).find(".popup-btn-group").prepend("<span style='color: red;'>This place seems to exist on Foursquare already.</span><br>");
            $(foundFourquareItem._popup._content).find(".popup-btn-group").prepend("<span style='color: red;'>This place seems to exist on OSM already.</span><br>");
        }
    }
}
function getAndPlaceFoursquareIcons() {
    loadingFsMarkers = true;
    $("#loading-icon").removeClass("hidden");
    var bnds = map.getBounds();
    foursquareRequestHandler.getPoisInBoundingBox(bnds.getNorthEast().lat, bnds.getNorthEast().lng, bnds.getSouthWest().lat, bnds.getSouthWest().lng,(foursquarePois) => {
        foursquarePois.forEach(point => {
            if (!(point.id in foursquareMarkerHandler._markers)) {
                foursquareMarkerHandler.addMarker(point, point.location.lng, point.location.lat, point.id, point.name, (point.categories.length > 0 ? point.categories[0].name : null));
            }
        });
        loadingFsMarkers = false;
        if (!loadingOsmMarkers) {
            $("#loading-icon").addClass("hidden");
            checkDuplicateMarkers();
        }
    });
}
function getAndPlaceOSMIcons(uploadedMarkers) {
    loadingOsmMarkers = true;
    $("#loading-icon").removeClass("hidden");
    var bnds = map.getBounds();
    osmRequestHandler.getPoisInBoundingBox(bnds.getSouth(), bnds.getWest(), bnds.getNorth(), bnds.getEast(), (osmPois) => {
        if (!osmPois) return;
        uploadMarkerHandler.removeMarkers(uploadMarkerHandler);

        osmPois.forEach(point => {
            if (!(point.id in osmMarkerHandler._markers)) {
                osmMarkerHandler.addMarker(point, point.lon, point.lat, point.id, point.tags.name, point.tags.amenity || point.tags.shop, point.tags.amenity ? "amenity" : "shop");
            }            
        });
        if (uploadedMarkers && uploadedMarkers.length > 0) {
            uploadedMarkers.forEach(point => {
                if (!(point.id in osmMarkerHandler._markers)) {
                    osmMarkerHandler.addMarker(point, point.lng, point.lat, point.id, point.name, point.category, point.type);
                }
            });
        }
        for (var poi of poiStorage._pois) {
            uploadMarkerHandler.addMarker(poi, poi.lng, poi.lat, null, poi.name, poi.category, poi.type);
        }
        
        loadingOsmMarkers = false;
        if (!loadingFsMarkers) {
            $("#loading-icon").addClass("hidden");
            checkDuplicateMarkers();
        }
    });
}
function replaceAllIcons(uploadedMarkers) {
    if (!isBoundingBoxTooLarge()) {
        if (canLoadData) {
            canLoadData = false;
            getAndPlaceFoursquareIcons();
            getAndPlaceOSMIcons(uploadedMarkers);
            setTimeout(() => {
                canLoadData = true;
            }, 2000);
        }
    } else {
        notify(NOTIFICATIONS.INFO, "Please zoom in more");
    }
}
function showAddModal(e) {
    point = e.data.point;

    var defaultAmenity = "";
    var defaultShop = "";
    var category = (point.categories.length > 0 ? point.categories[0].name : null);
    if (category) {
        defaultAmenity = AMENITIES[AMENITIES.indexOf(category.toLowerCase())];
        defaultShop = SHOPS[SHOPS.indexOf(category.toLowerCase())];
    }
    if (defaultAmenity === undefined) {
        if  (category.includes("Restaurant") || category === "Noodle House" || category.includes("Pizza") || category.includes("BBQ") || category.includes("Snack") || category.includes("Friterie")) {
            defaultAmenity = "restaurant";
        } else if (category === "Coffee Shop" || category === "Café") {
            defaultAmenity = "cafe";
        } else if (category === "Dive Bar" || category === "Sake Bar" || category === "Beer Garden") {
            defaultAmenity = "bar";
        } else if (category.includes("Ice Cream")) {
            defaultAmenity = "ice_cream";
        }
    }
    if (defaultShop === undefined) {
        if (category.includes("Electronics")) {
            defaultShop = "electronics";
        } else if (category.includes("Cosmetics")) {
            defaultShop = "cosmetics";
        } else if (category.includes("Shoe")) {
            defaultShop = "shoes";
        } else if (category.includes("Mobile Phone")) {
            defaultShop = "mobile_phone";
        } else if (category.includes("Drugstore")) {
            defaultShop = "chemist";
        } else if (category.includes("Toy / Game Store")) {
            defaultShop = "games";
        } else if (category.includes("Bookstore")) {
            defaultShop = "books";
        } else if (category.includes("Miscellaneous")) {
            defaultShop = "variety_store";
        } else if (category.includes("Jewelry")) {
            defaultShop = "jewelry";
        } else if (category.includes("Boutique")) {
            defaultShop = "boutique";
        } else if (category.includes("Clothing")) {
            defaultShop = "clothes";
        } else if (category.includes("Sport")) {
            defaultShop = "sports";
        } else if (category.includes("Department")) {
            defaultShop = "department_store";
        }
    }

    addPlaceModal = new Modal("addplace")
        .addTextInput("Name", "name", "ex. \"Burger King\"", point.name)
        .addDropdown("Amenity", "amenity", AMENITIES, defaultAmenity === undefined ? null : defaultAmenity)
        .addText("Or", "txtor")
        .addDropdown("Shop", "shop", SHOPS, defaultShop === undefined ? null : defaultShop)
        .addTextIconInput("Location", "location", "eg 110.2345,56.5432", point.location.lng + "," + point.location.lat, "search", selectLocation)
        .addSubmitCancelButtons(submitAdd, cancelAdd);

    $(".mapboxgl-popup-close-button").click();
    selectLocation();
    notify(NOTIFICATIONS.INFO, "Please click on the map to select a location.");

    function selectLocation() {
        clickOverlay = true;
        addPlaceModal.hide();
        $(".mapboxgl-canvas").addClass("cursor-crosshair");
    }

    function submitAdd() {
        $("#addplace_amenity").removeAttr("style");
        $("#addplace_shop").removeAttr("style");

        var amenity = $("#" + addPlaceModal._id + "_amenity option:selected").text();
        var shop = $("#" + addPlaceModal._id + "_shop option:selected").text();

        var poiToAdd = {
            name: $("#" + addPlaceModal._id + "_name").val(),
            category: "",
            type: "",
            lng: $("#" + addPlaceModal._id + "_location").attr("value").split(",")[0], 
            lat: $("#" + addPlaceModal._id + "_location").attr("value").split(",")[1]
        };

        if (amenity === "-Select an option-" && shop === "-Select an option-") {
            $("#addplace_amenity").attr("style", "border-color: red;");
            $("#addplace_shop").attr("style", "border-color: red;");
            notify(NOTIFICATIONS.WARNING, "Please select either an amenity or shop.");
            return;
        } else if (amenity !== "-Select an option-" && shop !== "-Select an option-") {
            $("#addplace_amenity").attr("style", "border-color: red;");
            $("#addplace_shop").attr("style", "border-color: red;");
            notify(NOTIFICATIONS.WARNING, "Please select only an amenity or shop. Not both.");
            return;
        }

        if (amenity !== "-Select an option-") {
            poiToAdd.category = amenity;
            poiToAdd.type = "amenity";
        } else {
            poiToAdd.category = shop;
            poiToAdd.type = "shop";
        }
        
        uploadMarkerHandler.addMarker(poiToAdd, poiToAdd.lng, poiToAdd.lat, null, poiToAdd.name, poiToAdd.category, poiToAdd.type);
        osmRequestHandler.addPoi(poiToAdd);
        poiStorage.addPoi(poiToAdd);
        authControl.updateUploadCounter(osmRequestHandler._poisToAdd.length);
        osmRequestHandler.checkUserLoggedIn((res) => {
            if (res) {
                $("#btn-upload").removeClass("mapboxgl-custombtn-disabled");
                $("#btn-upload").addClass("mapboxgl-custombtn");
            }
        });
        addPlaceModal.destroy();
    }

    function cancelAdd() {
        addPlaceModal.destroy();
    }
}