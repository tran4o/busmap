var log = require("../misc/log");
var drv = require("../db/driver");
var inst = require("../conf/installation");
var fs = require("fs");
var path = require("path");

exports.execute = function(args,onDone) {

	if (args.length < 1) {
		log.error("Invalid usage. Use lr db <COMMAND>!");  
		onDone(-1);
		return;
	}
	var cmd = args.shift().toUpperCase();
	switch (cmd) 
	{
		case "CREATE" :
			execFile(inst.installDir+"/sql/create.sql",true,function(res) {
				if (res < 0)
					onDone(res);
				else
					execFile(inst.installDir+"/sql/init.sql",false,onDone);
			});
			break;
		case "DROP" :
			execFile(inst.installDir+"/sql/drop.sql",true,onDone);
			break;
		default : 
			log.error("Invalid command db "+cmd+"!");
			onDone(-1);
			break;
	}
};

function execFile(file,isRoot,onDone) {
	file = path.normalize(file);
	var sql;
	try {
		sql= fs.readFileSync(file)+"";
	} catch (e) {
		log.error("Unable to read file "+file+" : "+(e.trace || e));
		onDone(-1);
	}
	//---
	drv[isRoot ? "connectRoot" : "connect"](function(err,client,done) {
		if (err) {
			log.error("Error on executing "+file+" : "+err);
			 if (done)
				 done();
			onDone(-1);
			return;
		}
		client.query(sql, [], function(err, result) 
		{
			if (err) {
				log.error("Error executing SQL : "+err);
				log.error(sql);
				if (done) 
					done();
				onDone(-1);
				return;
			 }
			 if (done)
				 done();
			 onDone(0);
		 });
	});
}

