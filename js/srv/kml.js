var log=require("../misc/log");
var moment=require("moment");
var dstorage = require("../db/discreteStorage");
var dlocation = require("../db/discreteLocation");
var fs = require("fs");
var os = require("os");
var basicAuth = require('basic-auth');
var events = require("../db/events");
var persons = require("../db/persons");
var authd = require("../misc/auth");
var dstorage = require("../db/discreteStorage");
var dlocation = require("../db/discreteLocation");
var driver = require("../db/driver");
var WGS84SPHERE = require("../ui/Utils").WGS84SPHERE;
var consts = require("../conf/constants");
var interpolateMeters = 5;
var cameraOffsetMeters = 20;
var distMeters = 15;

var extrudeMetersPath = 1*3;
var extrudeMetersCamera = 3*3;

exports.getData=function(eventId,personIds,t,dur,res) 
{	
	var kml;
	var tbegin=moment(t).format("HH:mm");
	var tend=moment(t+dur*10*1000).format("HH:mm");
	events.getEventById(authd.admin,eventId,function(ev) {
		kml=[
		 	    '<?xml version="1.0" encoding="UTF-8"?>',
		 	    '<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:kml="http://www.opengis.net/kml/2.2" xmlns:atom="http://www.w3.org/2005/Atom">',
		 	    '<Folder>',
		 	    '    <name>'+ev.name+' '+tbegin+'-'+tend+' </name>',
		 	    '    <open>1</open>'];
		 	kml.push("<TimeSpan>");
		 	kml.push("<begin>"+moment(t).format("YYYY-MM-DDTHH:mm:ssZ")+"</begin>");
		 	kml.push("<end>"+moment(t+dur*10000).format("YYYY-MM-DDTHH:mm:ssZ")+"</end>");
		 	kml.push("</TimeSpan>");
		 	
	
		if (!ev || ev < 0)
			return res.status(500);
		
		if (!ev.__distances) {
			driver.connect(function(err,pgclient,done)
			{
				//var pview= "SELECT DISTINCT j.person FROM tracking.position AS j LEFT JOIN tracking.event_participant AS TS ON TS.event = $4 AND TS.joined AND TS.participant = J.person ";
				var sql="SELECT elapsed,ST_X(pos) as lon,ST_Y(pos) as lat FROM tracking.event_elapsed WHERE geom_event && ST_MAKEPOINT($1,$1) ORDER BY elapsed";
				var args=[eventId];
				pgclient.query(sql,args, 					 
					function(err, result) {
					  if (done)
						  done();
					  if(err) 
					  {
						  log.error('Error selecting from position in POSTGRE (kml) : '+err);
					      res.status(500);
					      return;
					  }
					  ev.__distances=[];
					  ev.__coords=[];
					  for (var i=0;i<result.rows.length;i++) {
						  var r = result.rows[i]
						  ev.__coords.push([r.lon,r.lat]);
						  ev.__distances.push(r.elapsed);
					  }
					  getResults();
				});
			});
		} 
		else getResults();
		
		function getResults() {
			driver.connect(function(err,pgclient,done)
			{
				var pview ="SELECT DISTINCT participant AS person FROM tracking.event_participant WHERE event = $1 AND joined AND participant IN ("+personIds.join(",")+")";
				var rview = "SELECT J.i AS i,J.alt,J.person,J.tpos,J.elapsed FROM tracking.position_soft AS J WHERE J.i >= $2 AND J.i <= $3 AND J.person IN (SELECT person FROM PP)";
				// 5 m distance last
				var sql = "WITH PP AS ("+pview+")\n";
				sql+=",M AS ("+rview+")\n";
			    sql+="SELECT elapsed,i,person,O.color,O.code,(substring(COALESCE(O.first_name,'?') FROM 1 FOR 1) || substring(COALESCE(O.last_name ,'?') FROM 1 FOR 1)) as alias,i*"+(consts.locationStep*1000)+"+"+consts.timeOrigin+" AS t,ST_X(M.tpos) AS lon,ST_Y(M.tpos) AS lat,M.alt as alt FROM M LEFT JOIN tracking.persons AS O ON O.id = M.person ORDER BY i,person";
			    console.log(eventId,(dur*10000-consts.timeOrigin));
				var args=[
				          eventId
				          ,Math.floor((t-dur*10000-consts.timeOrigin)/(1000*consts.locationStep))
				          ,Math.floor((t-consts.timeOrigin)/(1000*consts.locationStep))
				          ];
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
				lsql();
				pgclient.query(sql,args, 					 
					function(err, result) {
					  if (done)
						  done();
					    if(err) 
					    {
						  lsql();
					      log.error('Error selecting from position in POSTGRE (kml) : '+err);
					      res.status(500);
					      return;
					    }
					    lsql();
						if (result && result.rows) {
						    processResult(ev,t,dur,result.rows);
						} else {
						   res.status(500);
						   return;
						}
				});
			});
		}
	});
	//--------------------------------------------------------------------------
	function processResult(ev,t,dur,rows) 
	{
		var camdone=false;
		var clon;
		var clat;
 		var calt;
		var llon;
		var llat;
		var lalt;
		var paths={};

		function getPositionAndRotationFromElapsed(elapsed) 
		{
			var rr=null;
			var cc = ev.__coords;	// PROJECTED ROUTE
			var ll = ev.__distances.length-1;
			var si = 0;
			while (si < ll && si+500 < ll && ev.__distances[si+500] < elapsed ) {
				si+=500;
			}
			while (si < ll && si+250 < ll && ev.__distances[si+250] < elapsed ) {
				si+=250;
			}
			while (si < ll && si+125 < ll && ev.__distances[si+125] < elapsed ) {
				si+=125;
			}
			while (si < ll && si+50 < ll && ev.__distances[si+50] < elapsed ) {
				si+=50;
			}
			for (var i=si;i<ll;i++) 
			{
				if (ev.__distances[i] < elapsed && ev.__distances[i+1] >= elapsed) 
				{
					var ac=ev.__distances[i+1]-ev.__distances[i];
					if (ac == 0)
						ac=1;
					elapsed-=ev.__distances[i];
					var a = cc[i];
					var c = cc[i+1];
					var dx = c[0] - a[0];
					var dy = c[1] - a[1];
					rr=[a[0]+(c[0]-a[0])*elapsed/ac,a[1]+(c[1]-a[1])*elapsed/ac,Math.atan2(dy, dx)];
					break;
				}
			}
			return rr;
		}


		for (var i=0;i<rows.length;i++) 
		{
			var r = rows[i];
			var pid = r.person;
			if (!paths[pid])
				paths[pid]=[];
			function addPoint(t,elapsed) {
				var pos = getPositionAndRotationFromElapsed(elapsed);
				paths[pid].push({t:t,lon:pos[0],lat:pos[1],rotation:pos[2],elapsed:elapsed,image:r.image,alias:r.alias,code:r.code,color:r.color});
			}
			function addLine(t1,t2,e1,e2,skipIf) 
			{
				var d = (e2-e1)*ev.trackLength;
				if (d < interpolateMeters) {
					if (e1 != skipIf)
						addPoint(t1,e1);
				} else {
					addLine(t1,(t1+t2)/2, e1,(e1+e2)/2,skipIf);
					addPoint((t1+t2)/2,(e1+e2)/2);
				}
			}			
			var pp=paths[pid];
			if (!pp.length)
				addPoint(r.t,r.elapsed);
			else {
				addLine(pp[pp.length-1].t,r.t,pp[pp.length-1].elapsed,r.elapsed,pp[pp.length-1].elapsed);
			}
		}
		for (var k in paths) 
		{
			var r = paths[k][0];
			var col = r.color || "rgba(0,0,0,0.45)";

			var pc=require("parse-color")(col);
			var hex = pc.hex.replace("#","");
			var alph = Math.round((pc.rgba[3] || 1)*0.8*255);
			hex=hex+alph.toString(16);

			kml.push('<Style id="p'+k+'"><IconStyle><Icon><href>http://localhost:3000/personImages/'+r.code+'.png</href></Icon></IconStyle><LineStyle><color>'+hex+'</color><width>8</width></LineStyle></Style>');
			kml.push("<Placemark>");
		    kml.push("<name>"+r.alias+"</name>");
		    kml.push("<styleUrl>#p"+k+"</styleUrl>");
		    kml.push("<gx:Track>");		    
			kml.push("<altitudeMode>relativeToGround</altitudeMode>")
		    for (var i=0;i<paths[k].length;i++) 
			{
				var p = paths[k][i];
				kml.push("<when>"+moment(new Date(p.t)).format("YYYY-MM-DDTHH:mm:ssZ")+"</when>");
			}
			for (var i=0;i<paths[k].length;i++) 
			{
				var p = paths[k][i];
				kml.push("<gx:coord>"+p.lon+" "+p.lat+" "+(0+extrudeMetersPath)+"</gx:coord>");
			}
			kml.push("</gx:Track>");
			kml.push("</Placemark>");
		}

		for (var k in paths) 
		{
			kml.push("<gx:Tour>");		
			kml.push("<name>"+paths[k][0].alias+"</name>");
			kml.push("<gx:Playlist>");
			for (var i=1;i<paths[k].length;i++) 
			{
				
				//1) OT GORE TILT 70 , extrudeMetersCamera : 30  , extrudeMetersPath : 2
				
				var p = paths[k][i];
				var j =i-Math.ceil(cameraOffsetMeters/interpolateMeters);
				if (j >= 0) {
					var h = paths[k][j];
					var rot = (-h.rotation*180/Math.PI+180+90+180)%360;
					kml.push("<gx:FlyTo>");
					kml.push("<gx:duration>10</gx:duration>");
					kml.push("<gx:flyToMode>smooth</gx:flyToMode>");
					kml.push("<Camera>");
					kml.push("<heading>"+rot+"</heading>");
					kml.push("<tilt>89</tilt>");
					kml.push("<longitude>"+h.lon+"</longitude>");
					kml.push("<latitude>"+h.lat+"</latitude>");
					kml.push("<altitude>"+(0+extrudeMetersCamera)+"</altitude>");
					kml.push("<altitudeMode>relativeToGround</altitudeMode>");
					kml.push("<gx:TimeSpan>");
					kml.push("<begin>"+moment(new Date(p.t-1000*60)).format("YYYY-MM-DDTHH:mm:ssZ")+"</begin>");
					kml.push("<end>"+moment(new Date(p.t)).format("YYYY-MM-DDTHH:mm:ssZ")+"</end>");
			        kml.push("</gx:TimeSpan>");
			        kml.push("</Camera>");
					kml.push("</gx:FlyTo>");
				}
			}
			kml.push("</gx:Playlist>");
			kml.push("</gx:Tour>");
		}
		finalWork();
		function finalWork() {
			kml.push('</Folder>');
			kml.push('</kml>');
			res.send(kml.join("\n"));
		}
	}
}
