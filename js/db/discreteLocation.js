var log = require("../misc/log");
var inst = require("../conf/installation").json;
var moment = require("moment");
var driver = require("../db/driver");
var consts = require("../conf/constants");
var discrete = require("../misc/discrete");
var WGS84SPHERE = require('../ui/Utils').WGS84SPHERE;

var maxTiles = 1000;
if (inst && inst.limits && inst.limits.memoryCache && inst.limits.memoryCache.maxTiles > 0) {
	maxTiles=inst.limits.memoryCache.maxTiles;
} else {
	log.warn("discreteLocation : Installation does not specify limits.memoryCache.maxTiles. Using default "+maxTiles);
}
//---------------------------------------------------
var liveTileTimeout = 5;
if (inst && inst.limits && inst.limits.memoryCache && inst.limits.memoryCache && inst.limits.memoryCache.liveTileTimeout > 0) {
	liveTileTimeout=inst.limits.memoryCache.liveTileTimeout;
} else {
	log.warn("discreteLocation : Installation does not specify inst.limits.memoryCache.liveTileTimeout. Using default "+liveTileTimeout);
}
liveTileTimeout*=1000; // seconds > milliseconds
//---------------------------------------------------
var LRU = require("lru-cache");
var options = { max: maxTiles };
var cache = LRU(options);
var keysForPerson = {};	
var queuePerPerson = {};
var queue;

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

exports.getPage = function(auth,data,onDone) 
{
	//level,x,y,page
	//minlon,minlat,maxlon,maxlat
	if (!auth || !auth.id) {
		onDone(-1);
		return;
	}	
	var intv = discrete.pageToInterval(data.page);
	if (!intv  || !intv.isValid) {
		onDone([]);
		return;
	}
	//var key = auth.id+"-"+(data.event ? data.event+":" : ":")+(data.minlon+data.maxlon)/2+"-"+(data.minlat+data.maxlat)/2+"-"-data.page;
	var key = auth.id+"-"+(data.event ? data.event+":" : ":")+data.level+"-"+data.x+"-"+data.y+"-"+data.page;
	var ctime = (new Date()).getTime();		
	var r = cache.get(key);
	function checkItem(r) {
		if (!r.liveTimestamp || r.liveTimestamp >= ctime) {
			return r;
		} else if (r.liveTimestamp) {
			cache.del(key); // timeout out
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
	var g = queuePerPerson[auth.id];
	if (!g) {
		g={queue:[],processing:false};
		queuePerPerson[auth.id]=g;
	}
	g.queue.push({level:data.level,page:data.page,x:data.x,y:data.y,minlon:data.minlon,maxlon:data.maxlon,minlat:data.minlat,maxlat:data.maxlat,onDone:onDone,key:data.key,event:data.event});
	if (!g.processing) 
		one(g);
	function one(g) 
	{
		data = g.queue.shift();
		if (!data) {
			delete queuePerPerson[auth.id];
			return;
		}
		g.processing=true;
		var key = auth.id+"-"+(data.event ? data.event+":" : ":")+data.level+"-"+data.x+"-"+data.y+"-"+data.page;
		var r = cache.get(key);
		if (r) 
		{
			r=checkItem(r);
			if (r) 
				return onOneDone(g,r);
		}
		if (intv.isLive) {
			var gt = new Date().getTime();
			getPageDirect(auth,data,function(res) {
				if (res < 0) {
					onOneDone(g,-1);
				} else {
					// intv.min ? ok?
					res.liveTimestamp=gt+liveTileTimeout;
					cache.set(key,res);
					onOneDone(g,res);
				}
			});
		} else 
		driver.connect(function(err,pgclient,done)
		{
			if (err) 
			{
				log.error("Error on connecting to postgresql  : "+err);
				if (done)
					done();
				onOneDone(g,-1);
				return;
			}
			var sql; 
			var args;
			if (!data.event) {
				sql='SELECT data FROM tracking.discrete_location WHERE person = $1 AND level = $2 AND page = $3 AND x = $4 AND y = $5';
				args=[auth.id,data.level,data.page,data.x,data.y];
			} else {
				sql='SELECT data FROM tracking.discrete_event WHERE person = $1 AND level = $2 AND page = $3 AND x = $4 AND y = $5 AND event=$6';
				args=[auth.id,data.level,data.page,data.x,data.y,data.event];
			}
			pgclient.query(sql,args, 					 
				function(err, result) {
				  if (done)
					  done();
				    if(err) {
				      log.error('Error selecting from discrete_location in POSTGRE : '+err);
					  onOneDone(g,-1);
				      return;
				    }
					if (result && result.rows && result.rows.length == 1) {
						var res = result.rows[0].data;
						if (typeof res == "string")
							res = JSON.parse(res);
						cache.set(key,res);
						onOneDone(g,res);
					} else {						
						getPageDirect(auth,data,function(res) {
							if (done)
								done();
							if (res < 0) {
								onOneDone(g,-1);
							} else {
								
								cache.set(key,res);
								if (!data.event) {
									sql='INSERT INTO tracking.discrete_location(data,person,level,page,x,y) VALUES ($1,$2,$3,$4,$5,$6)';
									args=[JSON.stringify(res),auth.id,data.level,data.page,data.x,data.y];
								} else {
									sql='INSERT INTO tracking.discrete_event(data,person,level,page,x,y,event) VALUES ($1,$2,$3,$4,$5,$6,$7)';
									args=[JSON.stringify(res),auth.id,data.level,data.page,data.x,data.y,data.event];
								}
								pgclient.query(sql,args, 					 
										function(err, result) {
									if (done)
										done();
								    if(err) {
								    	log.error('Error saving discrete_location data in POSTGRE : '+err);
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
			data.onDone(res);
			g.processing=false;
			one(g);
		}
	}
};

exports.reset = function(onDone) {
	exports.clearCaches();
	driver.connect(function(err,pgclient,done) 
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
		pgclient.query('DELETE FROM tracking.discrete_location',[],function(err, result) 
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
			pgclient.query('DELETE FROM tracking.discrete_event',[],function(err, result) 
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
	});
};

exports.clearAll = function(auth,event,onDone) {
	if (!auth || !auth.id) {
		onDone(-1);
		return;
	}
	driver.connect(function(err,pgclient,done) 
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
		pgclient.query('DELETE FROM tracking.discrete_location WHERE person = $1',[auth.id],function(err, result) 
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
		    if (event) {
		    	clearCacheByPrefix(auth.id+"-"+event+":");
				pgclient.query('DELETE FROM tracking.discrete_event WHERE person = $1 AND event = $2',[auth.id,event],function(err, result) 
				{
					if (done)
						done();
				    if(err) 
				    {
				    	log.error('Error deleting from discrete_event in POSTGRE : '+err);
				    	if (onDone)
							onDone(-1);
				    	return;
				    }
				    clearCacheByPrefix(auth.id+"-"+event+":");
				    if (onDone)
						onDone(0);
				});
		    } else {
		    	clearCacheByPrefix(auth.id+"-:");
				pgclient.query('DELETE FROM tracking.discrete_event WHERE person = $1',[auth.id],function(err, result) 
				{
					if (done)
						done();
				    if(err) 
				    {
				    	log.error('Error deleting from discrete_event in POSTGRE : '+err);
				    	if (onDone)
							onDone(-1);
				    	return;
				    }
				    clearCacheByPrefix(auth.id+"-:");
				    if (onDone)
						onDone(0);
				});
		    }
		});
	});
};

exports.clearPages = function(auth,pageMin,pageMax,onDone) 
{	
	if (!auth || !auth.id) {
		onDone(-1);
		return;
	}

	driver.connect(function(err,pgclient,done) 
	{
		if (err) 
		{
			log.error("Error on connecting to postgresql  : "+err);
			if (done)
				done();
			onDone(-1);
			return;
		}		
		
		var sql = 'DELETE FROM tracking.discrete_location AS X WHERE X.person IN (SELECT P.id FROM tracking.persons AS P LEFT JOIN tracking.location_sharing AS S ON S.share_to = $1 WHERE (P.id = $1 OR P.user_group = 1 OR S.id IS NOT NULL) AND (page >= $2 AND page <= $3))';
		var args = [auth.id,pageMin,pageMax];
		function lsql() 
		{
			var s=sql;
			for (var i=0;i<args.length;i++) {
				var val = args[i];
				var k="$"+(i+1);
				s=s.split(k).join(val);
			}
			console.log(s);
		}
		pgclient.query(sql,args,function(err, result) 
		{
			if (done)
				done();
		    if(err) 
		    {
		    	lsql();
		    	log.error('Error deleting from discrete_location in POSTGRE : '+err);
		    	onDone(-1);
		    	return;
		    }
		    onDone(0);
		});
	});
};
//-------------------------------------------------------------------------------------
function getPageDirect(auth,data,onDone) 
{
	if (!auth || !auth.id) {
		onDone(-1);
		return;
	}
	var isAdmin = auth && auth.userGroup == 1;
	//var dbcon = dbConRead(auth.id,function(err,pgclient,done) 
	driver.connect(function(err,pgclient,done)
	{
		if (err) 
		{
			log.error("Error on connecting to postgresql  : "+err);
			if (done)
				done();
			onDone(-1);
			return;
		}
		var intv = discrete.pageToInterval(data.page);
		var where;
		var join;
		var psql;
		var ofs = Math.ceil(consts.signalTimeout/consts.locationStep);
		var m1 = data.page * consts.locationPageSize-ofs;
		var m2 = (data.page+1) * consts.locationPageSize+ofs-1;
		var m0 = data.page * consts.locationPageSize;
		var intv = discrete.pageToInterval(data.page);

		/// NEW > single tile
		if (data.event && data.minlon == 0 && data.maxlon == 1) 
		{
			var ev = parseInt(data.event); 
			var pview= "SELECT j.person,TS.start_group AS start_group,P.type,P.gender FROM tracking.position_soft AS j JOIN tracking.persons AS P ON j.person = P.id LEFT JOIN tracking.event_participant AS TS ON TS.event = "+ev+"  AND TS.joined AND TS.participant = J.person ";
			pview+="LEFT JOIN tracking.event_participant_hidden AS PH ON ph.for_person = $1 AND PH.event = "+ev+" AND PH.person = TS.participant ";
			pview+="WHERE (PH.id IS NULL OR NOT PH.is_hidden) GROUP BY P.type,J.person,TS.start_group,P.gender ";
			var sql="WITH PP AS ("+pview+")\n";
			sql+=",RV AS ( SELECT i-$4 AS i,J.person,J.pos,J.tpos,J.elapsed,J.avail,PP.type,PP.gender,PP.start_group,speed_in_kmh FROM tracking.position_soft AS J JOIN PP ON PP.person =  J.person WHERE J.i >= $2 AND J.i <= $3 AND J.person IN (SELECT person FROM PP) )\n";
			sql+=",RA AS (SELECT RV.i,start_group,type,gender,speed_in_kmh,ST_X("+(data.event?"tpos":"pos")+") AS lon,ST_Y("+(data.event?"tpos":"pos")+") AS lat,RV.person,RV.elapsed as elapsed,RV.avail as avail FROM RV )\n";
			sql+=" SELECT i,person,elapsed,avail,lon,lat,speed_in_kmh,gender,type FROM RA ORDER BY i,(type='PRO') DESC,elapsed DESC,speed_in_kmh DESC";
			var args=[auth.id,m1,m2,m0];
			pgclient.query(sql,args,function(err, result) 
			{
				if(err) 
				{
				  var s=sql;
				  for (var i=args.length-1;i>=0;i--) 
				  {
					 var val = args[i];
					 var k="$"+(i+1);
					 s=s.split(k).join(val);
				  }
				  console.log(s);
			      log.error('Error selecting from discrete_location in POSTGRE : ',err);
				  if (done)
					  done();
				  onDone(-1);
			      return;
			    }
				if (done)
					done();
				var res={};
				var ovrrnk;
				var grprnk;
				var genrnk;
				for (var i=0;i<result.rows.length;i++) 
				{
					var r = result.rows[i];
					if (!res[r.i]) {
						res[r.i]={persons:[]};
						ovrrnk=1;
						grprnk={};
						genrnk={};
					}
					if (r.type == "PRO") 
					{
						var gr = r.start_group || "";
						var ge = r.gender || "";
						r.ovrrnk=ovrrnk++;
						if (!grprnk[gr])
							grprnk[gr]=0;
						r.grprnk=grprnk[gr]++;
						if (!genrnk[ge])
							genrnk[ge]=0;
						r.genrnk=genrnk[ge]++;
					}
					res[r.i].persons.push(r);
				}
				var arr=[];
				for (var i in res)
					arr.push(res[i]);
				onDone({res:arr});
			});
			return;
		}
		var args = [auth.id,data.minlon,data.minlat,data.maxlon,data.maxlat,m1,m2,m0];
		var tbegin = (new Date()).getTime();
		var sql;
		var pview;
		if (!data.event) 
		{
			pview = "SELECT DISTINCT J.person FROM tracking.position_soft AS J LEFT JOIN tracking.location_hidden AS TZ ON (TZ.for_person = $1 AND TZ.person = J.person) LEFT JOIN tracking.location_sharing AS TS ON TS.person = J.person AND TS.share_to = $1 ";
			pview+="WHERE (NOT TZ.is_hidden OR (TZ.is_hidden IS NULL AND (SELECT default_location_visibility FROM tracking.persons WHERE id = $1))) ";
			if (!isAdmin)
				pview+=" AND (J.person = $1 OR TS.id IS NOT NULL) ";
			pview+=" AND J.pos && ST_MakeEnvelope($2,$3,$4,$5) AND J.geom_i && ST_MakeEnvelope($6,$6,$7,$7)";			
		} else {
			var ev = parseInt(data.event); 
			pview= "SELECT DISTINCT j.person FROM tracking.position_soft AS j LEFT JOIN tracking.event_participant AS TS ON TS.event = "+ev+"  AND TS.joined AND TS.participant = J.person ";
			pview+="LEFT JOIN tracking.event_participant_hidden AS PH ON ph.for_person = $1 AND PH.event = "+ev+" AND PH.person = TS.participant ";
			pview+="WHERE (PH.id IS NULL OR NOT PH.is_hidden) ";
			pview+="AND J.tpos && ST_MakeEnvelope($2,$3,$4,$5) AND J.geom_i && ST_MakeEnvelope($6,$6,$7,$7)";
		}
		sql="WITH PP AS ( "+pview+")";
		sql+=",RV AS ( SELECT i-$8 AS i,J.person,J.pos,J.tpos,J.elapsed,J.avail FROM tracking.position_soft AS J WHERE J.i >= $6 AND J.i <= $7 AND J.person IN (SELECT person FROM PP) )";
		sql+=",SV AS ( SELECT * FROM RV WHERE "+(data.event?"tpos":"pos")+" && ST_MakeEnvelope($2,$3,$4,$5) ) ";
		sql+=',B AS (SELECT i,count(person) AS cnt FROM RV GROUP BY i HAVING count(person) > '+consts.maxPersonsInLocationTile+')';
		sql+=",RA AS (SELECT RV.i,ST_X("+(data.event?"tpos":"pos")+") AS lon,ST_Y("+(data.event?"tpos":"pos")+") AS lat,RV.person,RV.elapsed as elapsed,RV.avail as avail FROM RV WHERE RV.i NOT IN (SELECT i FROM B) )";
		sql+=",RB AS (SELECT SV.i,B.cnt,MIN(ST_X("+(data.event?"tpos":"pos")+")) AS minlon,MIN(ST_Y("+(data.event?"tpos":"pos")+")) AS minlat,MAX(ST_X("+(data.event?"tpos":"pos")+")) AS maxlon,MAX(ST_Y("+(data.event?"tpos":"pos")+")) AS maxlat FROM SV JOIN B ON SV.i = B.i GROUP BY SV.i,B.cnt)";
		sql+=',RES AS (SELECT i,null as cnt,person,elapsed as elapsed,avail as avail,lon as minlon,lat as minlat,null as maxlon,null as maxlat FROM RA UNION ALL SELECT i,cnt,null,null,null,minlon,minlat,maxlon,maxlat FROM RB)';
		sql+="SELECT * FROM RES ORDER BY i,person";
		function lsql() 
		{
			var s=sql;
			for (var i=args.length-1;i>=0;i--) {
				var val = args[i];
				var k="$"+(i+1);
				s=s.split(k).join(val);
			}
			console.log(s);
		}
		
		var _tb = (new Date()).getTime();
		pgclient.query(sql,args,
			function(err, result) 
			{
				var _td = (new Date()).getTime()-_tb;
				if (_td > 100) {
					console.log(_td+" ms");
					lsql();
				}
				if(err) 
				{
				  lsql();
			      log.error('Error selecting from discrete_location in POSTGRE : ',err);
				  if (done)
					  done();
				  onDone(-1);
			      return;
			    }
				if (done)
					done();
				//console.log("TOTAL : "+result.rows.length+" | "+((new Date()).getTime()-tbegin)+" ms");
				//lsql();
				
				/*var dbg = data.level+","+data.x+","+data.y;
				if (dbg == "18,139512,-90998") {
					console.log("DEBUUUG "+dbg+"\n");
					lsql();
				}*/

				if (result && result.rows && result.rows.length) 
				{
					var pset={};
					var fres=[];
					var persdata={};
					for (var gi=0;gi<result.rows.length;)
					{
						var crr=[];
						var ti = result.rows[gi].i;
						for (var j=gi;j<result.rows.length;j++) {
							if (result.rows[j].i != ti)
								break;
							crr.push(result.rows[j]);
							gi++;
						}
						//--------------------------------------
						if (crr.length == 1 && !crr[0].person) {
							// too much items, whole tile is a proxy!
							var bbox = [
							    data.minlon,data.minlat,
								data.maxlon,data.maxlat
							];											
							fres.push({i:ti,persons:[],groups:[{minlon:crr[0].minlon,minlat:crr[0].minlat,maxlon:crr[0].maxlon,maxlat:crr[0].maxlat,cnt:crr[0].cnt,key:data.key,bbox:bbox}]});
							continue;
						} else {							
							// all for same I (time index)							
							var clon=consts.locationPageSubGrid/(data.maxlon-data.minlon);
							var clat=consts.locationPageSubGrid/(data.maxlat-data.minlat);
							var res=[];
							var cl = crr.length;
							var dmap1 = {};
							var lmap = {};
							for (var i=0;i<cl;i++)
							{
								var rec = crr[i];
								var x = Math.floor((rec.minlon-data.minlon)*clon);
								var y = Math.floor((rec.minlat-data.minlat)*clat);
								if (x >= 0 && x < consts.locationPageSubGrid+1 && y >= 0 && y < consts.locationPageSubGrid+1) {
									if (!res[y]) {
										res[y]=[];
									}
									var h = res[y][x];
									if (!h) {
										h=res[y][x]=[];
									}
									h.push(rec.person);		// valid data in this tile
								}
								var col = lmap[rec.person];	
								if (!col)
									col=lmap[rec.person]=[];
								col.push(rec);
							}							
							var groups=[];
							var persons=[];
							for (var y=0;y<res.length;y++) 
							{
								var h1=res[y];
								if (h1)
								for (var x=0;x<h1.length;x++) 
								{
									var e=h1[x];
									if (!e)
										continue;
									if (e.length > consts.maxPersonsInSubGrid) 
									{
										var minlon=undefined;
										var minlat=undefined;
										var maxlon=undefined;
										var maxlat=undefined;
										var cc=0;
										for (var i=0;i<e.length;i++) 
										{
											var ei=lmap[e[i]];	//lmap[person id]
											var lon=ei.minlon;
											var lat=ei.minlat;
											if (lon >= data.minlon && lon <= data.maxlon && lat >= data.minlat && lat <= data.maxlat) 
											{
												if (minlon == undefined || lon < minlon) 
													minlon=lon;
												if (minlat == undefined || lat < minlat) 
													minlat=lat;
												if (maxlon == undefined || lon > maxlon) 
													maxlon=lon;
												if (maxlat == undefined || lat > maxlat) 
													maxlat=lat;
												cc++;
											}
										}
										if (cc) 
										{
											var bbox = [
											    data.minlon+x*(data.maxlon-data.minlon)/consts.locationPageSubGrid,data.minlat+y*(data.maxlat-data.minlat)/consts.locationPageSubGrid,
												data.minlon+(x+1)*(data.maxlon-data.minlon)/consts.locationPageSubGrid,data.minlat+(y+1)*(data.maxlat-data.minlat)/consts.locationPageSubGrid,
											];											
											groups.push({minlon:minlon,maxlon:maxlon,minlat:minlat,maxlat:maxlat,cnt:e.length,key:data.key+"-"+x+"-"+y,bbox:bbox});										
										}
									} else {
										for (var ki=0;ki<e.length;ki++) 
										{
											var pid = e[ki];	//person id
											var dd = lmap[pid];
											if (dd) 
											{
												/*if (dbg == "19,278991,-181984") {
													console.log("ADDDDDDDDDDDDDDDD "+pid+" | "+JSON.stringify(dd));
												}*/
												// not added, add all entries
												delete lmap[pid];
												for (var i=0;i<dd.length;i++) 
												{
													var v = dd[i];
													if (!persdata[v.person]) 
													{
														var th=require("./persons").getPersonBasicById(v.person);
														var rh={};
														if (th.color) {
															var rgba = require("parse-color")(th.color).rgba;
															rh.color=(1 << 24)*rgba[0] + (1 << 16)*rgba[1] + (1 << 8)*rgba[2] + Math.round(rgba[3]*255.0);
														}
														if (th.firstName) {
															if (th.lastName)
																rh.code=th.firstName[0]+th.lastName[0];
															else 
																rh.code=th.firstName[0];
														} else if (th.lastName) { 
															rh.code=th.lastName[0];
														} else 
															rh.code="?";
														if (th.country)
															rh.country=th.country;
														if (th.nationality)
															rh.nat=th.nationality;
														persdata[v.person]=rh;												
													}
													persons.push({lon:v.minlon,lat:v.minlat,elapsed:v.elapsed,person:v.person,avail:v.avail});
												}
											}
										}
									}
								}
							}							
							fres.push({i:ti,persons:persons,groups:groups});
						}
					}
					onDone({pdata:persdata,res:fres});
				} else {
					onDone({res:[]});
				}
		  });
	});
}

exports.clearCaches = function() {
	clearCacheByPrefix();
};
/*
var rdDbCon;
function dbConRead(hashCode,callback) 
{
	if (!rdDbCon) {
		rdDbCon = driver.connectDirect(true,function(client,error) {
			if (error)
				rdDbCon=null;
			callback(error,client);
		});
	} else {
		callback(rdDbCon);
	}
}*/