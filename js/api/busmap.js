var io = require("socket.io-client");
var discrete = require("../misc/discrete");
var UIConfig = require("../ui/Config");

var lastLogin = null;
var persons={};
var events={};
var chunks={};

var liveChunkTimeout = (UIConfig.cache.liveChunkTimeout || 10) *1000;	// server : 5, client : 10 (? OK)
var liveTileTimeout = (UIConfig.cache.liveTileTimeout || 10) *1000;	// server : 5, client : 10 (? OK)

module.exports = function(url,onConnected) 
{
	if (!url) 
		url=location.protocol+'//'+location.hostname+(location.port ? ':'+location.port:'');
	
	// SEQUENTIALIZE ACCESS (TODO : WHY?!?! )
	var _socket = io.connect(url);
	var _seq=0;

	// TODO REMOVE WAIT FOR ARUGMENT!
	function exec(operation,data,waitFor,onDone) 
	{
		var key="done-"+_seq;_seq++;
		data.__code=key;
		_socket.emit(operation,data);
		_socket.once(key,onDone);
	}

_socket.on("connect",onConnect);
	function onConnect() 
	{
		_socket.removeAllListeners();
		_socket.on("connect",onConnect);
		_seq=[];
		_working=false;
		//----------------------------------
		persons={};
		events={};
		chunks={};
		//-----------------------------------------------------------
		var api=
		{
			clearCache : function() {
				events={};persons={};chunks={};
			},
			storeLogin : function() {
				if (!lastLogin) {
					console.error("Not logged in!");
					return;
				}
				localStorage.setItem("busmap-login",JSON.stringify(lastLogin));
				console.log("Saved in localStorage : "+JSON.stringify(lastLogin));
			},
			login : function(username,password,onDone) {
				if (typeof window != "undefined")
					localStorage.removeItem("busmap-login");
				exec("login",{username:username,password:password},"done",function(res) {
					if (res && res.id) {
						fixPerson(api,res,function(r) {
							lastLogin={username:username,password:password};
							if (onDone)
								onDone(r);
						});
					} else {
						if (onDone)
							onDone(res);
					}
				});
			},
			//-----------------------------------------------------------
			event : 
			{
				/*getFullParticipantsInfo : function(id,onDone) {
					exec("getEventFullParticipantsInfo",{id:id},"done",function(res) {
						if (onDone)
							onDone(res);
					});
				},*/				
				listGroupsOrderBy : function (data,onDone) {
					exec("listGroupsOrderBy",data,"done",function(res) {
						if (onDone)
							onDone(res);
					});
				},	
				setGroupTimes : function (data,onDone) {
					exec("setGroupTimes",data,"done",function(res) {
						if (onDone)
							onDone(res);
					});
				},	

				listIds : function (data,onDone) {
					exec("listEventIds",data,"done",function(res) {
						if (onDone)
							onDone(res);
					});
				},
				getElapsedData : function (event,onDone) {
					exec("getEventElapsed",{event:event},"done",function(res) {
						if (onDone)
							onDone(res);
					});
				},
				
				byId : function (id,onDone) {
					if (events[id])
						return onDone(cloneObject(events[id]));
					exec("getEventById",{id:id},"done",function(res) {
						fixEvent(api,res,onDone);
					});
				},
				byCode : function (code,onDone) {
					exec("getEventByCode",{code:code},"done",function(res) {
						fixEvent(api,res,onDone);
					});
				},
				update : function (event,onDone) {
					var t={};
					for (var k in event) {
						var v = event[k];
						if (!v)
							continue;
						if (k == "owner") {
							if (v && v.id) 
								t.owner=v.id;
						} else if (k == "beginTime") {
							t.beginTime=v.getTime();
						} else if (k == "endTime") {
							t.endTime=v.getTime();
						} else if (v)
							t[k]=v;
					}
					exec("updateEvent",t,"done",function(res) {
						fixEvent(api,res,onDone);
					});
				},
				create : function (event,onDone) {
					var t={};
					for (var k in event) {
						var v = event[k];
						if (!v)
							continue;
						if (k == "owner") {
							if (v && v.id) 
								t.owner=v.id;
						} else if (k == "beginTime") {
							t.beginTime=v.getTime();
						} else if (k == "endTime") {
							t.endTime=v.getTime();
						} else if (v)
							t[k]=v;
					}
					exec("createEvent",t,"done",function(res) {
						fixEvent(api,res,onDone);
					});
				},
				remove : function (event,onDone) {
					if (event.id) {
						delete events[event.id];
						exec("deleteEvent",{id:event.id},"done",function(res) {
							if (onDone)
								onDone(res);
						});
					}
				},
				setParticipant : function(data,onDone) {
					exec("setEventParticipant",data,"done",onDone);
				},
				setFavorite : function(data,onDone) {
					exec("setEventFavorite",data,"done",onDone);
				}
			},
			person : 
			{
				listIds : function (data,onDone) {
					exec("listPersonIds",data,"done",function(res) {
						if (onDone)
							onDone(res);
					});
				},
				listIdsOrderBy : function (data,onDone) {
					exec("listPersonIdsOrderBy",data,"done",function(res) {
						if (onDone)
							onDone(res);
					});
				},	
				getInvitations : function(onDone) {
					exec("getInvitations",{},"done",function(res) {
						if (onDone)
							onDone(res);
					});
				},
				listClubs : function (data,onDone) {
					exec("listClubs",data,"done",function(res) {
						if (onDone)
							onDone(res);
					});
				},				
				byId : function (id,onDone) {
					if (persons[id]) {
						return onDone(cloneObject(persons[id]));
					}
					exec("getPersonById",{id:id},"done",function(res) {
						fixPerson(api,res,onDone);
					});
				},
				byUsername : function (username,onDone) {
					exec("getPersonByUsername",{username:username},"done",function(res) {
						fixPerson(api,res,onDone);
					});
				},
				byIdWithEventDetails : function (id,event,onDone) {
					exec("getPersonByIdWithEventDetails",{id:id,event:event},"done",function(res) {
						fixPerson(api,res,onDone);
					});
				},
				byCode : function (code,onDone) {
					exec("getPersonByCode",{code:code},"done",function(res) {
						fixPerson(api,res,onDone);
					});
				},
				update : function (person,onDone) {
					var t={};
					for (var k in person) {
						var v = person[k];
						if (!v)
							continue;
						if (k == "birthDate") {
							t.birthDate=v.getTime();
						} else if (v)
							t[k]=v;
					}
					exec("updatePerson",t,"done",function(res) {
						fixPerson(api,res,onDone);
					});
				},
				create : function (person,onDone) {
					var t={};
					for (var k in person) {
						var v = person[k];
						if (!v)
							continue;
						if (k == "birthDate") {
							t.birthDate=v.getTime();
						} else if (v)
							t[k]=v;
					}
					exec("createPerson",t,"done",function(res) {
						fixPerson(api,res,onDone);
					});
				},
				remove : function (person,onDone) {
					if (person.id) {
						delete persons[person.id];
						exec("deletePerson",{id:person.id},"done",function(res) {
							if (onDone)
								onDone(res);
						});
					}
				},
				/* RAW API : share_to,doRemove : true/false/null */ 
				shareLocation : function (share,onDone) {
					exec("shareLocation",share,"done",onDone);
				},
				setLocationVisibility : function (data,onDone) {
					exec("setLocationVisibility",data,"done",function(res) {
						tileCache.reset();
						onDone(res);
					}); 
				},
				acceptInvitation : function (data,onDone) {
					exec("acceptInvitation",data,"done",onDone);
				},
				removeInvitation : function (data,onDone) {
					exec("removeInvitation",data,"done",onDone);
				},
				listMissingPersons : function (onDone) {
					exec("listMissingPersons",{},"done",onDone);
				},
				getGPSLocationName : function (data,onDone) {
					exec("getGPSLocationName",data,"doneGPSLocation",onDone);			// TODO FIX ME SEQUENTIAL RESULTS (?!?! SOCKET.IO REQUESTS SHOULD BE SERIALIZED BY DEFAULT?!)
				},
				uploadGPXPositions : function(data,onDone) {
					exec("uploadGPXPositions",data,"done",onDone);
				},
				getPath : function(person,beginTime,endTime,tolerance) {
					exec("getPersonPath",{person:person,beginTime:beginTime,endTime:endTime,tolerance:tolerance},"done",onDone);
				}
			}, 
			discrete : {
				getChunk : function(event,person,level,chunk,onDone) {
					getDiscreteStorageChunk(exec,event,person,level,chunk,onDone);
				},
				getLocationTile : function(event,x,y,level,page,minlon,minlat,maxlon,maxlat,onDone) {
					//setTimeout(function() {
						getLocationTile(exec,event,x,y,level,page,minlon,minlat,maxlon,maxlat,onDone);
					//},2000);
				}
			}			
		};
		for (var i in discrete)
			api.discrete[i]=discrete[i];
		//-----------------------------------------------------------			
		_socket.on("onUpdateEvent",function(event) {
			if (event.id) 
			{
				var ex = events[event.id];
				if (!ex)
					return;
				fixEvent(api,event,function(data) {
					for (var e in ex)
						delete ex[e];					
					for (var e in data) 
					{
						if (e == "owner") {
							if (data.owner && data.owner.id)
								api.person.byId(data.owner.id,function(res) {
									if (res && res.id)
										ex.owner=res;
									else
										delete ex.owner;
								});
					    } else 
							ex[e]=data[e];
					}
				});
			}
		});
		_socket.on("onUpdatePerson",function(person) {
			if (person.id) {
				var ex = persons[person.id];
				if (!ex)
					return;
				fixPerson(api,person,function(data) {
					if (ex)
					{
						for (var e in ex)
							delete ex[e];
						for (var e in data)
							ex[e]=data[e];
					}
				});
			}
		});
		if (onConnected) 
			onConnected(api);
		//---------------------------------------------------
	}
};
//---------------------------------
if (typeof window != "undefined") {
	window.busMapApi=module.exports;
}
function fixEvent(api,res,onDone) {
	if (res.beginTime)
		res.beginTime=new Date(res.beginTime);
	if (res.endTime)
		res.endTime=new Date(res.endTime);
	if (res.owner) {
		api.person.byId(res.owner.id,function(r) {
			if (r && r.id)
				res.owner=r;
			else
				delete res.owner;
			if (res.id)
				events[res.id]=res;
			onDone(cloneObject(res));
		});
	} else {
		if (res.id)
			events[res.id]=res;
		onDone(cloneObject(res));
	}
}

function fixPerson(api,res,onDone) {
	if (res.birthDate)
		res.birthDate=new Date(res.birthDate);
	if (res.id) 
	{
		persons[res.id]=res;
		var alias="";
		if (res.firstName && res.firstName.length)
			alias+=res.firstName.toUpperCase()[0];
		if (res.lastName && res.lastName.length)
			alias+=res.lastName.toUpperCase()[0];
		if (alias == "")
			alias="#"+res.id;
		res.alias=alias;
	}
	onDone(cloneObject(res));
};

function cloneObject(person) {
	var k = {};
	for (i in person) 
	{
		var v = person[i];
		if (v instanceof Date)
			v = new Date(v);
		k[i]=v;
	}
	return k;
}

//----------------------------------------------------
// DISCRETE STORAGE 
//----------------------------------------------------
var maxChunks = UIConfig.cache.maxChunks || 1000;
var LRU = require("lru-cache");
var options = { max: maxChunks };
var cache = LRU(options);
var personTimestamps = {};	// DO WE NEED IT?
var disableCache = false; // DEBUG ONLY TO TRUE
//----------------------------------------------------
function getDiscreteStorageChunk(exec,event,person,level,chunk,onDone) {
	var intv = discrete.chunkToInterval(chunk,level);
	if (!intv  || !intv.isValid) {
		onDone({});
		return;
	}
	var key = (event?event:"")+":"+person+"-"+level+"-"+chunk;
	var ctime = (new Date()).getTime();
	var r = cache.get(key);
	function checkItem(r) {
		if (disableCache)
			return null;
		var ptsmp = personTimestamps[person] || 0;
		if (r.personTimestamp == ptsmp) 
		{
			if (!r.liveTimestamp || r.liveTimestamp >= ctime) {
				return r;
			} else if (r.liveTimestamp) {
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
	//------------------------------------------------------
	var dt = (new Date()).getTime();
	exec("getDiscreteChunk",{event:event,person:person,level:level,chunk:chunk},"doneGetChunk",function(res) 
	{
		if (res) 
		{
			res.personTimestamp=personTimestamps[person] || 0;
			if (intv.isLive)
				res.liveTimestamp=dt+liveChunkTimeout;
			cache.set(key,res);
		}
		onDone(res);
	});	
	//------------------------------------------------------
}
//-------------------------------------------------------------

var maxTiles = UIConfig.cache.maxTiles || 1000;
var tileCache = LRU({ max: maxTiles });

function getLocationTile(exec,event,x,y,level,page,minlon,minlat,maxlon,maxlat,onDone) {
	var intv = discrete.pageToInterval(page);
	if (!intv  || !intv.isValid) {
		onDone({});
		return;
	}
	// center in target projection is the key[-subpagex-supagey] 
	var c1 = ol.proj.transform([minlon,minlat],'EPSG:4326', 'EPSG:3857');
	var c2 = ol.proj.transform([maxlon,maxlat],'EPSG:4326', 'EPSG:3857');
	var kx = Math.round((c1[0]+c2[0])*50);
	var ky = Math.round((c1[1]+c2[1])*50);
	var key = kx+"/"+ky+"<"+page+":"+level+">"; 
	var ctime = (new Date()).getTime();
	var r = tileCache.get(key);
	function checkItem(r) {
		if (disableCache)
			return null;
		if (!r.liveTimestamp || r.liveTimestamp >= ctime) {
			return r;
		} else if (r.liveTimestamp) {
			tileCache.del(key); // timeout out
		}
		return null;
	}
	if (r) 
	{
		r=checkItem(r);
		if (r) 
			return onDone(r);
	}
	//------------------------------------------------------
	var dt = (new Date()).getTime();
	exec("getLocationPage",{event:event,x:x,y:y,page:page,level:level,minlon:minlon,minlat:minlat,maxlon:maxlon,maxlat:maxlat,key:key},"doneGetLocationPage",function(res) 
	{
		if (res) 
		{
			if (intv.isLive)
				res.liveTimestamp=dt+liveTileTimeout;
			tileCache.set(key,res);
		}
		onDone(res);
	});	
	//------------------------------------------------------
}
