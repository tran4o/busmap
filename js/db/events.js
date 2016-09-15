var gps = require("../srv/gps");
var log = require("../misc/log");
var inst = require("../conf/installation");
var driver = require("./driver");
var authd = require("../misc/auth");
var persons = require("./persons");
var consts = require("../conf/constants");
var moment = require("moment");
var WGS84SPHERE = require("../ui/Utils").WGS84SPHERE;
var dlocation = require("./discreteLocation");
var dstorage = require("./discreteStorage");

var enableTrackingLog = true;//true;
var maxEvents = 1000;
if (inst.json && inst.json.limits && inst.json.limits.memoryCache && inst.json.limits.memoryCache.maxEvents > 0) {
	maxEvents=inst.json.limits.memoryCache.maxEvents;
} else {
	log.warn("Installation does not specify limits.memoryCache.maxEvents. Using default "+maxEvents);
}
//---------------------------------------------------
var LRU = require("lru-cache");
var options = { max: maxEvents };
var cache = LRU(options);
var updateHandlers = {};

exports.registerUpdateHandler = function(key,handler) {
	updateHandlers[key]=handler;
};
exports.unregisterUpdateHandler = function(key) {
	delete updateHandlers[key];
};

exports.getEventByCode = function(auth,code,onDone) {
	if (!auth || auth.userGroup != 1) {
		exports.getEventByCode(authd.admin,code,function(res) {
			if (res && res.id && (!res.owner || !res.owner.id || (auth && auth.id == res.owner.id))) 
				onDone(res);
			else 
				onDone(-1);
		});
		return;
	}
	getEventByQuery(auth,"code=$1",[code],function (res) {
		if (res && res.id)
			cache.set(res.id,res);
		onDone(res);
	});
};

exports.cloneEvent = function(id,code,beginDate,endDate,onDone) 
{
	// $1 = id , $2 = code , $3 = begin_time, $4 = end_time
	var sql = "INSERT INTO tracking.events "+
			  "(code,name,bike_start,run_start,start_elapsed,start_lon,start_lat,bike_start_elapsed,run_start_elapsed,track_length,swim_count,bike_count,run_count,is_public,begin_time,end_time,pois,track,owner) "+
			  "SELECT $2,name,bike_start,run_start,start_elapsed,start_lon,start_lat,bike_start_elapsed,run_start_elapsed,track_length,swim_count,bike_count,run_count,is_public,$3,$4,pois,track,owner FROM TRACKING.events WHERE id=$1 RETURNING id";  
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
		// EVENT 
		pgclient.query(sql,[id,code,beginDate,endDate],function(err, result) {
		    if(err) {
		      log.error('Error cloning event in POSTGRE : ',err);
			  if (done)
				  done();
			  onDone(-1);
		      return;
		    }
			if (done)
				done();
			var nid = result.rows[0].id;
			// event_elapsed
			sql = "INSERT INTO tracking.event_elapsed "+
			  "(geom_event,pos,elapsed) "+
			  "SELECT ST_MAKEPOINT($2,$2) AS geom_event,pos,elapsed FROM tracking.event_elapsed WHERE geom_event = ST_MAKEPOINT($1,$1)";			
			pgclient.query(sql,[id,nid],function(err, result) {
			    if(err) {
			      log.error('Error cloning event in POSTGRE : ',err);
				  if (done)
					  done();
				  onDone(-1);
			      return;
			    }
				if (done)
					done();
				sql = "INSERT INTO tracking.event_participant "+
				  "(event,participant,start_pos,start_group,start_time,end_time,invitation,json,joined) "+
				  "SELECT $2 AS event,participant,start_pos,start_group,start_time,end_time,invitation,json,joined FROM tracking.event_participant WHERE event = $1";			
				pgclient.query(sql,[id,nid],function(err, result) {
				    if(err) {
				      log.error('Error cloning event in POSTGRE : ',err);
					  if (done)
						  done();
					  onDone(-1);
				      return;
				    }
					if (done)
						done();
					onDone();
				});
			});			
			// event_elapsed OK 
			// event_participant OK 
			// event_participant_hidden TODO!!!
			// event_favorite TODO!!!
		});
	});
};

exports.getDailyEvents  = function(onDone) 
{
	var sql = "SELECT * from tracking.events WHERE code LIKE '%.%.%' ORDER BY id"; 
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
		pgclient.query(sql,[],function(err, result) {
		    if(err) {
		      log.error('Error selecting event by query in POSTGRE : ',err);
			  if (done)
				  done();
			  onDone(-1);
		      return;
		    }
			if (done)
				done();
			if (result && result.rows) 
			{
				for (var i=0;i<result.rows.length;i++) {
					delete result.rows[i].owner;
					parseEvent(authd.admin,result.rows[i]);
				}
				onDone(result.rows);
			} else {
				onDone({});
			}
		});
	});
};


exports.getEventById = function(auth,id,onDone) {
	var res = cache.get(id);
	if (res) { 
		onDone(res);
	} else
		getEventByQuery(auth,"id=$1",[id],function(res) {
			onDone(res);
		});
};

exports.updateEvent = function(auth,event,onDone) {
	if (!auth || auth.userGroup != 1) {
		if (!auth)
			onDone(-1);
		else
		exports.getEventById(authd.admin,event.id,function(res) {
			if (res && res.id && auth.id == res.owner.id) {
				exports.updateEvent(authd.admin,event,onDone);
			} else 
				onDone(-1);
		});
		return;
	}
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
		pgclient.query("UPDATE tracking.events SET code=$2,name=$3,begin_time=$4,end_time=$5,owner=$6,track=$7,swim_count=$8,bike_count=$9,run_count=$10,pois=$11 WHERE id = $1 RETURNING *",
			[event.id,event.code,event.name, event.beginTime ? event.beginTime.getTime() : null,event.endTime ? event.endTime.getTime() : null,event.owner && event.owner.id ? event.owner.id : null,event.track ? JSON.stringify(event.track) : null,event.swimCount || 1,event.bikeCount || 1,event.runCount || 1,event.pois ? JSON.stringify(event.pois) : null], 					 
			function(err, result) {
			  	if (done)
			  		done();
			    if(err) {
			      log.error('Error updating event in POSTGRE : '+err);
				  onDone(-1);
			      return;
			    }
				if (result.rows && result.rows.length == 1)
					parseEvent(auth,result.rows[0],function(r) {
						if (r && r.id) {
							for (var k in updateHandlers) {
								var h = updateHandlers[k];
								h(r);
							}
							cache.set(r.id,r);
						}
						// DO POSTFIX?
						if (event.doPostFix) 
							postFixEvent(r,onDone);
						else
							onDone(r);
					});
				else 
					onDone(-1);
		  });
	});	
};

exports.createEvent = function(auth,event,onDone) {
	if (!auth || !auth.id) {
		onDone(-1);
		return;
	}
	if (event.id) {
		log.error("Can not create event with existing id. Try updateEvent instead!");
		onDone(-1);
		return;
	}
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
		pgclient.query("INSERT INTO tracking.events (code,name,begin_time,end_time,owner,swim_count,bike_count,run_count) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
			[event.code,event.name,event.beginTime ? event.beginTime.getTime() : null,event.endTime ? event.endTime.getTime() : null,event.owner && event.owner.id ? event.owner.id : auth.id,event.swimCount || 1,event.bikeCount || 1,event.runCount || 1], 					 
			function(err, result) {
			if (done)
				done();
			    if(err) {
			      log.error('Error creating event in POSTGRE : ',err);
				  onDone(-1);
			      return;
			    }
				if (result.rows && result.rows.length == 1) {
					parseEvent(auth,result.rows[0],function(res) {
						if (res && res.id)
							cache.set(res.id,res);
						postFixEvent(res,onDone);
					});
				} else 
					onDone(-1);
		  });
	});	
};

exports.deleteEvent = function(auth,event,onDone,isInternal) {
	if (!event.id) {
		onDone(0);
		return;
	}
	if (!auth) {
		onDone(-1);
		return;
	}
	if (auth.userGroup != 1) {
		exports.getEventById(authd.admin,event.id,function(res) {
			if (res && res.id && res.owner && res.owner.id && auth && auth.id == res.owner.id) 
				exports.deleteEvent(authd.admin,event,onDone);
			else
				onDone(-1);
		});
		return;
	}
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
		pgclient.query("DELETE FROM tracking.events WHERE id=$1",
			[event.id], 					 
			function(err, result) {
			  if (done)
				  done();
			  if(err) {
			      log.error('Error deleting event in POSTGRE : ',err);
				  onDone(-1);
			      return;
			  }
			  if (!isInternal)
				  gps.resetDailyEventOldStateCache();
			  onDone(0);
		  });
	});	
};

function getEventByQuery(auth,where,args,onDone) 
{
	var sql = "SELECT * from tracking.events WHERE "+where;
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
		pgclient.query(sql,args, 					 
			function(err, result) {
			    if(err) {
			      log.error('Error selecting event by query in POSTGRE : ',err);
				  if (done)
					  done();
				  onDone(-1);
			      return;
			    }
				if (done)
					done();
				if (result && result.rows && result.rows.length == 1) 
				{
					parseEvent(auth,result.rows[0],onDone);
				} else {
					onDone({});
				}
		  });
	});
}

exports.listEventIds = function(auth,data,onDone) 
{
   if (auth && auth.id && typeof auth.id != "number") {
		onDone(-1);
		return;
   }
	var where = "";
	var favSel=",true AS favorite"
	if (!auth) {
		where = "WHERE X.is_public";
	} else {
		if (auth.id) 
		{
			if (typeof auth.id != "number") {
				onDone(-1);
				return;
			}
			join =  "LEFT JOIN tracking.event_participant AS A ON (A.joined AND A.event = X.id AND A.participant = "+auth.id+") ";
			join += "LEFT JOIN tracking.event_favorite AS F ON (F.event = X.id AND F.person = "+auth.id+") ";
			where = "WHERE (X.is_public OR X.owner="+auth.id+" OR A.id IS NOT NULL)";
			favSel=",F.favorite AS favorite";
		}
	}	
	if (data.filter)
	switch (data.filter) 
	{
		case "all" :
			break;
		case "joined" :
			join+=" JOIN tracking.event_participant AS J ON ("+auth.id+" = J.participant AND J.event = X.id AND J.joined) ";
			break;
		case "hosted" : 
			if (!auth.id) {
				onDone(-1);
				return;
			}
			where+=" AND X.owner = "+auth.id;
			break;
		case "favorites" :
			join+=" JOIN tracking.event_favorite AS J ON ("+auth.id+" = J.person AND J.event = X.id AND J.favorite)";
			break;
		default : 
			onDone(-1);
			return;
	}	
	if (!data.selectFavorite)
		favSel="";
	var sql = "SELECT X.id "+favSel+" from tracking.events AS X "+join+" "+where+" ORDER BY X.begin_time desc,X.id";
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
		pgclient.query(sql,[], 					 
			function(err, result) {
			    if (done)
			    	done();
			    if(err) {
			      log.error('Error listing events in POSTGRE : '+err);
				  onDone(-1);
			      return;
			    }
				if (result && result.rows) 
					onDone(result.rows);
				else
					onDone([]);
		  });
	});
};

exports.getEventElapsed = function(auth,event,onDone) 
{
   if (auth && auth.id && typeof auth.id != "number") {
		onDone(-1);
		return;
   }
	var sql = "SELECT elapsed,ST_X(pos) AS lon,ST_Y(pos) AS lat FROM tracking.event_elapsed WHERE geom_event && ST_MAKEPOINT($1,$1) ORDER BY elapsed";
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
		pgclient.query(sql,[event], 					 
			function(err, result) {
			    if (done)
			    	done();
			    if(err) {
			      log.error('Error listing events in POSTGRE : '+err);
				  onDone(-1);
			      return;
			    }
				if (result && result.rows) 
					onDone(result.rows);
				else
					onDone([]);
		  });
	});
};

exports.setEventParticipant = function(auth,data,onDone) {
	if (typeof data.event != "number" || typeof data.participant != "number" || typeof auth.id != "number") {
		onDone(-1);
		return;
	}
	if (!auth || auth.userGroup != 1) {
		if (!auth)
			onDone(-1);
		else
		exports.getEventById(authd.admin,data.event,function(res) {
			if (res && res.id && auth.id == res.owner.id) {
				doWork();
			} else 
				onDone(-1);
		});
		return;
	} else
		doWork();
	//-----------------------------------------------------------
	function doWork() 
	{
		if (!data) {
			onDone(-1);
			return;
		}
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
			if (data.doRemove) {
				pgclient.query("DELETE FROM tracking.event_participant WHERE event = $1 AND participant = $2",
					[data.event,data.participant], 					 
					function(err, result) {
					if (done)
						done();
				    if(err) 
				    {
				    	log.error('Error deleting from event_participant in POSTGRE : ',err);
				    	onDone(-1);
				    	return;
				    }
				    onDone(0);
				});
				return;
			}
			//---------------------------------------------------------------------------------------	
			pgclient.query("SELECT id FROM tracking.event_participant WHERE event = $1 AND participant = $2",
				[data.event,data.participant], 					 
				function(err, result) {
				if (done)
					done();
			    if(err) {
			    	log.error('Error selecting from event_participant person in POSTGRE : ',err);
			    	onDone(-1);
			    	return;
			    }
			    if (result.rows && result.rows.length == 1)
			    	onDone(1);
			    else {
					pgclient.query("INSERT INTO tracking.event_participant(event,participant,invitation,joined,start_group,start_pos) VALUES($1,$2,$3,$4,$5,$6)",
							[data.event,data.participant,data.invitation,data.joined == undefined ? false : data.joined,data.startGroup || '',data.startPos || 0], 					 
							function(err, result) {
							if (done)
								done();
						    if(err) {
						    	log.error('Error inserting into event_participant in POSTGRE : ',err);
						    	onDone(-1);
						    	return;
						    }
						    onDone(0);
					    });
			    }
			});
		});
	}
};	

function parseEvent(auth,r,onDone) 
{
	if (typeof r.track == "string") {
		try {
			r.track=JSON.parse(r.track);
		} catch (e) {}
	}
 	var res={track: r.track, trackLength: r.track_length,isPublic : r.is_public,id : r.id,code:r.code,name : r.name,swimCount : r.swim_count,bikeCount : r.bike_count,runCount : r.run_count,beginTime : r.begin_time ? new Date(r.begin_time) : null, endTime : r.end_time ? new Date(r.end_time) : null };
	if (r.pois) 
		res.pois=r.pois;
	if (r.owner) {
		persons.getPersonById(auth,r.owner,function(a) {
			if (a && a.id) 
				res.owner=a;
			onDone(res);
		});
	} else {
		if (onDone)
			onDone(res);
	}
}


// data = event : <id>  
exports.setFavorite = function(auth,data,onDone) {
	if (!auth || (typeof auth.id != "number")) {
		log.error("Creating set location visibility without authorization "+JSON.stringify(auth)+"!");
		onDone(-1);
		return;
	}
	if (!data) {
		onDone(-1);
		return;
	}
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
		pgclient.query("SELECT favorite FROM tracking.event_favorite WHERE person = $1 AND event = $2",
			[auth.id,data.event], 					 
			function(err, result) {
			if (done)
				done();
		    if(err) {
		    	log.error('Error selecting from updating event_favorite POSTGRE : ',err);
		    	onDone(-1);
		    	return;
		    }
		    if (result.rows && result.rows.length == 1) {
				pgclient.query("UPDATE tracking.event_favorite SET favorite = $3 WHERE person = $1 AND event = $2",
					[auth.id,data.event,(data.favorite == true)], 					 
					function(err, result) {
					if (done)
						done();
				    if(err) {
				    	log.error('Error updating event_favorite in POSTGRE : ',err);
				    	onDone(-1);
				    	return;
				    }
				    onDone((data.favorite == true));
			    });
		    } else {
				pgclient.query("INSERT INTO tracking.event_favorite(person,event,favorite) VALUES($1,$2,$3)",
						[auth.id,data.event,(data.favorite == true)], 					 
					function(err, result) {
					if (done)
						done();
				    if(err) {
				    	log.error('Error inserting into event_favorite in POSTGRE : ',err);
				    	onDone(-1);
				    	return;
				    }
				    onDone((data.favorite == true));
			    });
		    }
		});
	});	
};



exports.setGroupTimes = function(auth,data,onDone) {
	if (!auth || (typeof auth.id != "number")) {
		log.error("Creating set location visibility without authorization "+JSON.stringify(auth)+"!");
		onDone(-1);
		return;
	}
	if (!data) {
		onDone(-1);
		return;
	}
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
		var sql = "UPDATE tracking.event_participant SET start_time = $3,end_time=$4 WHERE event=$1 AND start_group=$2";
		var args = [data.event,data.code,data.startTime,data.endTime];
		function lsql() 
		{
			var s=sql;
			for (var i=0;i<args.length;i++) {
				var val = args[i];
				var k="$"+(i+1);
				s=s.split(k).join(val);
			}
		}
		lsql();
		pgclient.query(sql,args, 					 
			function(err, result) {
			if (done)
				done();
		    if(err) {
		    	log.error('Error selecting from updating event_favorite POSTGRE : ',err);
		    	onDone(-1);
		    	return;
		    }
		    exports.getEventById(auth,data.event,function(res) {
		    	postFixEvent(res,onDone);
		    });
		});
	});	
};


exports.listGroupsOrderBy = function(auth,data,onDone) 
{
	//------------------------------------
	var orderBy="id";
	if (!data.isCount && data.orderBy) 
		orderBy=data.orderBy;
	//------------------------------------
	var oby="";
	var isLower=false;
	if (orderBy.endsWith("ToLower")) {
		orderBy=orderBy.substring(0,orderBy.length-7);
		isLower=true;
	}
	if (!data.isCount)
	switch (orderBy) 
	{
		case "code" :
			oby="start_group,MIN(id)";
			break;
		case "count" :
			oby="COUNT(id),MIN(id)";
			break;
		case "startTime": 
			oby="MIN(start_time),MIN(id)"
			break;
		case "endTime": 
			oby="MIN(end_time),MIN(id)"
			break;
		case "-count" :
			oby="COUNT(id) DESC,MIN(id) DESC";
			break;
		case "-code" :
			oby="start_group DESC,MIN(id) DESC";
			break;
		case "-startTime": 
			oby="MIN(start_time) DESC,MIN(id) DESC"
			break;
		case "-endTime": 
			oby="MIN(end_time) DESC,MIN(id) DESC"
			break;
		default :
			onDone(-1);
			return;
	}
	var where = "";
	var limit = "";
	var join = "";
	var select = "";
	
	var sql;
	if (data.isCount)
		sql="SELECT COUNT(X.start_group) AS id FROM (SELECT DISTINCT start_group FROM tracking.event_participant WHERE event = "+parseInt(data.event)+") AS X";
	else {
		sql="SELECT start_group AS code,MIN(start_time) as start_time,MIN(end_time) as end_time,COUNT(id) AS count FROM tracking.event_participant WHERE event = "+parseInt(data.event)+" GROUP BY start_group ORDER BY "+oby;
		if (data.limit) 
		{
			sql+=" LIMIT "+data.limit;
			if (data.page)
				sql+=" OFFSET "+data.page*data.limit;
		}
	}
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
		pgclient.query(sql,[], 					 
			function(err, result) {
			    if(err) {
			      log.error('Error listing persons in POSTGRE : '+err);
				  if (done)
					  done();
				  onDone(-1);
			      return;
			    }
				if (done)
					done();
				var res=[];
				if (result && result.rows) 
				{
					for (var e of result.rows)
						res.push(e);
				} 
				onDone(res);
		  });
	});
};

function postFixEvent(event,onDone) 
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
		pgclient.query("DELETE FROM tracking.event_elapsed WHERE geom_event && ST_MAKEPOINT($1,$1)",[event.id], 					 
		function(err, result) 
		{
			if (done)
				done();
			if(err) 
			{
				log.error('Error deleting event_elapsed in POSTGRE : ',err);
				onDone(-1);
				return;
			}
			if (!event.beginTime)
				return onDone(event);
			if (!event.track)
				return onDone(event);

			var swimCount = event.swimCount == undefined ? 0 : event.swimCount;
			var bikeCount = event.bikeCount == undefined ? 0 : event.bikeCount;
			var runCount = event.runCount == undefined ? 0 : event.runCount;
			
			var points=[];
			function addPoint(pos,elapsed) {
				points.push({pos:pos,elapsed:elapsed});
			}
			function addLine(p1,p2,e1,e2,skipIf) 
			{
				var d = WGS84SPHERE.haversineDistance(p1,p2);
				//console.log("ADD LINE WITH LEN "+d);
				if (d < consts.trackingPointPerMeters) {
					if (e1 != skipIf)
						addPoint(p1,e1);
				} else {
					var mp=[(p1[0]+p2[0])/2,(p1[1]+p2[1])/2];
					addLine(p1,mp,e1,(e1+e2)/2,skipIf);
					addLine(mp,p2,(e1+e2)/2,e2,skipIf);
				}
			}
			var res=0.0;
			var bikeStart;
			var runStart;
			var elapsed=0.000001;
			var edone=false;
			var lon=undefined;
			var lat=undefined;
			for (var t=0;t<3;t++)
			{
				var coef=1;
				if (t == 0)
					coef=swimCount;
				else if (t == 1)
					coef=bikeCount;
				else if (t == 2)
					coef=runCount;
				if (event.track[t] && event.track[t].length >= 2) 
				{
					var cc = event.track[t];
					for (var loop=0;loop<coef;loop++)
					for (var i=0;i<cc.length-1;i++) 
					{
						var a = cc[i];
						var b = cc[i+1];
						var d = WGS84SPHERE.haversineDistance(a,b);
						res+=d;
						if (!edone && res >= consts.trackingStartInMeters) {
							elapsed=res;
							lon=b[0];
							lat=b[1];
							edone=true;
						}
					}
				}
				if (t == 0)
					bikeStart=runStart=res;
				else if (t == 1)
					runStart=res;
			}
			if (edone)
				elapsed/=res;
			
			var cres=0;
			for (var t=0;t<3;t++)
			{
				var coef=1;
				if (t == 0)
					coef=swimCount;
				else if (t == 1)
					coef=bikeCount;
				else if (t == 2)
					coef=runCount;
				if (event.track[t] && event.track[t].length >= 2) 
				{
					var cc = event.track[t];
					for (var loop=0;loop<coef;loop++) 
					{
						for (var i=1;i<cc.length;i++) 
						{
							var a = cc[i-1];
							var b = cc[i];
							var d = WGS84SPHERE.haversineDistance(a,b);
							var ores=cres;
							cres+=d;
							addPoint(a,ores);
							addLine(a,b,ores,cres,ores);
						}
						addPoint(cc[cc.length-1],cres);
					} 
				}
			}
			//------------------------------------------------------
			if (bikeStart != undefined)
				bikeStart/=res;
			if (runStart != undefined)
				runStart/=res;
			console.log("COLLECTED TOTAL : "+points.length+" TRACKING POINTS!");
			var arr=[];
			

			for (var i=0;i<points.length;i++) {
				var p = points[i];
				arr.push("(ST_MAKEPOINT("+event.id+","+event.id+"),ST_MAKEPOINT("+p.pos[0]+","+p.pos[1]+"),"+p.elapsed/cres+")");
			}
			//-----------------------------------------------------------------------------------------------------------------------
			// NEW BUS MODE > ADD ELAPSED 1..2 AS EXTRA LOOP DATA
			if (consts.isLoop) 
			{
				for (var i=0;i<points.length;i++) 
				{ 
					var p = points[i];
					arr.push("(ST_MAKEPOINT("+event.id+","+event.id+"),ST_MAKEPOINT("+p.pos[0]+","+p.pos[1]+"),"+(p.elapsed/cres+1.0)+")");
				}
			}
			//-----------------------------------------------------------------------------------------------------------------------
			if (!arr.length) {
				cleanupWork(); 
			} else {
				var sql = "INSERT INTO tracking.event_elapsed(geom_event,pos,elapsed) VALUES \n"+arr.join(",\n");
				pgclient.query(sql,[], 					 
				function(err, result) 
				{
					if (done)
						done();
					if(err) 
					{
						log.error('Error inserting event_elapsed in POSTGRE : ',err);
						console.log(sql);
					}
					cleanupWork();
				});		
			}			

			if (!event.endTime) {
				log.error("EVENT HAS NOT END TIME! "+JSON.stringify(event));
				return onDone(-1);
			}
			
			var tq="(t>="+event.beginTime.getTime()+") AND (t<="+event.endTime.getTime()+") AND (t <= "+(new Date()).getTime()+") ";
			// TODOO MISSING QUERY PARTICIPANT EVENT !!!!!!!!!!! IMPORTANT !!!!!!!!!!!1
			// TODOO MISSING QUERY PARTICIPANT EVENT !!!!!!!!!!! IMPORTANT !!!!!!!!!!!1
			// TODOO MISSING QUERY PARTICIPANT EVENT !!!!!!!!!!! IMPORTANT !!!!!!!!!!!1
			
			function cleanupWork() 
			{
				var sql;
				pgclient.query(sql="UPDATE tracking.position SET event=null WHERE event = $1",[event.id], 					 
				function(err, result) 
				{
					if (done)
						done();
					if(err) 
					{
						log.error('Error updating position 1 in POSTGRE : ',err);
						console.log(sql);
						onDone(-1);
						return;
					}
					dlocation.reset(function() {
						//-------------------------------------------------------------------------------------------
						pgclient.query(sql="UPDATE tracking.position SET event=$1 WHERE "+tq,[event.id], 					 
						function(err, result) 
						{
							if (done)
								done();
							if(err) 
							{
								log.error('Error updating position 2 in POSTGRE : ',err);
								console.log(sql);
								onDone(-1);
								return;
							}
							pgclient.query(sql="DELETE FROM tracking.position_soft WHERE event=$1",[event.id], 					 
							function(err, result) 
							{
								if (done)
									done();
								if(err) 
								{
									log.error('Error updating position 3 in POSTGRE : ',err);
									console.log(sql);
									onDone(-1);
									return;
								}
								dstorage.reset();
								initialWork();
							});
						});
					});
				});
			} 
			function initialWork() 
			{
				// something not ok, reset elapsed lon lat (start)
				if (event.track && !(lon || !lat)) 
				{
					elapsed=0.000001;
					for (var i=0;i<event.track.length;i++) 
					{
						var tp = event.track[i];
						if (tp && tp.length) {
							lon=tp[0][0];
							lat=tp[0][1];
							break;
						}
					} 
				}
				console.log("START "+lon+" "+lat+" | "+elapsed);
				pgclient.query(sql="UPDATE tracking.events SET start_lon = $2,start_lat = $3,start_elapsed=$4,bike_start_elapsed=$5,run_start_elapsed=$6,track_length=$7 WHERE id = $1",[event.id,lon,lat,elapsed,bikeStart,runStart,res], 					 
				function(err, result) 
				{
					if (done)
						done();
					if(err) 
					{
						log.error('Error inserting event_elapsed in POSTGRE : ',err);
						console.log(sql);
					}
					// REMOVE ME REMOVE ME
					resetInterpolation(event.beginTime.getTime(),event.endTime.getTime(),function(res) {
						if (res < 0)
							return onDone(res);
						if (event.code == "TEMPLATE")
							gps.resetDailyEventToday();
						onDone(event);
					});

				});		
			}
	   });
	});	
	//onDone(event);
}


// TODO GOTO XCONF
// m/s
var maxSpeedPredictionDuration = consts.maxSpeedPredictionDurationInSeconds;
var maxSpeedSwim=consts.maxSpeedSwimKMH*0.2778;
var maxSpeedBike=consts.maxSpeedBikeKMH*0.2778;
var maxSpeedRun=consts.maxSpeedRunKMH*0.2778

function getEventQuery(t,personId) {
	return " Q1 AS ( SELECT MIN(S1.id) AS event FROM tracking.events AS S1 JOIN tracking.event_participant AS S2 ON S2.event = S1.id AND S2.participant="+personId+" AND S2.joined WHERE "+t+" >= S1.begin_time AND (S1.end_time IS NULL OR "+t+" <= S1.end_time) )";	
} 

exports.getEventQuery=getEventQuery;
exports.initTrackingStoredProcedure=initTrackingStoredProcedure;
exports.postFixEvent=postFixEvent;
function resetInterpolation(tFrom,tTo,onDone) 
{
	log.warn("RESETING Interpolation "+moment(tFrom).format("DD.MM HH:mm:ss")+" > "+moment(tTo).format("DD.MM HH:mm:ss") );
	var ib = Math.floor((tFrom-consts.timeOrigin)/(1000*consts.locationStep));
	var ie = Math.ceil((tTo-consts.timeOrigin)/(1000*consts.locationStep));
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
		pgclient.query("DELETE FROM tracking.position_soft WHERE i >= $1 AND i <= $2",[ib,ie], 					 
		function(err, result) 
		{
			if (done)
				done();
			if(err) 
			{
				log.error('Error deleting position_soft in POSTGRE : ',err);
				onDone(-1);
				return;
			}
			//------------------------------------------------------------------------------------------------------------------------------------------------------------
			pgclient.query("SELECT DISTINCT person FROM tracking.position WHERE t >= $1 AND t <= $2 AND pos IS NOT NULL",[tFrom,tTo],function(err,result) {
				if (done)
					done();
				function step(k) 
				{
					var tdone=0;
					function one() 
					{
						var t = result.rows.shift();
						if (t) {
							tdone++;
							calcEventParticipant(tFrom,tTo,t.person,onDoneT);
						}
					}
					for (var i=0;i<k;i++)
						one();
					if (!tdone) {
						log.warn("DONE ALL");
						onDone(0);
						return;
					}
					function onDoneT(person) 
					{
						log.warn("DONE PERSON "+person);
						tdone--;
						if (tdone == 0) {
							log.warn("Done one chunk of "+k+" elements! MORE "+result.rows.length);
							step(k);
						} 
					}
				}
				step(10);
			});
	   });
	});	
}
//-------------------------------------------------------------------
function calcEventParticipant(tFrom,tTo,person,onDone) 
{
	var dbcon = driver.connect(function(err,pgclient,done) 
	{
		log.warn("calcEventParticipant for person : "+person);
		pgclient.query("SELECT id,t,person FROM tracking.position WHERE t >= $1 AND t <= $2 AND pos IS NOT NULL AND person = $3 ORDER BY t,id",[tFrom,tTo,person],function(err,result) {
			if (done)
				done();
			if(err) 
			{
				log.error('Error getting position for update (reset interp.) in POSTGRE : ',err);
				onDone(-1);
				return;
			}
			log.warn(" --- RESETING interpolation between "+result.rows.length+" POSITIONS!");
			var sql;
			one();
			function one() 
			{
				if ((result.rows.length % 100) == 0) 
					console.log(person+" | MORE TO INTERPOALTE : "+result.rows.length);
				var r = result.rows.shift();
				if (!r) {
					onDone(person);
					return;
				}
				pgclient.query(sql=(
					+getInterpolationQuery()
					+"\n,X AS ( INSERT INTO tracking.position_soft(i,geom_i,person,event,pos,hdop,speed_in_kmh,speed_in_kmh_average,alt,avail) (SELECT i,geom_i,person,event,pos,hdop,speed_in_kmh,speed_in_kmh_average,alt,avail FROM RES ) RETURNING id,person,i,alt ) "
					+"SELECT tracking.TRACKPOS(id) FROM X"
					),[],function(err, result) 
				{
					
					if (done)
						done();
					if (err) 
					{
						console.log("\n"+sql);
						log.error("ERROR "+moment(r.t).format("DD.MM HH:mm:ss")+" | "+(r.t-consts.timeOrigin)/10000+" | "+r.person+" | calculating soft position : "+err);
						onDone(-1);
						return;
					}
					one();
				});
			}
		});
	});
}
//-------------------------------------------------------------------------------------------------
// TODO STORED PROCEDURE
//INP > must include POSITION,EVENT,HDOP,ALT !!! SPEED IS OPTIONAL BUT ALSO IMPORTANT (TODO EXPLAIN) 
exports.getInterpolationQuery=getInterpolationQuery;
function getInterpolationQuery() 
{
	var sql=
	/* CALCULATED CURRENT SPEED */
	 ",A_LP AS ( SELECT ST_DISTANCE(pos,(SELECT pos FROM INP),true) / (((SELECT t FROM inp) - t)/1000.0) * 3.6   AS cspeed FROM tracking.position WHERE person = (SELECT person FROM INP) AND t < (SELECT t from INP) AND pos IS NOT NULL ORDER BY t desc LIMIT 1)\n"
	/* FIXED CURRENT RECORD. pos is not null > skip for input queries */
	+",A_POS AS ( SELECT t,pos,alt,CASE WHEN speed_in_kmh > 0 THEN speed_in_kmh ELSE (SELECT cspeed FROM A_LP) END AS speed_in_kmh,speed_in_kmh_average,LEAST(hdop,"+consts.maxHDOP+") AS hdop FROM INP WHERE pos IS NOT NULL )\n"
	
	/* LAST DEFINED POS */
	+",L_POS_PRE AS ( SELECT pos,alt,t,speed_in_kmh,speed_in_kmh_average,hdop FROM tracking.position WHERE (((SELECT event FROM INP) IS NULL AND t >= (SELECT t FROM INP)-"+consts.signalTimeout*1000+" OR event = (SELECT event FROM INP))) AND person = (SELECT person FROM INP) AND t < (SELECT t FROM INP) AND pos IS NOT NULL ORDER BY t DESC LIMIT 1)\n"
	/* CALCULATED LAST SPEED */
	+",L_LP AS ( SELECT ST_DISTANCE(pos,(SELECT pos FROM L_POS_PRE),true) / (((SELECT t FROM L_POS_PRE) - t)/1000.0) * 3.6   AS cspeed FROM tracking.position WHERE person = (SELECT person FROM INP) AND t < (SELECT t from L_POS_PRE) ORDER BY t desc LIMIT 1)\n"
	/* FIXED LST RECORD */
	+",L_POS AS ( SELECT t,pos,alt,CASE WHEN speed_in_kmh > 0 THEN speed_in_kmh ELSE (SELECT cspeed FROM L_LP) END AS speed_in_kmh,speed_in_kmh_average,LEAST(hdop,"+consts.maxHDOP+") AS hdop FROM L_POS_PRE WHERE pos IS NOT NULL )\n"

	// DBG 
	//+",DBG AS ( SELECT ceil(((SELECT t FROM L_POS)-"+consts.timeOrigin+") / "+consts.locationStep*1000+"::real)::int8 AS R1 , floor(((SELECT t FROM A_POS)-"+consts.timeOrigin+") / "+consts.locationStep*1000+"::real)::int8 AS R2    ) "
	
	/* INDEX SET TO INTERPOLATE !!!!!! EPSILON IS OK because raw format is 1 second exact !!!!!! */
	+",I0 AS ( SELECT * FROM generate_series(ceil(((SELECT t+0.00001 FROM L_POS)-"+consts.timeOrigin+") / "+consts.locationStep*1000+"::real)::int8,floor(((SELECT t FROM A_POS)-"+consts.timeOrigin+") / "+consts.locationStep*1000+"::real)::int8  ) as i )\n"
	/* convert from index to time */
	+",I1 AS ( SELECT i,i*"+consts.locationStep*1000+"+"+consts.timeOrigin+" AS t FROM I0)\n"
	/* calculate fraction */
	+",I2 AS ( SELECT i,(t-(SELECT t FROM L_POS))/(((SELECT t FROM A_POS)-(SELECT t FROM L_POS))::float8) as fract,(t-(SELECT t FROM L_POS))/("+(consts.locationStep*1000)+"::float8) AS avail FROM I1)\n"

	// FINALLY : we have 2 points with all defined values and 1 fraction coef (PFUUUUUUFUUOOOOKK!!)
	+",RES AS ( SELECT (SELECT person FROM INP) AS person,(SELECT event FROM INP),i,ST_MAKEPOINT(i,i) as geom_i,ST_Line_Interpolate_Point(ST_MAKELINE((SELECT pos FROM L_POS),(SELECT pos FROM A_POS)),fract) AS pos,COALESCE((SELECT speed_in_kmh FROM L_POS)+((SELECT speed_in_kmh FROM A_POS)-(SELECT speed_in_kmh FROM L_POS))*fract,0) AS speed_in_kmh, COALESCE((SELECT speed_in_kmh_average FROM L_POS)+((SELECT speed_in_kmh_average FROM A_POS)-(SELECT speed_in_kmh_average FROM L_POS))*fract,0) AS speed_in_kmh_average, (SELECT hdop FROM L_POS)+((SELECT hdop FROM A_POS)-(SELECT hdop FROM L_POS))*fract AS hdop, (SELECT alt FROM L_POS)+((SELECT alt FROM A_POS)-(SELECT alt FROM L_POS))*fract AS alt,avail FROM I2 ORDER BY i)";
	return sql;
} 

var speedTolerance = 1;

var extraMaxMeters=50;
var maxSpeedCoef=2;
var maxLastTrackedSpeedCoef = 2;
	
function initTrackingStoredProcedure() 
{
	var sql=[	   ,
	   // INTERPOLATED POSITION DATA
	    " CREATE OR REPLACE FUNCTION tracking.TRACKPOS(sid int8) RETURNS void AS $BODY$ BEGIN\n"
	   ,"WITH DT AS (SELECT i,pos,event,person FROM tracking.position_soft WHERE id = sid) "	   
	   // event data
	   ,",EV AS (SELECT bike_start_elapsed,run_start_elapsed,start_elapsed,track_length,start_lon,start_lat FROM tracking.events WHERE id = (SELECT event FROM DT) )"
	   // last seen
	   ,",LS AS (SELECT (elapsed-floor(elapsed)) AS elapsed,elapsed AS oe,tpos,speed_in_kmh,hdop,i,id FROM tracking.position_soft WHERE event = (SELECT event FROM DT) AND person = (SELECT person FROM DT) AND i = (SELECT i FROM DT)-1 )"	
	   // final search radius
	   ,",FS AS ( SELECT LEAST("+consts.basicTrackingGPSToleranceMeters+"+"+consts.HDOPMultipliedGPSToleranceMeters+"*(SELECT hdop FROM LS),"+consts.upperLimitSumTrackingGPSTolerances+") as radius )"

	   // last distinct, used ONLY for the TRACKED MINIMUM (MT)
	   ,",LT_PRE AS (SELECT (elapsed-floor(elapsed)) AS elapsed,tpos,speed_in_kmh,hdop,i FROM tracking.position_soft WHERE event = (SELECT event FROM DT) AND person = (SELECT person FROM DT) AND elapsed < (SELECT oe FROM LS) ORDER BY i DESC LIMIT 1)"	
	   // IF NOT LT THEN USE LS (fixes the start position bug and jump from the initial state)
	   ,",LT AS (SELECT * FROM LT_PRE UNION ALL SELECT (elapsed-floor(elapsed)) AS elapsed,tpos,speed_in_kmh,hdop,i FROM LS WHERE (SELECT id FROM LT_PRE) IS NULL)"	
	   
	   // UPPER LIMIT FOR MINIMUM BASEC 
	   ,",ES AS ( SELECT SUM(speed_in_kmh)*0.2778*("+maxLastTrackedSpeedCoef*10+"::float8) AS diff FROM tracking.position_soft WHERE event = (SELECT event FROM DT) AND person = (SELECT person FROM DT) AND i >= (SELECT i FROM LT) AND i <= (SELECT i FROM DT) )"	
	   ,",EM AS ( SELECT elapsed+(SELECT diff FROM ES)/(SELECT track_length FROM EV) AS elapsed FROM LT ) \n"
	   // TRACKED (MINIMUM) tracking candidate with elapsed >= LS.elapsed 
	   ,",MT AS (SELECT elapsed,pos FROM tracking.event_elapsed WHERE ST_DISTANCE((SELECT pos FROM DT),pos,true) <= (SELECT radius FROM FS) AND elapsed >= (SELECT elapsed FROM LS) AND elapsed <= LEAST( (SELECT elapsed FROM EM) , (SELECT elapsed FROM LS)+("+consts.maxTrackingGapInMeters+"::float8)/(SELECT track_length FROM EV)) AND geom_event && (SELECT ST_MAKEPOINT(event,event) FROM DT) ORDER BY elapsed LIMIT 1) "

	   // UPPER LIMIT BASED ON COEF * SPEED  
	   ,",E AS ( SELECT elapsed + ((SELECT speed_in_kmh*0.2778 FROM DT)*("+maxSpeedCoef*10+"::float8)+"+extraMaxMeters+")/(SELECT track_length FROM EV) AS elapsed FROM LS ) \n"
	   // TRACKED WITH PREDICTION
	   ,",T1 AS (SELECT id,elapsed,pos FROM tracking.event_elapsed WHERE ST_DISTANCE((SELECT pos FROM DT),pos,true) <= (SELECT radius FROM FS) AND elapsed >= (SELECT elapsed FROM LS) AND elapsed <= (SELECT elapsed FROM E) AND geom_event && (SELECT ST_MAKEPOINT(event,event) FROM DT) ) "
	   ,",T2 AS (SELECT *,rank() OVER (ORDER BY id) as rnk FROM T1 ) "
	   ,",T3 AS (SELECT * FROM T2 WHERE id-(SELECT MIN(id) FROM T1)+1 = rnk ORDER BY ST_DISTANCE(pos,(SELECT pos FROM DT)) LIMIT 1) "
	   
	   // TRACKED (NEW : SUPPORT LOOPS)  
	   ,",T AS ( SELECT COALESCE((SELECT elapsed FROM T3),(SELECT elapsed FROM MT)) + COALESCE((SELECT floor(oe) FROM LS),0) AS elapsed,COALESCE((SELECT pos FROM T3),(SELECT pos FROM MT)) AS pos)"

	   // start position = MIN ELAPSED (ONY IF NO LS = LASTSEEN!!)
	   ,",SP AS (SELECT elapsed,pos FROM tracking.event_elapsed WHERE (SELECT elapsed FROM LS) IS NULL AND ST_DISTANCE(pos,(SELECT pos FROM DT),true) < "+consts.startTrigerDistanceMeters+" AND geom_event && (SELECT ST_MAKEPOINT(event,event) FROM DT) ORDER BY elapsed LIMIT 1) "

	   // final result coalesce (tracked,last,tracked_start)
	   ,",RES AS (SELECT" +
	   		" CASE WHEN (SELECT elapsed FROM T) IS NOT NULL THEN (SELECT elapsed FROM T) WHEN (SELECT oe FROM LS) IS NOT NULL THEN (SELECT oe FROM LS) WHEN (SELECT elapsed FROM SP ) IS NOT NULL THEN (SELECT elapsed FROM SP ) ELSE NULL END AS elapsed " +
	   		",CASE WHEN (SELECT pos FROM T) IS NOT NULL THEN (SELECT pos FROM T) WHEN (SELECT tpos FROM LS) IS NOT NULL THEN (SELECT tpos FROM LS) WHEN (SELECT pos FROM SP ) IS NOT NULL THEN (SELECT pos FROM SP ) ELSE NULL END AS tpos " +
	   		") UPDATE tracking.position_soft SET tpos=res.tpos,elapsed=res.elapsed FROM res WHERE id = sid;\n"
	   +" END; $BODY$ LANGUAGE 'plpgsql'"	   		
	].join("\n");
	var dbcon = driver.connect(function(err,pgclient,done) 
	{
		if (err) 
		{
			if (done)
				done();
			log.warn("CAN NOT CONNECT TO POSTGRE. SKIP INIT TRACKING STORED PROCEDURE!!! : "+err);
			return;
		}		
		pgclient.query(sql,[], 					 
		function(err, result) 
		{
			if (done)
				done();
			if (err) {
				log.error("ERROR CREATING STORE PROCEDURE (2) : "+err);
			}
		});
	});
};

