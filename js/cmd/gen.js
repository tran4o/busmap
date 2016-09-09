var log = require("../misc/log");
var inst = require("../conf/installation");
var fs = require("fs");
var path = require("path");
var moment = require("moment");
var persons = require("../db/persons");
var authd = require("../misc/auth");
var gps = require("../srv/gps");
exports.execute = function(args,onDone) {

	if (args.length != 1) {
		log.error("Invalid usage. Use lr GEN <what>!");  
		onDone(-1);
		return;
	}
	switch (args.shift()) 
	{
		case 'locations-full' : {
			var btext = "01.06.2016 08:00";
			var etext = "01.06.2016 18:00";
			var btime = moment(btext,"DD.MM.YYYY HH:mm")+0;	
			var etime = moment(etext,"DD.MM.YYYY HH:mm")+0;
			console.log("BTIME : "+btime+" | "+new Date(btime));
			console.log("ETIME : "+etime+" | "+new Date(etime));
			var nitems = (etime-btime)/(10*1000);
			console.log("Entries per person : "+nitems);
			
			var tcount=3;
			var jdone=[];
			for (var jj=0;jj<tcount;jj++) {
				jdone[jj]=false;
				oneJson(jj);
			}			
			function oneJson(jj) 
			{
				persons.listPersonIds(authd.admin,function(persons) {
					//console.log(jj+"PERSONS  : "+persons.length);
					one();
					function one() 
					{
						var l = persons.shift();
						if (!l) 
						{
							console.log("DONE : "+jj);
							jdone[jj]=true;
							for (var i=0;i<tcount;i++) {
								if (!jdone[i])
									return;
							}
							console.log("DONE ALL!");
							onDone(0);
							return;
						}
						if (l%tcount != jj)
							return one();	
						
						// TODO REMOVE ME TES TEST TEST
						/*if (l != 236)
						{
							one();
							return;
						}*/
						
						//console.log(jj+" | GENERATING ENTRIES ("+nitems+") FOR PERSON : "+l);
						var arr=[];
						var last;
						
						var track = genTrack({
							  min: (etime-btime)/(10*1000),
							  max: (etime-btime)/(10*1000),
							  minSegmentLength: 0.2/64,
							  maxSegmentLength: 1.6/64,
							  curviness: .36,  
							  maxAngle: 150
					    });						
						for (var i=0;i<track.data.length;i++) 
						{
							var crr = {t : btime+i*10*1000,lon : track.data[i].x, lat : track.data[i].y, prev : last,dur : i*10*1000};
							arr.push(crr);
							prev=crr;
						}
						function oneT() {
							var el = arr.shift();
							if (!el) {
								console.log(jj+" | DONE PERSON "+l);
								one();
								return;
							}
							var t = el.t;
							var p = el;
			  	  			var spd = 0;
			  	  			var len = 0;
			  	  			if (el.prev) 
			  	  			{
			  	  				var pp = el.prev;
			  	  	  			len = WGS84SPHERE.haversineDistance([pp.lon,pp.lat],[p.lon,p.lat]) / 1000.0; // KM
			  	  	  			spd = len * 60*60*1000 / (p.t-pp.t);	// km / h
			  	  	  			if (isNaN(spd)) {
			  	  	  				spd=0.0;		//??? OK?!
			  	  	  			}
			  	  			}
			  	  			var rec = 
			  	  			{
			  	  				packetType : 1,
			  	  				t : t,
			  	  				lon : p.lon,
			  	  				lat : p.lat,
			  	  				alt : p.alt || 0,
			  	  				ls : 'u',			//UPLOAD
			  	  				sats : 0,			// ?
			  	  				hdop : 0,			// ?
			  	  				gsmSignal : 0, 	// ?
			  	  				battVolt : 0,		// ? 
			  	  				battPercent : 0, 	// ? 
			  	  				speedInKmh : spd,
			  	  				mileageSinceLastMsgInKm : len, 
			  	  				ecallActive : false,
			  	  				chargerActive : false,
			  	  				isRace : false,
			  	  				uptimeSystem : el.dur/1000/60, // minutes
			  	  				uptimeConnection : el.dur/1000/60, // minutes
			  	  				lastError : 0,
			  	  				errorCnt : 0,
			  	  				grp : l,			// placeholder (TODO?!)
			  	  				person : l
			  	  			};
			  	  			gps.savePositionInDB(rec,function(res) {
			  					if (res < 0) {
			  						log.error("Can not store position in DB!");
			  						onDone(-1);
			  					} else
			  						oneT();
			  				});
						}
						oneT();
					}
				});
			}
			return;
		}
		default :
			log.erro("Unknown <what> in LR gen!");
			onDone(-1);
			return;
	}
};

function genTrack(params) {
	  var track = new Object();
	  var min = params.min;
	  var max = params.max;
	  var minSegmentLength = params.minSegmentLength;
	  var maxSegmentLength = params.maxSegmentLength;
	  var curviness = params.curviness;
	  var maxAngle = params.maxAngle / 360 * Math.PI;
	  
	  track.data = new Array();
	  track.points = Math.random()*(max - min) + min;
	  
	  track.minX = 0;
	  track.minY = 0;
	  track.maxX = 0;
	  track.maxY = 0;
	  
	  track.data[0] = {x: 11.617602, y: 48.130851};
	  direction = 0;
	  
	  for(i = 1; i < track.points; i++) {
	    var len = Math.random()*(maxSegmentLength - minSegmentLength) + minSegmentLength;
	    var dx = Math.sin(direction) * len;
	    var dy = Math.cos(direction) * len;
	    var x = track.data[i-1].x + dx;
	    var y = track.data[i-1].y + dy;
	    track.data[i] = { x: x, y: y };
	    turn = Math.pow(Math.random(), 1 / curviness);
	    if(Math.random() < .5) turn = -turn;
	    direction += turn * maxAngle;
	  }
	  
	  // In the last quarter of the track, force the points progressively closer to the start.
	  q = Math.floor(track.points * .75);
	  c = track.points - q;
	  var x0 = track.data[0].x;
	  var y0 = track.data[0].y;
	  
	  for(i = q; i < track.points; i++) {
	    var x = track.data[i].x;
	    var y = track.data[i].y;
	    var a = i-q;
	    track.data[i].x = x0 * a/c + x * (1 - a/c);
	    track.data[i].y = y0 * a/c + y * (1 - a/c);
	  }
	  
	  for(i = 1; i < track.points; i++) {  
	    x = track.data[i].x;
	    y = track.data[i].y;
	    if(x < track.minX) track.minX = x;
	    if(y < track.minY) track.minY = y;
	    if(x > track.maxX) track.maxX = x;
	    if(y > track.maxY) track.maxY = y;
	    
	    track.minSize = Math.min(track.minX, track.minY);
	    track.maxSize = Math.max(track.maxX, track.maxY);
	  }
	  
	  return track;
}
