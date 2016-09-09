#!/usr/bin/env nodemon

var log = require("../misc/log");
var cli = require("../misc/cli");
var http = require("../srv/http");

http.start(cli.args,onDone);
function onDone(statusCode) {
	process.exit(statusCode);
}

