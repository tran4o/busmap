var log = require("../misc/log");
var dlocation = require("../db/discreteLocation");
var dstorage = require("../db/discreteStorage");

exports.execute = function(args,onDone) {

	console.log("CLEANUP DISCRETE STORAGE (TODO ADD CLI OPTIONS!)");
	dlocation.reset(function() {
		dstorage.reset(onDone);
	});
};

