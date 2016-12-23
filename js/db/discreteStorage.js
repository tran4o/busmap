var log = require("../misc/log");
var inst = require("../conf/installation").json;
var moment = require("moment");
var driver = require("../db/driver");
var consts = require("../conf/constants");
var discrete = require("../misc/discrete");

var maxChunks = 1000;
if (inst && inst.limits && inst.limits.memoryCache && inst.limits.memoryCache.maxChunks > 0) {
	maxChunks=inst.limits.memoryCache.maxChunks;
} else {
	log.warn("discreteStogate : Installation does not specify limits.memoryCache.maxChunks. Using default "+maxChunks);
}
//---------------------------------------------------
var liveChunkTimeout = 5;
if (inst && inst.limits && inst.limits.memoryCache && inst.limits.memoryCache && inst.limits.memoryCache.liveChunkTimeout > 0) {
	liveChunkTimeout=inst.limits.memoryCache.liveChunkTimeout;
} else {
	log.warn("discreteStorage : Installation does not specify inst.limits.memoryCache.liveChunkTimeout. Using default "+liveChunkTimeout);
}
liveChunkTimeout*=1000; // seconds > milliseconds
//---------------------------------------------------
var LRU = require("lru-cache");
var options = { max: maxChunks };
var cache = LRU(options);
var queuePerPerson = {};
var personTimestamps = {};

function clearCacheByPrefix(prefix) {
	var toDel=[];
	cache.forEach(function(value,key) {
		if (!prefix || key.startsWith(prefix))
			toDel.push(key);
	});
	for (var e of toDel) {
		cache.del(e);
	}
}

exports.getChunk = function(auth,event,person,level,chunk,onDone) 
{
	var intv = discrete.chunkToInterval(chunk,level);
	if (!intv  || !intv.isValid) {
		onDone({});
		return;
	}
	var key = person+"-"+level+"-"+chunk;
	var ctime = (new Date()).getTime();
		
	var r = cache.get(key);
	function checkItem(r) {
		var ptsmp = personTimestamps[person] || 0;
		if (r.personTimestamp == ptsmp) 
		{
			if (!r.liveTimestamp || r.liveTimestamp >= ctime) {
				return r;
			} else if (r.liveTimestamp) {
				//console.log("TIME OUT LIVE CHUNK DISCRETE STORAGE : "+key);
				cache.del(key); // timeout out
			}
		} else {
			cache.del(key); // person updated, not valid
		}
		return null;
	}
	if (r) 
	{
		r=checkItem(r);
		if (r) 
			return onDone(r);
	}
	// serialize access to postgre 
	var g = queuePerPerson[person];
	if (!g) {
		g={queue:[],processing:false};
		queuePerPerson[person]=g;
	}
	g.queue.push({event:event,level:level,chunk:chunk,onDone:onDone,intv : intv});
	if (!g.processing) 
		one(g);
	function one(g) 
	{
		var el = g.queue.shift();
		if (!el) {
			delete queuePerPerson[person];
			return;
		}
		g.processing=true;
		var event = el.event;
		var level = el.level;
		var chunk = el.chunk;
		var onDone = el.onDone;
		var intv = el.intv;
		var key = person+"-"+level+"-"+chunk;
		var r = cache.get(key);
		if (r) 
		{
			r=checkItem(r);
			if (r) 
				return onOneDone(g,r);
		}
		var dbcon = driver.connect(function(err,pgclient,done) 
		{
			if (err) 
			{
				log.error("Error on connecting to postgresql  : "+err);
				if (done)
					done();
				onOneDone(g,-1);
				return;
			}
			if (intv.isLive) {
				//console.log("LIVE "+new Date(intv.min)+" | "+new Date(intv.max)+" | "+level);
				var gt = new Date().getTime();
				getDataDirect(event,person,intv,level,function(res) {
					if (done)
						done();
					if (res < 0) {
						onOneDone(g,-1);
					} else {
						res.personTimestamp=personTimestamps[person] || 0;
						res.liveTimestamp=gt+liveChunkTimeout;
						cache.set(key,res);
						onOneDone(g,res);
					}
				});
				return;
			}
			var args = [Math.abs(person),person < 0 ? -1 : level,chunk];
			if (event)
				args.push(event);
			pgclient.query('SELECT data FROM tracking.discrete_position WHERE person = $1 AND level = $2 AND chunk = $3'+(event ? ' AND event=$4' : ' AND event IS NULL'),
				args, 					 
				function(err, result) {
				  if (done)
					  done();
				    if(err) {
				      log.error('Error selecting from discrete_position in POSTGRE : '+err);
					  onOneDone(g,-1);
				      return;
				    }
					if (result && result.rows && result.rows.length == 1) {
						var res = result.rows[0].data;
						if (typeof res == "string")
							res = JSON.parse(res);
						res.personTimestamp=personTimestamps[person] || 0;
						cache.set(key,res);
						onOneDone(g,res);
					} else {
						getDataDirect(event,person,intv,level,function(res) {
							if (done)
								done();
							if (res < 0) {
								onOneDone(g,-1);
							} else {
								res.personTimestamp=personTimestamps[person] || 0;
								var fok=[JSON.stringify(res),Math.abs(person),person < 0 ? -1 : level,chunk,event];
								cache.set(key,res);
								pgclient.query('INSERT INTO tracking.discrete_position (data,person,level,chunk,event) VALUES ($1,$2,$3,$4,$5)',fok, 					 
										function(err, result) {
									if (done)
										done();
								    if(err) {
								    	log.error('Error saving discrete_position data in POSTGRE : '+err);
										onOneDone(g,-1);
									    return;
								    }
									onOneDone(g,res);
								});
							}
						});
					}
			  });
		});
		function onOneDone(g,res) 
		{
			el.onDone(res);
			g.processing=false;
			one(g);
		}
	}
};

//[cnunkMinInclusive,chunkMaxInclusive]
exports.clearChunks = function(person,level,chunkMin,chunkMax,onDone) 
{	
	exports.clearCacheByPrefix(person+"-");
	var dbcon = driver.connect(function(err,pgclient,done) 
	{
		if (err) 
		{
			log.error("Error on connecting to postgresql  : "+err);
			if (done)
				done();
			onDone(-1);
			return;
		}
		pgclient.query('DELETE FROM tracking.discrete_position WHERE person = $1 AND level = $2 AND chunk >= $3 AND chunk <= $4',[person,level,chunkMin,chunkMax],function(err, result) 
		{
			if (done)
				done();
		    if(err) 
		    {
		    	log.error('Error deleting from discrete_position in POSTGRE : '+err);
		    	onDone(-1);
		    	return;
		    }
		    onDone(0);
		});
	});
};

function getDataDirect(event,person,intv,level,onDone) 
{
	var dbcon = driver.connect(function(err,pgclient,done) 
	{
		if (err) 
		{
			log.error("Error on connecting to postgresql  : "+err);
			if (done)
				done();
			onDone(-1);
			return;
		}
		var dofs = Math.round((intv.min-consts.timeOrigin)/(1000*consts.locationStep));		
		if (person < 0) 
		{
			var dofse = Math.round((intv.max-consts.timeOrigin)/(1000*consts.locationStep));
			// SPECIAL CASE DIRECT FROM SOFTSTORAGE
			// TODO RANK
			var ew="";
			if (event) {
				ew=" AND event = "+parseInt(event);
			}
			var sql = "SELECT 0 as rank, elapsed,ST_X("+(event ? "tpos" : "pos")+") AS lon,ST_Y("+(event ? "tpos" : "pos")+") AS lat,ST_X(pos) as glon,ST_Y(pos) as glat,avail,hdop,i*"+consts.locationStep*1000+"+"+consts.timeOrigin+" AS t,person,i,speed_in_kmh,speed_in_kmh_average FROM tracking.position_soft WHERE i >= $1 AND i < $2 AND person = $3 "+ew+" ORDER BY i";
			var args=[dofs,dofse,-person];
			pgclient.query(sql,args,function(err, result) {
				if (done)
					done();
				if(err) {
					log.error('Error selecting from position_soft (discreteStorage) in POSTGRE : ',err);
					console.log(sql);
					onDone(-1);
					return;
				}
				var res=[];
				for (var e of result.rows) 
				{
					var r={i:e.i,t:e.t};
					if (e.lat)
						r.lat=e.lat;
					if (e.lon)
						r.lon=e.lon;
					if (e.glat)
						r.glat=e.glat;
					if (e.glon)
						r.glon=e.glon;
					if (e.rnk > 0)
						r.rank=e.rnk;
					if (e.elapsed)
						r.elapsed=e.elapsed;
					if (e.avail)
						r.avail=e.avail;						
					if (e.hdop != undefined)
						r.hdop=e.hdop;
					if (e.speed_in_kmh != undefined)
						r.speedInKmh=e.speed_in_kmh;
					if (e.speed_in_kmh_average != undefined)
						r.speedInKmhAverage=e.speed_in_kmh_average;
					res.push(r);
				}
				onDone(res);
			});
			return;
		}
		//------------------------------------------------------------------------------------------------------
		var psql="WITH ";
		var isql="SELECT * FROM F ";
		var lvl = (1 << level); 
		if (event) 
		{
			/* ALL PRO PARTICIPANTS */ 
			psql="WITH PS AS ( SELECT persons.id,event_participant.start_group AS start_group,persons.gender FROM tracking.persons JOIN tracking.event_participant ON event_participant.joined AND event_participant.participant = persons.id AND event_participant.event = $7 WHERE persons.type = 'PRO' )";
			/* DISTINCT discrete index where data available */ 
			psql+=",NT AS ( SELECT i,person,elapsed,speed_in_kmh,PS.start_group,PS.gender FROM tracking.position_soft JOIN PS ON person = ps.id AND event = $7 AND i >= $5 AND i < $6) ";
			psql+=",W AS ( SELECT *" +
					",rank() OVER (PARTITION BY i ORDER BY elapsed DESC,speed_in_kmh DESC,person) AS ovrrnk," +
					"rank() OVER (PARTITION BY i,start_group ORDER BY elapsed DESC,speed_in_kmh DESC,person) AS grprnk, " +
					"rank() OVER (PARTITION BY i,gender ORDER BY elapsed DESC,speed_in_kmh DESC,person) AS genrnk " +
					" FROM NT WHERE elapsed > 0 ),";
			isql=",PF AS ( SELECT F.*,W.ovrrnk,NOVR.elapsed AS neovr,W.grprnk,NGRP.elapsed AS negrp,W.genrnk,NGEN.elapsed AS negen FROM F " +
					"\n LEFT JOIN W ON (W.person = $1 AND W.i = F.i*"+lvl+"+"+dofs+") "+
					"\n LEFT JOIN W AS NGEN ON NGEN.i = W.i AND NGEN.genrnk = W.genrnk-1 "+
					"\n LEFT JOIN W AS NGRP ON NGRP.i = W.i AND NGRP.grprnk = W.grprnk-1 "+
					"\n LEFT JOIN W AS NOVR ON NOVR.i = W.i AND NOVR.ovrrnk = W.ovrrnk-1 "+
	  		  	") SELECT * FROM PF";
		}		
		var sql=psql+
		' X AS ( SELECT Y.*,floor((t - $2) / $4::real)::BIGINT AS i FROM tracking.position AS Y WHERE Y.person=$1 AND Y.t >= $2 AND Y.t < $3)\n '+
		',F AS (SELECT X.i AS i,MAX(position_soft.elapsed) AS elapsed,AVG(position_soft.avail) AS avail,'+
			  'COUNT(X.id) AS cnt,'+
			  'MIN(X.grp) AS grp,'+
			  'AVG(X.gsm_signal) AS gsm_signal,'+
			  'AVG(X.lon) AS lon,'+
			  'AVG(X.lat) AS lat,'+
			  'AVG(X.direction) AS direction,'+
			  'AVG(X.alt) AS alt,'+
			  "BOOL_OR(X.is_race) AS is_race,"+ 
			  'AVG(X.gps_valid::integer) AS gps_valid,'+
			  'BOOL_OR(X.ecall_active) AS ecall_active,'+
			  'BOOL_OR(X.charger_active) AS charger_active,'+
			  'MIN(X.packet_type) AS min_packet_type,'+
			  'MAX(X.packet_type) AS max_packet_type,'+
			  'MIN(X.location_sensor) AS min_location_sensor,'+
			  'MAX(X.location_sensor) AS max_location_sensor,'+
			  'SUM(X.sats)::BIGINT AS sats,'+
			  'AVG(X.hdop) AS hdop,'+
			  'AVG(X.speed_in_kmh) AS speed_in_kmh,'+
			  'AVG(X.speed_in_kmh_average) AS speed_in_kmh_average,'+
			  'AVG(X.batt_volt) AS batt_volt,'+
			  'AVG(X.batt_percent) AS batt_percent,'+
			  'AVG(X.temperature) AS temperature,'+
			  'AVG(X.puls_rate) AS puls_rate,'+
			  "AVG(X.uptime_system) AS uptime_system FROM X LEFT JOIN tracking.position_soft ON position_soft.i >= X.i*"+lvl+"+"+dofs+" AND position_soft.i < (X.i+1)*"+lvl+"+"+dofs+" GROUP BY X.i ORDER BY X.i) "+isql;
		var args=[person,intv.min,intv.max,consts.resolutions[level]*1000];
		if (event) {
			args.push(Math.round((intv.min-consts.timeOrigin)/(consts.locationStep*1000))); /* 5 */
			args.push(Math.round((intv.max-consts.timeOrigin)/(consts.locationStep*1000))); /* 6 */
		}
		if (event)
			args.push(event);	// 7		
		function lsql() 
		{
			var s=sql;
			for (var i=args.length-1;i>=0;i--) {
				var val = args[i];
				var k="$"+(i+1);
				s=s.split(k).join(val);
			}
			console.log(s+"\n\n");
		}
		pgclient.query(sql,args,
			function(err, result) {
				if(err) {
			      log.error('Error selecting from discrete_position in POSTGRE : ',err);
				  lsql();
				  if (done)
					  done();
				  onDone(-1);
			      return;
			    }
				if (done)
					done();
				if (result && result.rows && result.rows.length) 
				{
					//lsql();
					var res=[];
					for (var e of result.rows) 
					{
						var r={i:e.i,grp:e.grp};
						if (e.temperature != undefined)
							r.temperature=e.temperature;
						if (e.direction != undefined)
							r.direction=e.direction;
						if (e.transmission_intervall_rate != undefined)
							r.transmissionIntervallRate=e.direction;							
						if (e.puls_rate != undefined)
							r.pulsRate=e.puls_rate;
						if (e.gsm_signal != undefined)
							r.gsmSignal=e.gsm_signal;
						if (e.min_packet_type && e.min_packet_type == e.max_packet_type)
							r.packetType=e.min_packet_type;
						if (e.min_location_sensor && e.min_location_sensor == e.max_location_sensor)
							r.locationSensor=e.min_location_sensor;
						if (e.lat)
							r.lat=e.lat;
						if (e.lon)
							r.lon=e.lon;
						if (e.ovrrnk > 0)
							r.ovrrank=e.ovrrnk;
						if (e.genrnk > 0)
							r.genrank=e.genrnk;
						if (e.grprnk > 0)
							r.grprank=e.grprnk;
						if (e.alt != undefined)
							r.alt=e.alt;
						if (e.elapsed)
							r.elapsed=e.elapsed;
						if (e.nelapsed)
							r.nelapsed=e.nelapsed;						
						if (e.avail)
							r.avail=e.avail;						
						if (e.ecall_active != undefined)
							r.ecallActive=e.ecall_active;
						if (e.is_race != undefined)
							r.isRace=e.is_race;
						if (e.gps_valid != undefined)
							r.gpsValid=e.gps_valid;						
						if (e.charger_active != undefined)
							r.chargerActive=e.charger_active;
						if (e.sats != undefined)
							r.sats=e.sats;
						if (e.speed_in_kmh != undefined)
							r.speedInKmh=e.speed_in_kmh;
						if (e.speed_in_kmh_average != undefined)
							r.speedInKmhAverage=e.speed_in_kmh_average;
						if (e.batt_volt != undefined)
							r.battVolt=e.batt_volt;
						if (e.batt_percent != undefined)
							r.battPercent=e.batt_percent;
						if (e.uptime_system != undefined)
							r.uptimeSystem=e.uptime_system;
						if (e.hdop != undefined)
							r.hdop=e.hdop;
						res.push(r);
					}
					onDone(res);
				} else {
					var res=[];
					onDone(res);
				}
		  });
	});
}

exports.reset = function(onDone) {
	exports.clearCaches();
	var dbcon = driver.connect(function(err,pgclient,done) 
	{
		if (err) 
		{
			log.error("Error on connecting to postgresql  : "+err);
			if (done)
				done();
			if (onDone)
				onDone(-1);
			return;
		}
		pgclient.query('DELETE FROM tracking.discrete_position',[],function(err, result) 
		{
			if (done)
				done();
		    if(err) 
		    {
		    	log.error('Error deleting from discrete_location in POSTGRE : '+err);
		    	if (onDone)
					onDone(-1);
		    	return;
		    }
		    if (onDone)
				onDone(0);
		});
	});
};

exports.clearCaches = function() {
	clearCacheByPrefix();
};
