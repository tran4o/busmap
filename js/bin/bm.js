#!/usr/bin/env node

var db=require("../cmd/db");
var cnv=require("../cmd/cnv");
var gen = require("../cmd/gen");
var init = require("../cmd/init");
var cleanup = require("../cmd/cleanup");
var log = require("../misc/log");
var cli = require("../misc/cli");
var http = require("../srv/http");
var gps = require("../srv/gps");

//process.chdir(__dirname+"/../../");

if (cli.args.length < 1) {
	console.error("Invalid usage. Use bm <COMMAND>!");  
	onDone(-1);
	return;
}
var cmd = cli.args.shift().toUpperCase();
switch (cmd) 
{
	case "GEN":
		gen.execute(cli.args,onDone);
		break;
	case "CLEANUP":
		cleanup.execute(cli.args,onDone);
		break;
	case "INIT":
		init.execute(cli.args,onDone);
		break;
	case "DB" :
		db.execute(cli.args,onDone);
		break;
	case "HTTP" :
		http.start(cli.args,onDone);
		break;
	case "GPS" :
		gps.start(cli.args,onDone);
		break;
	case "CNV" :
		cnv.execute(cli.args,onDone);
		break;
	default : 
		log.error("Invalid command "+cmd+"!");
		onDone(-1);
		break;
}
function onDone(statusCode) {
	process.exit(statusCode);
}
