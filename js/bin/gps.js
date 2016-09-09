#!/usr/bin/env nodemon

var log = require("../misc/log");
var cli = require("../misc/cli");
var gps = require("../srv/gps");
gps.start(cli.args,onDone);

function onDone(statusCode) {
	process.exit(statusCode);
}

