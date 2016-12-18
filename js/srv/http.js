var log = require("../misc/log");
var inst = require("../conf/installation.js");
var express = require('express');
var bodyParser = require('body-parser');
var path = require("path");
var fs = require("fs");
var os = require("os");
var basicAuth = require('basic-auth');
var events = require("../db/events");
var persons = require("../db/persons");
var authd = require("../misc/auth");
var moment = require("moment");
var mkdirp = require('mkdirp');
var LRU = require("lru-cache");
var gps = require("./gps");
var dstorage = require("../db/discreteStorage");
var dlocation = require("../db/discreteLocation");
var kml = require("./kml");

exports.start = function(args, onDone) {
    events.initTrackingStoredProcedure();
    log.logToFile("service");
    //-----------------------------------------------------------------------
    var tmpdir = os.tmpdir() + "/busmap";
    if (!fs.exists(tmpdir))
        mkdirp.sync(tmpdir);
    for (var file of fs.readdirSync(tmpdir))
        if (fs.statSync(tmpdir + "/" + file).isFile())
            fs.unlinkSync(tmpdir + "/" + file);
        //-----------------------------------------------------------------------
    var app = express();
    var server = require('http').Server(app);
    if (!inst || !inst.json || !inst.json.server || !inst.json.server.httpPort) {
        log.error("Installation not complete. Server part missing!");
        process.exit(-1);
        return;
    }
    //------------------------------------------------
    
    var httpProxy = require('http-proxy');
    var apiProxy = httpProxy.createProxyServer();
    var port = parseInt(inst.json.server.httpPort);
    app.use(require("compression")());
    app.use(bodyParser.json()); // for parsing application/json
    app.use(bodyParser.urlencoded({
        extended: true
    })); // for parsing application/x-www-form-urlencoded
    app.all("/weather/*", function(req, res) {
        apiProxy.web(req, res, {target: "http://forecast.io/"});
    });
    if (!port || isNaN(port))
        port = 8182;
    //------------------------------------------------
    var auth = function(req, res, next) {
        function unauthorized(res) {
            res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
            return res.sendStatus(401);
        };
        var user = basicAuth(req);
        if (!user || !user.name || !user.pass) {
            return unauthorized(res);
        };
        authd.loginUser(user.name, user.pass, function(res) {
            if (res && res.id)
                return next();
            else
                return unauthorized(res);
        });
    };
    //------------------------------------------------
    app.post("/recv", function(req, res, next) {
        res.set('Content-Type', 'application/json');
	console.log(req.body);
        if (!req.body)
            return res.send({
                err: "can not parse body!"
            });
        if (!req.body.imei)
            return res.send({
                err: "imei not in the json body!"
            });
        if (!req.body.t)
            return res.send({
                err: "t not in the json body!"
            });
        if (!req.body.lon)
            return res.send({
                err: "lon not in the json body!"
            });
        if (!req.body.lat)
            return res.send({
                err: "lat not in the json body!"
            });
        // { imei : "BUS0001",t : 12312312321 /* long time */, lon : 12.123, lat : 12.123, speed : 32.23 /*kmh*/ , radius : 60.23 /* meters * /,alt : 123.123 /meters*/,  }   
        var body = req.body;
        var pmsg = {
            imei: body.imei,
            packetType: 0,
            t: body.t,
            lon: body.lon,
            lat: body.lat,
            ls: 'g',
            sats: 0,
            hdop: body.radius || 1,
            /* meters GPS tollerance */
            direction: 0,
            speedInKmh: body.speed || 0,
            alt: body.alt || 0,
            /* ALT */
            gpsValid: true,
            gsmSignal: 1,
            ecallActive: false,
            battVolt: 0,
            battPercent: 0,
            chargerActive: true,
            isRace: true,
            uptimeSystem: 0,
            numberOfSteps: 0,
            pulsRate: 0,
            temperature: 0,
            transmissionIntervallRate: 0,
            isCheckGroup: true
        };
        gps.savePositionInDB(pmsg, function(result) {
            console.log(pmsg);
            res.send({
                ok: 1
            });
        });
    });

    app.get("/", function(req, res, next) {
        res.set('Content-Type', 'text/html');
        res.redirect("/www/event.html?event=0");
        return next();
    });
    app.get("/busmap.kml", function(req, res) {
        res.set('Content-Type', 'application/vnd.google-earth.kml+xml');
        res.setHeader('Content-disposition', 'attachment; filename=busmap-' + moment().format("YYYY-MM-DD HHmmss") + '.kml');
        var ids = req.query.ids.split(",");
        for (var i = 0; i < ids.length; i++)
            ids[i] = parseInt(ids[i]);
        var eid = parseInt(req.query.eid);
        var t = parseInt(req.query.t);
        var dur = parseInt(req.query.dur);
        kml.getData(eid, ids, t, dur, res);
    });
    //------------------------------------------------
    app.get("/list-img.json", function(req, res) {
        res.set('Content-Type', 'application/json');
        try {
            var files = fs.readdirSync(inst.installDir + "/www/img");
            res.send(JSON.stringify(files));
        } catch (e) {
            log.error("Error listing img/* : " + e);
            return res.sendStatus(404);
        }
    });
    app.get("/list-img.json", function(req, res) {
        res.set('Content-Type', 'application/json');
        try {
            var files = fs.readdirSync(inst.installDir + "/www/img");
            res.send(JSON.stringify(files));
        } catch (e) {
            log.error("Error listing img/* : " + e);
            return res.sendStatus(404);
        }
    });

    //------------------------------------------------
    app.use('/personImages/', express.static(inst.installDir + '/tmp/person'));
    app.use('/www', express.static(inst.installDir + '/www/'));
    app.use('/img', express.static(inst.installDir + '/www/img'));
    app.get("/api/busmap.js", function(req, res) {
        try {
            res.set('Content-Type', 'application/json');
            res.sendFile(inst.installDir + "/tmp/t1.js");
        } catch (e) {
            res.send("Error generating busmap.js : " + e);
        }
    });
    app.get("/api/ui.js", function(req, res) {
        try {
            res.set('Content-Type', 'application/json');
            res.sendFile(inst.installDir + "/tmp/t2.js");
        } catch (e) {
            res.send("Error generating ui.js : " + e);
        }
    });
    //------------------------------------------------
    var io = require('socket.io')(server);
    var ss = require('socket.io-stream');
    //------------------------------------------------
    var seq = 0;
    io.on('connection', function(socket) {
        socket.seq = seq++;
        socket.on('disconnect', function() {
            events.unregisterUpdateHandler(socket.seq);
            persons.unregisterUpdateHandler(socket.seq);
        });
        events.registerUpdateHandler(socket.seq, function(event) {
            socket.emit("onUpdateEvent", event);
        });
        persons.registerUpdateHandler(socket.seq, function(person) {
            socket.emit("onUpdatePerson", person);
        });
        var auth = null;
        socket.on("login", function(data) {
            authd.loginUser(data.username, data.password, function(res) {
                if (res && res.id)
                    socket.emit(data.__code, auth = fixPerson(res));
                else
                    socket.emit(data.__code, {});
            });
        });
        //--------------------------------------------------
        /*socket.on("getEventFullParticipantsInfo",function(data) {
        	events.getFullParticipantsInfo(auth,data.id,function(res) {
        		socket.emit(data.__code,res);
        	});
        });*/
        socket.on("setGroupTimes", function(data) {
            events.setGroupTimes(auth, data, function(res) {
                socket.emit(data.__code, res);
            });
        });
        socket.on("getEventById", function(data) {
            events.getEventById(auth, data.id, function(res) {
                res = fixEvent(res);
                socket.emit(data.__code, res);
            });
        });
        socket.on("getEventByCode", function(data) {
            events.getEventByCode(auth, data.code, function(res) {
                res = fixEvent(res);
                socket.emit(data.__code, res);
            });
        });
        socket.on("updateEvent", function(event) {
            if (event.beginTime)
                event.beginTime = new Date(event.beginTime);
            if (event.endTime)
                event.endTime = new Date(event.endTime);
            if (event.owner)
                event.owner = {
                    id: event.owner
                };
            events.updateEvent(auth, event, function(res) {
                res = fixEvent(res);
                socket.emit(event.__code, res);
            });
        });
        socket.on("createEvent", function(event) {
            if (event.beginTime)
                event.beginTime = new Date(event.beginTime);
            if (event.endTime)
                event.endTime = new Date(event.endTime);
            events.createEvent(auth, event, function(res) {
                res = fixEvent(res);
                socket.emit(event.__code, res);
            });
        });
        socket.on("deleteEvent", function(event) {
            events.deleteEvent(auth, event, function(res) {
                socket.emit(event.__code, res);
            });
        });
        socket.on("listEventIds", function(data) {
            events.listEventIds(auth, data, function(res) {
                socket.emit(data.__code, res);
            });
        });
        socket.on("getEventElapsed", function(data) {
            events.getEventElapsed(auth, data.event, function(res) {
                socket.emit(data.__code, res);
            });
        });

        //--------------------------------------------------
        socket.on("getPersonById", function(data) {
            persons.getPersonById(auth, data.id, function(res) {
                res = fixPerson(res);
                socket.emit(data.__code, res);
            });
        });
        socket.on("getPersonByUsername", function(data) {
            persons.getPersonByUsername(auth, data.username, function(res) {
                res = fixPerson(res);
                socket.emit(data.__code, res);
            });
        });

        socket.on("getPersonByIdWithEventDetails", function(data) {
            persons.getPersonByIdWithEventDetails(auth, data.id, data.event, function(res) {
                res = fixPerson(res);
                socket.emit(data.__code, res);
            });
        });
        socket.on("getPersonByCode", function(data) {
            persons.getPersonByCode(auth, data.code, function(res) {
                res = fixPerson(res);
                socket.emit(data.__code, res);
            });
        });
        socket.on("updatePerson", function(person) {
            persons.updatePerson(auth, person, function(res) {
                res = fixPerson(res);
                socket.emit(person.__code, res);
            });
        });
        socket.on("createPerson", function(person) {
            persons.createPerson(auth, person, function(res) {
                res = fixPerson(res);
                socket.emit(person.__code, res);
            });
        });
        socket.on("deletePerson", function(person) {
            persons.deletePerson(auth, person, function(res) {
                res = fixPerson(res);
                socket.emit(person.__code, res);
            });
        });
        socket.on("listPersonIds", function(data) {
            persons.listPersonIds(auth, function(res) {
                socket.emit(data.__code, res);
            });
        });
        socket.on("listPersonIdsOrderBy", function(data) {
            persons.listPersonIdsOrderBy(auth, data, function(res) {
                socket.emit(data.__code, res);
            });
        });
        socket.on("listGroupsOrderBy", function(data) {
            events.listGroupsOrderBy(auth, data, function(res) {
                socket.emit(data.__code, res);
            });
        });

        socket.on("getInvitations", function(data) {
            persons.getInvitations(auth, function(res) {
                socket.emit(data.__code, res);
            });
        });
        socket.on("listClubs", function(data) {
            persons.listClubs(auth, data, function(res) {
                socket.emit(data.__code, res);
            });
        });
        socket.on("shareLocation", function(share) {
            persons.shareLocation(auth, share, function(res) {
                socket.emit(share.__code, res);
            });
        });
        socket.on("setLocationVisibility", function(data) {
            persons.setLocationVisibility(auth, data, function(res) {
                socket.emit(data.__code, res);
            });
        });
        socket.on("setEventParticipant", function(data) {
            events.setEventParticipant(auth, data, function(res) {
                socket.emit(data.__code, res);
            });
        });
        socket.on("acceptInvitation", function(data) {
            persons.acceptInvitation(auth, data, function(res) {
                socket.emit(data.__code, res);
            });
        });
        socket.on("removeInvitation", function(data) {
            persons.removeInvitation(auth, data, function(res) {
                socket.emit(data.__code, res);
            });
        });
        socket.on("setEventFavorite", function(data) {
            events.setFavorite(auth, data, function(res) {
                socket.emit(data.__code, res);
            });
        });
        socket.on("listMissingPersons", function(data) {
            persons.listMissingPersons(auth, function(res) {
                socket.emit(data.__code, res);
            });
        });
        socket.on("getGPSLocationName", function(data) {
            getGPSLocationName(data, function(res) {
                socket.emit(data.__code, res);
            });
        });
        socket.on("uploadGPXPositions", function(data) {
            gps.uploadGPXPositions(auth, data.data, function(res) {
                socket.emit(data.__code, res);
            });
        });
        socket.on("getDiscreteChunk", function(data) {
            dstorage.getChunk(auth, data.event, data.person, data.level, data.chunk, function(res) {
                socket.emit(data.__code, res);
            });
        });
        socket.on("getLocationPage", function(data) {
            dlocation.getPage(auth, data, function(res) {
                socket.emit(data.__code, res);
            });
        });
        socket.on("getPersonPath", function(data) {
            persons.getPersonPath(auth, data, function(res) {
                socket.emit(data.__code, res);
            });
        });
        //--------------------------------------------------
    });
    //---------------------
    persons.basicLoadPersons(function() {
        server.listen(port);
        log.info("Started server on http port " + port);
        // START DAILY EVENT CLONE 
        gps.resetDailyEventOldStateCache();
    });
};

function fixEvent(event) {
    var res = {};
    for (var k in event) res[k] = event[k];
    if (res.beginTime)
        res.beginTime = res.beginTime.getTime();
    if (res.endTime)
        res.endTime = res.endTime.getTime();
    return res;
}

function fixPerson(person) {
    var res = {};
    for (var k in person) res[k] = person[k];
    if (person.birthDate)
        res.birthDate = person.birthDate.getTime();
    return res;
}
//---------------------------------------------
var locQueue = [];
var locWorking = false;
var locCache = LRU({
    max: 5000
}); // TODO ADD OPTION in installation.xconf

function getGPSLocationName(data, onDone) {
    if (!data.lon || !data.lat)
        return onDone(({
            imei: data.imei,
            txt: 'Unknown location'
        }));

    var key = data.lon + " " + data.lat;
    var t = locCache.get(key);
    if (t) {
        return onDone(t);
    }
    var geocoderProvider = 'teleport';
    var httpAdapter = 'http';
    var extra = {};
    var geocoder = require('node-geocoder')(geocoderProvider, httpAdapter, extra);
    geocoder.reverse({
        lat: data.lat,
        lon: data.lon
    }, function(err, res) {
        if (err) {
            log.erro("Error on reverse geocoder : " + err);
            onDone(({
                imei: data.imei,
                txt: 'Unknown location'
            }));
            return;
        }
        var dres;
        if (res && res.length)
            for (var e of res) {
                var arr = [];
                if (e.state)
                    arr.push(e.state);
                if (e.country)
                    arr.push(e.country);
                var pfx = "";
                if (e.city)
                    pfx = e.city + ", ";
                if (arr.length && e.extra) {
                    if (!isNaN(e.extra.distance_km))
                        dres = ({
                            imei: data.imei,
                            txt: (Math.round(parseFloat(e.extra.distance_km) * 100) / 100.0) + "km from " + pfx + arr.join(" ")
                        });
                    else
                        dres = ({
                            imei: data.imei,
                            txt: pfx + arr.join(" ")
                        });
                    break;
                }
            }
        if (!dres)
            dres = ({
                imei: data.imei,
                txt: 'Unknown location'
            });
        locCache.set(key, dres);
        onDone(dres);
    });
}
