#!/usr/bin/env node

var log=require("../misc/log");
var fs=require("fs");
var inst = require("../conf/installation.js");
var mkdirp = require('mkdirp');
mkdirp.sync(inst.installDir+"/tmp");
var browserify = require('browserify');
var watchify = require('watchify');

var b1 = browserify({
  debug: true,
  entries: [inst.installDir+"/js/api/busmap.js"],
  cache: {},
  packageCache: {},
  plugin: [watchify]
});
//b1.plugin('minifyify', {output: inst.installDir+"/tmp/t1.js.dbg",map: inst.installDir+"/tmp/t1.js.map"});
b1.on('update', bundle1);
bundle1();
var b2 = browserify({
	debug: true,
	entries: [inst.installDir+"/js/ui/UI.js"],
	cache: {},
	packageCache: {},
	plugin: [watchify]
});
b2.on('update', bundle2);
//b2.plugin('minifyify', {output: inst.installDir+"/tmp/t2.js.dbg",map: inst.installDir+"/tmp/t2.js.map"});
bundle2();
function bundle1() {
	try {
		console.log("Bundle "+inst.installDir+"/js/api/busmap.js"+" to "+inst.installDir+"/tmp/t1.js");
		b1.bundle().pipe(fs.createWriteStream(inst.installDir+"/tmp/t1.js"));
	} catch (e) {
		log.error("OPS!");
	}
}
function bundle2() {
	try {
		console.log("Bundle "+inst.installDir+"/js/ui/UI.js"+" to "+inst.installDir+"/tmp/t2.js");
		b2.bundle().pipe(fs.createWriteStream(inst.installDir+"/tmp/t2.js"));
	} catch (e) {
		log.error("OPS!");
	}
}
