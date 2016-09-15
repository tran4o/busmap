var log = require("../misc/log");
var inst = require("../conf/installation");
var moment = require("moment");
var driver = require("../db/driver");
var discrete = require("../misc/discrete");
var dstorage = require("../db/discreteStorage");
var dlocation = require("../db/discreteLocation");
var cnst = require("../conf/constants");
var authd = require("../misc/auth");
var persons = require("../db/persons");
var events = require("../db/events");

var CHECK_INTERVAL = 1000*60*1;// every 1 min check (TODO INST OPTION)
var lastEcallTimes = {};
exports.start = function(args,onDone) 
{
	if (!inst || !inst.json) {
		log.error("Installation not complete! Stopping");
		onDone(-1);
		return;
	}
	//-----------------------------------------------------------
	persons.basicLoadPersons(doConnect);
	function doConnect() 
	{
		log.error("gps NOT NEEDED ANYMORE!!!");
	}		
};

var saveQueue=[];
var doneHandlers=[];
var saving=false;
//-----------------------------------------------------------------------
exports.savePositionInDB = function(pmsg,onDone) 
{
	if (pmsg.imei)
	{
		var res = persons.getPersonBasicByImei(pmsg.imei); 
		if (!res) 
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
				// MISSING PERSON
				pgclient.query('UPDATE tracking.missing_person SET last_t=$1,lon=$2,lat=$3 WHERE imei=$4',[pmsg.t,pmsg.lon,pmsg.lat,pmsg.imei],function(err, result) 
				{
					if (done)
						done();
				    if(err) 
				    {
				      log.error('Error updating missing_person record in POSTGRE : ',err);
				      onDone(-1);
				      return;
				    }
				    if (result.rowCount == 0) 
				    {
				    	//console.log("ROW COUNT = 0 FOR"+pmsg.imei+" | "+pmsg.lon+" | "+pmsg.lat);
						pgclient.query('INSERT INTO tracking.missing_person(last_t,lon,lat,imei) VALUES ($1,$2,$3,$4)',[pmsg.t,pmsg.lon,pmsg.lat,pmsg.imei],function(err, result) 
						{
							if (done)
								done();
						    if(err) 
						    {
						    	log.error('Error inserting missing_person record into POSTGRE : ',err);
						    	onDone(-1);
						    	return;
						    }
						    onDone(0);
						});
				    } else {
					    onDone(0);
				    }
				});				
			});
		} else {
			delete pmsg.imei;
			pmsg.person=res.id;
			exports.savePositionInDB(pmsg,onDone);
			return;
		}
		return;
	}
	//-----------------------------------------------------------------------
	function fix(val) {
		if (val == undefined)
			return "null";
		if (typeof val == "boolean")
			return ""+val;
		if (typeof val == "number") {
			if (isNaN(val))
				return "null";
			return ""+val;
		}
		val=""+val;
		if (val.indexOf("'") < 0)
			return "'"+val+"'";
		val="'"+val.split("'").join("")+"'";
		return val;
	}
	
	// evsql = event sql 
	// elsql = elapsed ssql
	//var evsql = "(SELECT event from Q1)";
	//var elsql = "(SELECT elapsed from RES)";
	//var eltpos = "(SELECT tpos from RES)";
	
	var selGrp=pmsg.t;
	if (pmsg.isCheckGroup)
		selGrp="COALESCE((SELECT MAX(J.grp) FROM tracking.position AS J WHERE J.person = "+pmsg.person+" AND J.t >= "+(pmsg.t-cnst.signalTimeout*1000)+" AND J.t < "+pmsg.t+"),"+pmsg.t+")";
	else if (typeof pmsg.grp == "number") 
		selGrp=pmsg.grp;
	var gc = Math.floor((pmsg.t-cnst.timeOrigin)/(1000*cnst.locationStep));
	var rdata = "("+fix(pmsg.person)+","+fix(pmsg.packetType)+","+fix(pmsg.t)+",ST_MakePoint("+fix(pmsg.lon)+","+fix(pmsg.lat)+"),ST_MakePoint("+gc+","+gc+"),"+fix(pmsg.ls)+","+fix(pmsg.sats)+","+fix(pmsg.hdop)+","+fix(pmsg.speedInKmh)+","+
	 	fix(pmsg.gsmSignal)+","+fix(pmsg.ecallActive)+","+fix(pmsg.battVolt)+","+fix(pmsg.battPercent)+","+fix(pmsg.chargerActive)+","+fix(pmsg.isRace)+","+fix(pmsg.uptimeSystem)+","+fix(pmsg.alt || 0)+","+selGrp
	 	+","+fix(pmsg.lon)+","+fix(pmsg.lat)	 
	 	+","+fix(pmsg.direction)
	 	+","+fix(pmsg.gpsValid == undefined ? true : pmsg.gpsValid)
	 	+","+fix(pmsg.numberOfSteps || 0)
	 	+","+fix(pmsg.pulsRate)
	 	+","+fix(pmsg.temperature)
	 	+","+fix(pmsg.transmissionIntervallRate)
	 	+",(SELECT event FROM Q1)" // event 
	 	+")"; 
	//-------------------------------------------------------------------------------------
	var eview=events.getEventQuery(pmsg.t,pmsg.person);	
	var sql="WITH "+eview+"\n"
		   +",INP AS ( INSERT INTO tracking.position(person,packet_type,t,pos,geom_t,location_sensor,sats,hdop,speed_in_kmh,gsm_signal,ecall_active,batt_volt,batt_percent,charger_active,is_race,uptime_system,alt,grp,lon,lat,direction,gps_valid,number_of_steps,puls_rate,temperature,transmission_intervall_rate,event) VALUES "+rdata+" RETURNING event,person,t,pos,speed_in_kmh,hdop,alt)\n"
		   +events.getInterpolationQuery() // ,RES AS (...)
		   +" \nINSERT INTO tracking.position_soft(i,geom_i,person,event,pos,hdop,speed_in_kmh,alt,avail) (SELECT i,geom_i,person,event,pos,hdop,speed_in_kmh,alt,avail FROM RES ) RETURNING tracking.TRACKPOS(id)";	
	//console.log(sql+"\n");
	//----------------
	saveQueue.push(sql);
	doneHandlers.push(onDone);
	//console.log("SAVING : "+pmsg.person+" | "+pmsg.lon+" | "+pmsg.lat+" | "+pmsg.isRace+" | "+new Date(pmsg.t));
	if (!saving)
		flushQueue();
	function flushQueue() 
	{
		saving=true;
		var arr = saveQueue;
		var harr = doneHandlers;
		saveQueue=[];		
		doneHandlers=[];
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
			one();
			function one() 
			{
				var el = arr.shift();
				if (!el) {
				    if (saveQueue.length)
				    	flushQueue();
				    else 
				    	saving=false;
				    for (var i=0;i<harr.length;i++)
				    	harr[i](0);
				    return;
				}
				pgclient.query(el,[],function(err, result) 
				{
					if (done)
						done();
				    if(err) {
				    	log.error('Error inserting position record into POSTGRE : ',err);
				    }
				    one();
				});
			}
		});
	}
};



 
exports.uploadGPXPositions = function(auth,data,onDone) {

	if (!auth || !auth.id) {
		onDone(-1);
		return;
	}
	persons.getPersonById(authd.admin,auth.id,function(res) {
		if (res < 0 || !res.id || !auth || res.username != auth.username || res.password != auth.password || !res.imei || !res.imei.length) 
			onDone(-1);
		else {
			doWork(res,onDone);
		}
	});
	
	function doWork(person,onDone) 
	{
		var mint;
		var maxt;
		var arr=[];
		for (var e of data) {
			if (!mint || e.t < mint)
				mint=e.t;
			if (!maxt || e.t > maxt)
				maxt=e.t;
			delete e.imei;
			e.person=person.id;
			arr.push(e);
		}

		if (mint && maxt) 
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
				console.log("DELETE FROM tracking.position WHERE event IS NULL AND person = "+person.id+" AND t >= "+mint+" AND t <= "+maxt);
				pgclient.query('DELETE FROM tracking.position WHERE event IS NULL AND person = $1 AND t >= $2 AND t <= $3',[person.id,mint,maxt],function(err, result) 
				{
					if (done)
						done();
					if(err) 
					{
						log.error('Error inserting position record into POSTGRE : ',err);
					    onDone(-1);
					    return;
					}
					one();
				});
			});
		} else 
			one();
		//------------------------------------------------------------------------------------
		function one() 
		{
			var el = arr.shift();
			if (!el)
			{
				// SAVE DONE, CLEAR DISCRETE STORAGE NOW!
				var carr=[];
				for (var i = 0;i<cnst.resolutions.length;i++) {
					var vmint = discrete.timeToChunk(mint,i);
					var vmaxt = discrete.timeToChunk(maxt,i);
					if (vmint <= vmaxt)	//prevent infinite loop
						carr.push({level:i,min:vmint,max:vmaxt});
				}
				function oneClear() 
				{
					var tc=carr.shift();
					if (!tc) {
						onDone(0);
						return;
					}
					var p1 = discrete.timeToPage(discrete.chunkToInterval(tc.min,tc.level).min);
					var p2 = discrete.timeToPage(discrete.chunkToInterval(tc.max,tc.level).max);
					dstorage.clearChunks(auth.id,tc.level,tc.min,tc.max,function() {
						dlocation.clearPages(auth,p1,p2,oneClear);
					});
				}
				oneClear();
				return;
			}
			exports.savePositionInDB(el,function(res) {
				if (res < 0)
					onDone(-1);
				else
					one();
			});
		}
	}
}; 
//----------------------------------------------------
var timerDaily;
var oldM;
exports.checkDailyEvent=checkDailyEvent;
exports.resetDailyEventToday = function() {
	//console.log("RESET DAILY EVENT !!!!!");
	startDailyEvents(true);
};
exports.resetDailyEventOldStateCache = function() {
	//console.log("RESET DAILY CACHE !!!!!");
	startDailyEvents();
};

function startDailyEvents(isReset) 
{
	if (timerDaily) {
		clearTimeout(timerDaily);
	}
	oldM=undefined;
	timerDaily=undefined;
	if (inst && inst.json && inst.json.server && inst.json.server.disableDailyEventScheduler) {
		console.log("DISABLING DAILY EVENT SCHEDULER from installation's server.disableDailyEventScheduler!")
		return;
	}
	// cnst.maxDailyEventsHistory	
	function oneCheck() 
	{
		var crr = moment().format("DD.MM.YYYY");// hh:mm:ss");
		if (oldM == crr)
			return setTimeout(oneCheck,CHECK_INTERVAL);
		events.getDailyEvents(function(res) {
			var toDel=[]; 
			while (res.length > (cnst.maxDailyEventsHistory || 10)) {
				toDel.push(res.shift());
			}
			//----------------------------------------------------------
			function otd() {
				var a = toDel.shift();
				if (!a) 
					step2();
				else {
					events.deleteEvent(authd.admin,a,function() {
						otd();
					},true);			
				}
			}
			otd();
			//----------------------------------------------------------
			function step2() 
			{
				events.getEventByCode(authd.admin,"TEMPLATE",function(event) 
				{
					if (event) 
					{
						checkDailyEvent(event,crr,onDone,isReset);
					} else
						onDone();
				});
				function onDone() {
					oldM=crr;
					timerDaily=setTimeout(oneCheck,CHECK_INTERVAL); 
				}
			}
		});
	}
	//--------------------------------------------------------------
	oneCheck();
}

function checkDailyEvent(event,code,onDone,isDeleteOnExisting) 
{
	if (event.beginTime) {
		var t = new Date(event.beginTime);
		var c = new Date();
		c.setHours(t.getHours());
		c.setMinutes(t.getMinutes());
		c.setSeconds(0);
		c.setMilliseconds(0);
		event.beginTime=c;
	}
	if (event.endTime) {
		var t = new Date(event.endTime);
		var c = new Date();
		c.setHours(t.getHours());
		c.setMinutes(t.getMinutes());
		c.setSeconds(0);
		c.setMilliseconds(0);
		event.endTime=c;
	}
	events.getEventByCode(authd.admin,code,function(cevent) 
	{
		if (cevent && !cevent.id) 
		{
			// NOT EXISTING CLONING
			log.warn("Cloning event TEMPLATE to "+code);
			doIt();
		}  else {
			if (isDeleteOnExisting) {
				events.deleteEvent(authd.admin,cevent,function() {
					console.log("DELETED "+cevent.code);
					doIt();
				});			
			} else {
				onDone();
			}
		}
		function doIt() {
			events.cloneEvent(event.id,code,event.beginTime ? event.beginTime.getTime() : null,event.endTime ? event.endTime.getTime() : null,function() {
				console.log("DONE CLONING EVENT : "+code);
				onDone();
			}); 
		}
	});
}

//---------------------------------------------------