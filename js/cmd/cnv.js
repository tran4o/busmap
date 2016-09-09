var log = require("../misc/log");
var drv = require("../db/driver");
var inst = require("../conf/installation");
var fs = require("fs");
var path = require("path");
var gpx = require("../misc/gpx");
var moment = require("moment");

exports.execute = function(args,onDone) {

	if (args.length != 1) {
		log.error("Invalid usage. Use lr cnv <FILE.gpx>!");  
		onDone(-1);
		return;
	}	
	var e = args.shift();
	gpx.getGpxPointsFromFile(e,function(res) {
		if (res < 0)
			onDone(res);
		else {
			var data = 
			{
				"code" : "EVENT-"+(new Date()).getTime(), 
				"name" : path.basename(e).replace(".gpx",""),
				"begin" : moment.utc().format("DD.MM.YYYY 08:00:00"), 
				"end" : moment.utc().format("DD.MM.YYYY 11:00:00"), 
				"track" : "$$RMB"+JSON.stringify(res)+"$$RME",  
				"run-count" : 1,
				"bike-start" : 2,
				"run-start" : 6
			}
			var str = JSON.stringify(data,null,4).split('"$$RMB').join("").split('$$RME"').join("");
			console.log(str);
			onDone(0);
		}
	});
};

