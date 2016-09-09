var inst = require("../conf/installation");
var log = require("../misc/log");
var pg = require("pg");
var os = require("os");
pg.defaults.parseInt8=true;
pg.defaults.poolSize = os.cpus().length*2; // CPU*2
pg.defaults.poolIdleTimeout = 1000*60*8*2*100; // 1600 min
if (!inst.json || !inst.json.db) {
	log.error("Installation not configured! Please check content of installation.json!");
	process.exit(-1);
}

var options = inst.json.db;

exports.connectRoot = function(callback) {
	var conString = "postgres://"+options.username+":"+options.password+"@"+options.location+"/postgres";
	pg.connect(conString, callback);
};

exports.connect = function(callback) {
	var conString = "postgres://"+options.username+":"+options.password+"@"+options.location+"/BUSMAP";
	pg.connect(conString, callback);
};

// NO POOLING
exports.connectDirect = function(isReadonly,onDone) {
	if (typeof isReadonly == "function") {
		callback=isReadonly;
		isReadonly=false;
	}
	var conString = "postgres://"+options.username+":"+options.password+"@"+options.location+"/BUSMAP";
	var client = new pg.Client(conString);
	client.connect(function(err) 
	{
		if(err) {
			log.error('could not connect to postgres : '+err);
			return onDone(null,err);
	  	}
	  	if (!isReadonly)
	  		return onDone(client);
	  	sql='SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY';
	  	client.query(sql,function(err) 
	  	{
		  	if(err) {
		    	log.error('error running query for readonly transaction state : '+err);
		    	return onDone(null,err);
		    }
		  	onDone(client);
	  	});
	});
};
