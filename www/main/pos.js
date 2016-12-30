(function () { angular.module('app').controller('PosCtrl', PosCtrl); function PosCtrl ($scope,$mdDialog,$mdMedia) {
//----------------------------------------------------------------------------------------------------------------
	var liveChunkTimeout = (UI.Config.cache.liveChunkTimeout || 10) *1000;	// server : 5, client : 10 (? OK)
	var liveTileTimeout = (UI.Config.cache.liveTileTimeout || 10) *1000;	// server : 5, client : 10 (? OK)
	var defColor = "rgba(0,0,0,0.45)";
	var defCenter = [11.617602,48.130851 ]; // MÜNCHEN TODO CHANGE
	var initialDate = (new Date().getTime())-UI.Config.timeouts.liveConsistencyDisplayOffset*1000;	//2 min // TODO ADD CONFIG
	var crrBus = undefined;
	var crrTimeDiscrete;
	var fwset={};
	var wset={};
	var watched=[];
	var pathByPerson={};
	var isDebugTiles = false;
	var isShowParticipants = false;
    var liveRefresh1;
    var liveRefresh2;
    var liveRefresh3;
    var elapsedData;
	var levent=undefined;
	var __prefix="location";
    var mode="stop";
    var GUI=undefined;
    // personID > timestamp(number)
    var toSelectAfterLoad = {};

    // TODO 1000 (1sec) config option
    
    var notifTimes={};
    var doNotNotify=true; // BUS MODE SKIP NOTIF
    var pendingNotif=false;
	function notification(person,ct,type,data,alias) 
	{
		if (notifTimes[person]) 
		{
			if (Math.abs(notifTimes[person]-ct) <= 1)
				return;
		} 
		notifTimes[person]=ct;
		// Let's check if the browser supports notifications
		if (!("Notification" in window)) {
			  doNotNotify=true;
			  return;
		}
		pendingNotif=true;
		if (Notification.permission === "granted")
		    doWork();
		else if (Notification.permission !== 'denied') {
		    Notification.requestPermission(function (permission) {
		    	if (permission === "granted")
		    		doWork();
		    	else 
		    		doNotNotify=true;
		    });
		} else {
			doNotNotify=true;
			return;
		}
		function doWork() 
		{
			  var p = getPartInfoFromEvent(person)
			  if (!p)
				  return;
			  pendingNotif=false;
			  var body="";
			  if (type == "reached-km")
				  body="reached "+data.km+"km";
			  else if (type == "overrun") 
				  body="Jumped to ";
			  var arr=[];
			  if (data.ovr) 
				  arr.push("#OVR "+data.ovr);
			  if (data.grp) 
				  arr.push("#GRP "+data.grp);
			  if (data.gen)
				  arr.push("#GEN "+data.gen);
			  body+=arr.join(" ");
			  var notification = new Notification(p.first_name+" "+p.last_name,{
				 body : body,
				 icon :  p.image || (p.gender == "M" ? "src='images/missing-male.png'" : "src='images/missing-female.png'")
			  });
			  notification.onclick = function () {
				  $scope.$apply(function() {
					  $scope.selectParticipant(p);
					  window.focus();
				  });
			  };
			  setTimeout(function() {
				  try {
					  notification.close();
				  } catch(e) {}
			  },4500);
		}
	}

	function rgbaToColor(color) {
		if (color == undefined)
			return undefined;
		var res = "rgba("+((color >> 24)&255)+","+((color >> 16) & 255)+","+((color >> 8)&255)+","+(color&255)/255.0+")";
		return res;
	}
	
	$scope.graphMode = "speed";
    $scope.slickConfig = { enabled: true };
    $scope.speed = 1;
  
	function fixVal(val) 
	{
		if (val == undefined)
			return val;
		if (val === true)
			return 1;
		if (val === false)
			return 0;
		if (typeof val == "string")
			return val.charCodeAt(0);
		if (typeof val == "number")
			return val;
		return null;
	}
	//-----------------------------------------------
	var timeline;
	var json={};
	//-----------------------------------------------
	var params={};
	//-----------------------------------------------
	if (params["debug"] && params["debug"] != "0") {
	    console.warn("GOING TO DEBUG MODE...");
	    UI.Config.timeouts.animationFrame = 4; // 4 sec
	}
	if (params["show"] && params["show"] != "0") {
	    console.warn("GOING TO SHOW MODE...");
	    UI.Config.appearance.debug = 1;
	}    
	//-----------------------------------------------
	if (params["simple"] && params["simple"] != "0") {
	    console.warn("GOING TO SIMPLE MODE...");
	    UI.Config.settings.noMiddleWare = 1;
	    UI.Config.settings.noInterpolation = 1;
	}
	//-----------------------------------------------
	if (mobileAndTabletCheck())
		$("body").addClass("mobile");
	//--------------------------------------------------------------
	$scope.init=function(eventId) {
	    if (eventId)
			__prefix="play-"+eventId;
		//-------------------------------------------------------------
		onLiveLankBoot(function(isDirect) {
			onLRBoot(isDirect,eventId);
		});
	};
	

	$scope.setDoNotNotify = function(val) {
		doNotNotify=val;
    	localStorage.setItem("doNotNotify",val);
	};
	
	$scope.addFav = function(id,filteredParticipants) {
		if (!$scope.participants) 
			return;
		var k = (filteredParticipants||$scope.participants);
		for (var i in k) if (!id || k[i].id == id) 
			k[i].selected=true;
		saveFavs();
	};
	
	$scope.updateFav = function(id) {
		if (!$scope.participants) 
			return;		
		saveFavs();
	};

	$scope.removeFav = function(id,filteredParticipants) {
		if (!$scope.participants) 
			return;
		var k = (filteredParticipants||$scope.participants);
		for (var i in k) if (!id || k[i].id == id) {
			if (GUI && GUI.selectedParticipant1 && GUI.selectedParticipant1.id == k[i].id)
				GUI.setSelectedParticipant1(null);
			if (GUI && GUI.selectedParticipant2 && GUI.selectedParticipant2.id == k[i].id)
				GUI.setSelectedParticipant2(null);
			k[i].selected=false;
		}
		saveFavs();
	};

	var _softVisMap=undefined;	
	function saveFavs() {
		if (!$scope.participants) 
			return;
		var m = {};
		for (var i in $scope.participants) if (!$scope.participants[i].selected) 
			m[$scope.participants[i].id]=1;
		localStorage.setItem(__prefix+"-fav-hidden",JSON.stringify(m));
		_softVisMap=undefined;
		if ($scope.recalculateWatched) 
			$scope.recalculateWatched();
		if (GUI && GUI.map)
        	GUI.map.render();
	}
	
    $scope.onFavSelectedChange = function() {
    	_softVisMap=undefined;
    };

    var _partInfoEvent = undefined;
	function getPartInfoFromEvent(id) 
	{
		if (!_partInfoEvent) 
		{
			_partInfoEvent={};
			for (var i in $scope.participants) 
				_partInfoEvent[$scope.participants[i].id]=$scope.participants[i];
		}
		return _partInfoEvent[id];
	}

	function isForceParticipantHidden(id) {
		// TODO FIX ME ?!? MIGRATION FROM LR > BM
		if (0 == 0)
			return false;
		
		if (!_softVisMap) 
		{
			_softVisMap={};
			for (var i in $scope.participants) if ($scope.participants[i].selected) 
				_softVisMap[$scope.participants[i].id]=$scope.participants[i];
		}
		return !_softVisMap[id];
	}

	function onLRBoot(isDirect,eventId) 
	{
		function loadLocalState(event) 
		{
		    var t = localStorage.getItem(__prefix+"-state");
		    if (t) 
		    {
		    	try {
		    		json=JSON.parse(t);
		    	} catch(e) {}
		    	if (json) 
		    	{
		        	if (json.graphMode)
		        		$scope.graphMode=json.graphMode;
		        	if (json.minY !== undefined)
		        		yScale.min=json.minY;
		        	if (json.maxY !== undefined)
		        		yScale.max=json.maxY;
		    	}
		    }
        	var t = (new Date()).getTime();
        	if (!event || !(t >= event.beginTime && t <= event.endTime)) {
	        	if (json.crrt)
	        		initialDate=json.crrt;
        	} else {
        		mode = "play";
        		//PLAYINGGG
        	}
		}
		
		var where=["shared_locations","onlyVisible"];
		var events=[];
		if (eventId == undefined) {
			loadLocalState();
			LR.event.listIds({filter:$scope.eventFilter,selectFavorite:true},function(res) 
			{
				  one();
				  function one() 
				  {
					  var d = res.shift();
					  if (!d) 
						  return onBoot();
					  var e = d.id;
					  var fav = d.favorite;
					  LR.event.byId(e,function(res) {
						  events.push(res);
						  one();
					  });
				  }
			});
		} else {
			if (eventId == 0) {
				var crr = moment().format("DD.MM.YYYY");// hh:mm:ss");
				LR.event.byCode(crr,function(res) {
					if (!res || !res.id) {
						alert("Daily event not found!");
						window.location.href="/www/";
					}
					eventId=res.id;
					cntW();
				});
				return;
			} else {
				cntW();
			}
			function cntW() 
			{
				LR.event.byId(eventId,function(res) {
					if (!res || !res.id) {
						alert("Error loading event!");
						return;
					}
					levent=res;
					loadLocalState(res);
					if (levent.beginTime) 
					{
			        	var b1 = (initialDate && levent.beginTime && initialDate >= levent.beginTime.getTime());
			        	var b2 = (initialDate && levent.endTime && initialDate <= levent.endTime.getTime());
			        	if (!b1 || !b2)
			        		initialDate=levent.beginTime.getTime();
					}
					//events.push(levent);
					//------------------------------------------------------------------------------------------------------------------
					LR.person.listIdsOrderBy({joined:true,event:levent.id,orderBy : "type,startPos",page:0,where:["invited"]},function(res) {
						$scope.$apply(function() {
							
							var favsh = localStorage.getItem(__prefix+"-fav-hidden");
							if (favsh) {
								try {
									favsh=JSON.parse(favsh);
								}catch (e) {favsh=null};
							} else {
								// NEW DEFAULT VISIBILITY ONLY PROS
								favsh={};
								for (var e in res) {
									if (res[e].type != "PRO") {
										favsh[res[e].id]=1;
									}
								}
							}
	        				$scope.participantsLoaded=true;
	        				$scope.participants=res;
	        				if (res && res.length) 
	        				{
	            				for (var i=0;i<res.length;i++) {
	            					var p = res[i];
	            					p.selected=!favsh || !favsh[p.id];
	            					if (typeof window.crrBus != "number" && p.imei == $scope.crrBus) {
	            						window.crrBus=crrBus=p.id;
	            					}
	            				}
	        				}
	        				($scope.$parent.onParticipantsLoaded && $scope.$parent.onParticipantsLoaded(res)); 
	        				calcToolbarScroll();
						});
						/*LR.event.getElapsedData(levent.id,function(res){
							if (res && res.length)
								elapsedData=res;
							onBoot();
						});*/
						onBoot();
					});
				});
			}
		}

		function calcToolbarScroll() {
    		$scope.slickConfig.slidesToScroll=Math.ceil($(".persons-toolbar").width()/100/2);	        		 
    	}
		
		function onBoot()
		{
			// TODO OPTIMIZE (!!)				
			var track;
	        if (levent && levent.track && levent.track.length && (levent.track[0] || levent.track[1] || levent.track[2])) {
				track = new Track();
				track.swimCount = levent.swimCount || 1;
				track.bikeCount = levent.bikeCount || 1;
				track.runCount = levent.runCount || 1;
				track.route = levent.track;
	        }
	        var trackLength = track.getTrackLength();
			GUI = new Gui({track:track, isSkipExtent : levent == undefined, initialZoom : 9,isEventMode : levent != undefined });
			GUI.getIsWatched = function(pid) {
				/* BUSMODE TODO REWRITE */ 
				return true;
				//return wset[pid];
			};
			GUI.getCrrTime=function() {
				return timeline.getCustomTime("crr").getTime();
			};
			GUI.target="location-map";			
	        GUI.init();
	        //------------------------------------------------
	        // INITIAL FULLSCREEN?

	        $("body").addClass("fullscreen");
	        GUI.map.updateSize();

	        // ROTATION ROTATION ROTATION
	        GUI.map.getView().setRotation(Math.PI/2);
	      
	        
	    	//$(".btn-fullscreen").click();

	        //------------------------------------------------
			if (track) 
				GUI.zoomToTrack();

			if (elapsedData) 
			{
				for (var i in elapsedData) 
				{
					var e = elapsedData[i];
					var g = new ol.geom.Point(ol.proj.transform([e.lon,e.lat],'EPSG:4326','EPSG:3857'));
					var f = new ol.Feature(g); 
					GUI.elapsedLayer.getSource().addFeature(f);
				}
			}
	        //------------------------------------------------
			if (!levent) {
		        var ext = localStorage.getItem(__prefix+"-extent");
		        if (ext) 
		        {
		        	try {
		        		ext=JSON.parse(ext);
			    	    GUI.map.getView().fit(ext,GUI.map.getSize());	        			
		        	} catch(e) {
		        		exp=undefined;
		        	}
		        }
			}
	        //------------------------------------------------
	        GUI.onTrackClick=doGUIUpdate;
	        //---------------------------------------------
	        var participantsCache = {};
	        var lastProxiesResolution;
	        var proxiesCache={};
	        var nextAnimFrame;
	        GUI.participantsCache=participantsCache;
	        GUI.proxiesCache=proxiesCache;
	        //---------------------------------------------
	        if (isDebugTiles)
	        GUI.map.addLayer(
		        new ol.layer.Tile({
		            source: new ol.source.TileDebug({
		              projection: 'EPSG:3857',
		              tileGrid: ol.tilegrid.createXYZ({})
		            })
		          })
	        );
	        //---------------------------------------------------------
	        if (levent && levent.pois) 
	        {
	        	
	        	  $scope.pois = {};
	        	  for (var i in levent.pois) if (levent.pois[i].code)
	        		  $scope.pois[i]=levent.pois[i];
	        	  var m={};
	        	  for (var i in $scope.pois) {
	        		  var p = $scope.pois[i];
	        		  m[p.code]={elapsed:parseFloat(i),code:p.code,name:p.name,image:p.image};
	        	  }
	        	  $scope.$apply(function() {
		        	  $scope.poiByCode = m;
	        	  });
	        	  
	              var source = GUI.elapsedLayer.getSource();
				  for (var i in levent.pois) 
				  {
					  var p = levent.pois[i];
					  var pr = track.getPositionAndRotationFromElapsed(p.elapsed);
					  var mpos = ol.proj.transform([pr[0],pr[1]], 'EPSG:4326', 'EPSG:3857');
					  var feature = new ol.Feature(new ol.geom.Point(mpos));
					  feature.name=p.name;
					  feature.elapsed=p.elapsed;
					  feature.data=p;
					  feature.getIcon=function(elapsed) {
						if (levent.pois && levent.pois[elapsed] ) {
							return levent.pois[elapsed];
						}
						return null;
					  };
					  source.addFeature(feature);
				  }
	        }
	        //---------------------------------------------
	        var seq0=0;
	        var oldRange;
	        var currentTiles=[];
			var refTimeout;
			var oldKey;
	        function refreshLocationData(onDone) 
	        {
	        	var added2={};
				var done1={};
				var done2={};
				
				seq0++;
	        	var seq = seq0;
	        	
	        	var ctime = timeline.getCustomTime("crr").getTime();
	        	var page = LR.discrete.timeToPage(ctime);
	        	var ofs = LR.discrete.timeToOffset(ctime);
	        	//console.log("REFRESH "+page+" | "+ofs);
	        	var arr=currentTiles.slice();
	        	var loc1={};
	        	var loc2={};
	        	var level = arr.length ? arr[0].level : 0;
				var toAddPart = [];
	        	oneRR();
	        	function oneRR() 
	        	{
	        		if (seq0 != seq)
	        			return cleanup(true);
	        		var el = arr.shift();
	        		if (!el) 
	        		{
    					ctime = timeline.getCustomTime("crr").getTime();
    		        	page = LR.discrete.timeToPage(ctime);
    		        	ofs = LR.discrete.timeToOffsetReal(ctime);
						for (var i in proxiesCache) {
							if (!done2[i])
		    					removeProxy(i);
							else
				        		interpolateProxy(i,page,ofs);
						}
						var toDel=[];
						for (var i=0;i<toAddPart.length;i++) {
							addParticipant(toAddPart[i]);
						}
						for (var i in participantsCache) if (!done1[i])
	    					removeParticipant(i);
						else {					
							showParticipant(i);
							participantsCache[i].loc.__done=1;	//finished loading!
							interpolateParticipant(i,page,ofs);
							var prt = participantsCache[i];
							if (!prt.isVisible && prt.opacity < 0.01)
								toDel.push(i);
						}
						
						var ss={};
						if (GUI.selectedParticipant1)
							ss[GUI.selectedParticipant1.id]=1;
						if (GUI.selectedParticipant2)
							ss[GUI.selectedParticipant2.id]=1;
						for (var i=0;i<toDel.length;i++) {
							var kks=toDel[i]; 
							if (!ss[kks])
								delete participantsCache[kks];
							doLocAnimation=true;
						}
	        			return;
	        		}
	        		function cleanup(terminated) {	        				
        				if (!terminated) {
        					if (onDone)
	        					onDone();
            	        	doInterpolate();
        		        	GUI.map.render();
        				} 
	        		}
    				// LOAD
	        		//------------------------------------------------------------------------
	        		LR.discrete.getLocationTile(levent ? levent.id : null,el.x,el.y,el.level,page,el.coords[0],el.coords[1],el.coords[2],el.coords[3],function(res) {
    					var intvl = LR.discrete.pageToInterval(page);    				
    					dataAvail(res,el.coords);
    					if (intvl.isLive) 
    					{
    						if (!liveRefresh3) 
    						{
    							liveRefresh3=setTimeout(function() {
			        					//console.log("REFRESH LOCATION PAGE! "+new Date());
			        					liveRefresh3=undefined;
			        					refreshLocationData(function() {});
			        			},liveChunkTimeout/2-250 /* live refresh time TODO TODO TODO!!! */);
			        		}
    					}
    					// PRECACHE ONLY
    					setTimeout(function() {
        					if (seq0 == seq) {
        						LR.discrete.getLocationTile(levent ? levent.id : null,el.x,el.y,el.level,page+1,el.coords[0],el.coords[1],el.coords[2],el.coords[3],function(res) {});
        					} 
    					},700);
    				});
	        		function dataAvail(_res,coords) 
	        		{
    					//console.log(_res);
	        			if (seq0 != seq) {
    						cleanup(true);
    						return;
    					}
    					if (!_res.res || !_res.res.length) {
    						oneRR();
    						return;
    					}
    					var res = _res.res;
    					var pdata = _res.pdata;
    					var tdone1 = {};
    					var tdone2 = {};
    					for (var i=0;i<res.length;i++) 
    					{
							var v = res[i];
							if (v.persons) 
							{
								for (var j=0;j<v.persons.length;j++)   
								{
									var r = v.persons[j];
									var p = r.person;
									if (!loc1[p])
										loc1[p]={};
									var tarr = loc1[p]; 
									//------------------------------
									tarr[page*UI.Config.location.pageSize+r.i]=[r.lon,r.lat,v.i,r.elapsed,r.avail,r.ovrrnk,r.grprnk,r.genrnk];
									//console.log(r);
									//------------------------------
									if (!done1[p] || !participantsCache[p]) 
									{
										tdone1[p]=true;
										var pd;
										if (levent) {
											pd = getPartInfoFromEvent(p);
											if (pd) { 
												pd={code:pd.alias,country:pd.nationality,color:pd.color};
											} 
											//console.log(pd); // WHY UNDEFINED TODO TEEEEEEEEEEST
										} else {
											pd= pdata[p];
										}
										if (!pd) {
											pd={code:'??'};
										}
										if (levent) {
											// SINGLE TILE
											toAddPart.push({id:p,code:pd.code,country:pd.nat,color:pd.color,loc:tarr,page:page,seq:seq});
										} else {
											// OLD BUG GOOD FOR LOCATION TO BE TESTED AGAIN
											addParticipant({id:p,code:pd.code,country:pd.nat,color:pd.color,loc:tarr,page:page,seq:seq});
										}
									}
									done1[r.person]=tarr;
								}
							}
							if (v.groups) 
							{
								for (var j=0;j<v.groups.length;j++) 
								{
									var r = v.groups[j];
									var key = r.key;
									var i1 = key.indexOf("<");
									var i2 = key.indexOf(">");
									key = key.substring(0,i1)+key.substring(i2+1);
									if (added2[key])
										continue;
									if (!loc2[key]) 
										loc2[key]=[];
									var tarr=loc2[key];
									tarr.push([v.i,r.minlon,r.minlat,r.maxlon,r.maxlat,r.cnt]);
									if (!done2[key] || !proxiesCache[key]) {
										tdone2[key]=true;
										addProxy(r.cnt,loc2[key],key,page,seq,coords,r.bbox,el.level);									
									}
									// INITIAL INTERPOLATE
									done2[key]=tarr;
									tarr.__sorted=false;
								}
							}
    					}
    					
    					// OPTIMIZATION , draw partial loaded (only for NOT single tile)
    					if (!levent)
    						GUI.map.render();
    					//--------------------------------------------------
						for (var j in tdone2) 
							added2[j]=1;
    					oneRR();    					
    				}
	        	}
	        }
	        //-----------------------------------------------------------
	        var tileGrid = GUI.map.tileSource.getTileGrid();
	        var mview = GUI.map.getView();
	        GUI.tileGrid=tileGrid;
	        GUI.getTileKeyFromPosition = 
	        function() 
	        {
		        var oldZ;
		        var resolution;
		        var scale,origin,tileSize;
		        var origin,z;
		        // pos is in ETSG 3857 (map coordinates)
		        return function(x,y,z) {
		        	if (z != oldZ) {
		        		oldZ=z;
			        	origin=tileGrid.getOrigin(z);
			        	resolution=tileGrid.getResolution(z);
			        	tileSize = ol.size.toSize(tileGrid.getTileSize(z));
		        	}
		        	var jx = Math.floor((x - origin[0]) / (resolution * tileSize[0]) * 2);
		        	var jy = Math.floor((y - origin[1]) / (resolution * tileSize[1]) * 2);
		        	var tileCoordX = Math.floor(jx/2);
		        	var tileCoordY = Math.floor(jy/2);
		        	var ofsX = jx-tileCoordX*2;
		        	var ofsY = jy-tileCoordY*2;		        	
		        	// key used in liverank.sj getLocationTile
		        	var kx = Math.round(((tileCoordX+0.5)*resolution*tileSize[0]+origin[0])*100); 
		        	var ky = Math.round(((tileCoordY+0.5)*resolution*tileSize[1]+origin[1])*100); 
		        	var key = kx+"/"+ky;		     
		        	return [key,key+"-"+ofsX+"-"+ofsY];
		        };
	        }();
	        //-----------------------------------------------------------
	        GUI.map.on('moveend', function(event) {
	        	var tileExtent = function(tileCoord){
	        	    var z = tileCoord[0];
	        	    var x = tileCoord[1];
	        	    var y = tileCoord[2];
	        	    var tileGridOrigin = tileGrid.getOrigin(z);
	        	    var tileSizeAtResolution = tileGrid.getTileSize(z) * tileGrid.getResolution(z);
	        	    var ext = [
	        	        tileGridOrigin[0] + tileSizeAtResolution * x,
	        	        tileGridOrigin[1] + tileSizeAtResolution * y,
	        	        tileGridOrigin[0] + tileSizeAtResolution * (x + 1),
	        	        tileGridOrigin[1] + tileSizeAtResolution * (y + 1)
	        	    ];
	        	    ext = ol.proj.transformExtent(ext,'EPSG:3857','EPSG:4326')
	        	    return ext;
	        	};
				var crrt = timeline.getCustomTime("crr").getTime(); // TODO CHECK?!?!
	        	var page = LR.discrete.timeToPage(crrt);
	        	var ofs = LR.discrete.timeToOffset(crrt);
	        	//console.log("PAGE "+page+" | OFS "+ofs);
	        	var partAdd = [];
	        	var proxAdd = [];
	        	currentTiles=[];
	        	
	        	// NEW > KICK EVENT MODE TILE FUNCTION	        	
	        	if (!levent) 
	        	{
		        	if (event && event.frameState && event.frameState.usedTiles) 
		        	{	        		
		        		for (var a in event.frameState.usedTiles) for (var b in event.frameState.usedTiles[a]) 
		        		{
	        				var rng = event.frameState.usedTiles[a][b];
	        	        	for (var x=rng.minX||rng.b;x<=(rng.maxX||rng.a);x++) 
	        	        	{
		        	        	for (var y=rng.minY||rng.g;y<=(rng.maxY||rng.f);y++) 
		        	        	{
			        				var coords = tileExtent([b,x,y]);
			        				currentTiles.push({x:x,y:y,coords:coords,level:parseInt(b),page:page,ofs:ofs});
		        	        	} 
	        	        	} 
		        		}
		        	}
	        	} else {
    				currentTiles.push({x:0,y:0,coords:[0,0,1,1],level:0,page:page,ofs:ofs});
	        	}
    	        oldOfsd=oldPage=oldOfs=oldPage2;undefined;
	        	onChange();
	        });

	        //---------------------------------------------
	        $scope.$apply(function() {
	        	$(window).unbind("resize",calcToolbarScroll);
	        	$(window).resize(function() {
	        		$scope.$apply(calcToolbarScroll);
	        	});
	        	loadWatchedSettings();
	        });
	        var container = document.getElementById('vis');	        
	        // Create a DataSet (allows two way data-binding)
	        var arr=[];
	        for (var k in events) 
	        {
	        	var e = events[k];
	        	if (e.beginTime && e.endTime && e.beginTime.getTime() < e.endTime.getTime()) {
	        		arr.push({id : e.id,content : (e.name || e.code)+(e.description ? e.description : ""), start : e.beginTime , end : e.endTime, type : "background"});
	        	}
	        }
	        //------------------------------------
	        var yScale={};
	        var graphItems = [];
	        var gdset = new vis.DataSet(graphItems);
	        var goptions = 
	        {
	        		sampling : false,
	        		showCurrentTime : false,
	        	    height : "100%",
	        	    legend: false,
	        	    dataAxis : 
	        	    {
	        	    	visible : false
	        	    	,left : 
	        	    	{
	        	    		/*range : 
	        	    		{
	        	    		}*/
	        	    	}
	        	    },
	        		drawPoints : false,
	        		moveable : false,
	        		zoomable : false,
	        		interpolation : {
	        			enabled : false 
	        		}	        			
	        };
	        var groups = new vis.DataSet([]);
	        var graph = new vis.Graph2d($("#graph")[0], gdset, groups,goptions);
	        //------------------------------------
	        
	        var items = new vis.DataSet(arr);
	        // Configuration for the Timeline
	        var options = {
	        	showCurrentTime: false,
	        	start:levent && levent.beginTime ? levent.beginTime : (new Date()).getTime()-60*60*1000*24,
	        	end:levent && levent.endTime ? levent.endTime : (new Date().getTime())+15*60*1000,
	        	height : "100%"
	        	//stack : false
	        	//start: new Date((new Date().getTime())-UI.Config.times.defaultShowIntervalInMunutes*60*1000/2) ,
	        	//end: new Date((new Date().getTime())+UI.Config.times.defaultShowIntervalInMunutes*60*1000/2)
	        	//,zoomMax : 31536000000/365*3 
	        };
        	if (levent && levent.beginTime) 
        		options.min=levent.beginTime;
        	if (levent && levent.endTime) 
        		options.max=levent.endTime;

	        // Create a Timeline
	        timeline = new vis.Timeline(container, items, options);
	        timeline.addCustomTime(initialDate,"crr");
	        setCurrentTime(initialDate);
	        timeline.addCustomTime(new Date(),"now");	        
	        var yRange={};
	        if (levent && levent.beginTime && levent.endTime) {
	        	timeline.setWindow(levent.beginTime,levent.endTime,{animation:false});
	        }
	        // timechanged?
	        timeline.on('timechange', function() {
	        	onChangeSoft(); 
	        });
	        timeline.on('timechanged', function() {
	        	onChangeSoft(); 
	        });
	        timeline.on("click",function(params) {
	        	setCurrentTime(params.time);
	        	onChange(); 
	        });
	        function setCurrentTime(time) {
	        	timeline.setCustomTime(time,"crr");
	        	var html=moment(time+UI.Config.timeouts.liveConsistencyDisplayOffset*1000).format("HH:mm:ss")+"";
	        	var sel=$("#crrt-timer");
	        	if (sel && sel.length && sel[0].innerHTML != html) {
	        		sel[0].innerHTML=html;
	        	}
	        }
	        var softChangeTimer;
	        function onChangeSoft() 
	        {
	        	if (softChangeTimer)
	        		clearTimeout(softChangeTimer);
	        	softChangeTimer=setTimeout(function() {
	        		softChangeTimer=undefined;
	        		onChange();
	        	},35);
	        }
	        //----------------------------------------
	        var oldLevel;
	        var oldFirstChunk;
	        var oldLastChunk;
	        var oldFirstPathChunk;
	        var oldLastPathChunk;

	        var refreshDataEntry;
	        var refreshHndlr;
	        var refreshPathHndlr;
	        var graphItemsByPerson={};

	        function getRawGraphValue(ctime,person,pro) 
	        {
	        	var x1,x2;
	        	var y1,y2;
	        	if (!graphItemsByPerson[person])
	        		return undefined;
	        	graphItemsByPerson[person].forEach(function (item) 
	        	{
	        		if (item.x <= ctime && (x1 == undefined || x1 < item.x)) {
	        			x1=item.x;
	        			y1=item[pro];
	        		}
	        		if (item.x >= ctime && x2 == undefined) {
	        			x2=item.x;
	        			y2=item[pro];
	        		}
	        	});
	        	if (x1 != undefined && x2 != undefined) {
	        		if (x2 == x1)
	        			return y1;
	        		return y1+(y2-y1)*(ctime-x1)/(x2-x1);
	        	}
	        	return undefined;
	        }
	        
	        // GET GRAPH VALUE
	        function getGraphValue(person,mode) {
	        	var ctime = timeline.getCustomTime("crr").getTime();
		        var dt = UI.Config.graph.modes[mode];
	        	return getRawGraphValue(ctime,person,dt.pro);
	        }
	        GUI.getGraphValue=getGraphValue;
	        function getFormattedGraphValue(person,mode) {
	        	if (!mode) 
	        		mode=$scope.graphMode;
		        var dt = UI.Config.graph.modes[mode];
		        var m = dt.multiply ? dt.multiply : 1;
		        var v;
		        if (m == "trackLen" && !track)
		        	return "-";
			    if (m == "trackLen")
			    	v=getGraphValue(person,mode)*track.getTrackLength()/1000;
			    else 
			    	v=getGraphValue(person,mode)*m;
			    var tv = Math.round(fixVal(v)*100);
		        if (isNaN(tv))
		        	return "-";
		        return tv/100+(dt.unit ? " "+dt.unit : "");
	        }
	        $scope.getGraphMultiplier = function() {
        		var mode=$scope.graphMode;
		        var dt = UI.Config.graph.modes[mode];
		        var m = dt.multiply ? dt.multiply : 1;
	        	return m;
	        };
	        
	        function replaceGraphs() 
	        {		        	
	        	refreshHndlr=undefined;
	        	if (isFullScreen() || oldLevel == undefined || !$scope.watched || !$scope.watched.length) {
	        		gdset.clear();
	        		groups.clear();
	        		return;
	        	}
	        	var level=oldLevel;
	        	var firstChunk=oldFirstChunk;
	        	var lastChunk=oldLastChunk;
	        	var nitems=[];
	        	var pparr = $scope.watched.slice();
	        	var parts={};
	        	graphItemsByPerson={};
	        	function onePart() {
	        		if (refreshHndlr)
	        			return; 
	        		var p = pparr.shift();
	        		if (!p) 
	        		{
		        		//----------------------
			        	var ngroups=[];
			        	var aseq = 0;
			        	for (var i=0;i<nitems.length;i++) 
			        	{
			        		var nni=nitems[i];
			        		/* TODO ESCAPE NOT HARDCODED */
			        		if (!i || nni.person != nitems[i-1].person || (nni.grp != nitems[i-1].grp && $scope.graphMode != "avail") ) {
			        			var p = parts[nni.person];
			        			aseq++;
			        			ngroups.push({
			    		            id: aseq,
			    		            className : "graph-line",
			    		            style:'stroke:'+(p.color || "rgba(0,0,0,0.5)")
			        			});
			        		}
			        		nni.group=aseq;
			        		if (!graphItemsByPerson[nni.person])
			        			graphItemsByPerson[nni.person]=[];
			        		graphItemsByPerson[nni.person].push(nni.data);
			        		delete nni.data;
			        	}
			        	fitY(nitems);
		        		gdset.clear();
		        		groups.clear();
		        		groups.add(ngroups);
		        		gdset.add(nitems);
		        		refreshWatchedHTMLData();
		        		return;
	        		}
	        		parts[p.id]=p;
		        	var arr=[];
		        	for (var chunk=firstChunk-1;chunk<=lastChunk+1;chunk++) 
		        	{
		        		var intv = LR.discrete.chunkToInterval(chunk,level);
		        		if (intv.isValid) 
		        		{
			        		 if (intv.isLive) 
			        		 {
			        			 if (!liveRefresh1) { 
				        				liveRefresh1=setTimeout(function() {
				        					//console.log("REFRESH LIVE CHUNK! "+new Date());
				        					liveRefresh1=undefined;
				        					refreshGraphData();
				        				},liveChunkTimeout/2-250 /* live refresh time TODO TODO TODO!!! */);
				        		}
			        		 }
			        		 arr.push({person:p.id,chunk:chunk,intv:intv});
		        		}
		        	}
		        	one();
		        	function one() 
		        	{
		        		if (refreshHndlr)
		        			return; 
		        		var el = arr.shift();
		        		if (!el)
		        			return onePart();
		        		var chunk=el.chunk;
		        		var person=el.person;
		        		var intv = el.intv;
		        		LR.discrete.getChunk(levent ? levent.id:null,person,level,chunk,function(res) {
			        			if (res < 0) {
		        				one();
		        				return;
		        			}
		        			var dt = UI.Config.graph.modes[$scope.graphMode];
		        			for (var i=0;i<res.length;i++) 
		        			{
		        				var v = res[i];
		        				if (v.i) 
		        				{
		        					var fv = fixVal(v[dt.pro]);
		        					if (fv != undefined) {
		        						v.x=intv.min + (intv.max-intv.min)*v.i/LR.discrete.blockSize;
			        					nitems.push({ x : v.x, y : fv,person:person,i:v.i,grp:v.grp,data:v});
		        					}
		        				}
		        			}
		        			one();
		        		});
		        	}
	        	}
	        	onePart();
	        }

	        //----------------------------------------------------
	        function replacePaths() 
	        {		        	
	        	//refreshDataEntry=undefined;	        	
	        	refreshPathHndlr=undefined;
	        	if (!$scope.watched || !$scope.watched.length) {
	    			GUI.pathFeatures=[];
		        	pathByPerson={};
	    			GUI.pathByPerson=pathByPerson;
		        	GUI.map.render();
	        		return;
	        	}
	        	
	        	var level = UI.Config.path.level;
	        	var firstChunk=oldFirstPathChunk;
	        	var lastChunk=oldLastPathChunk;
	        	var nitems=[];
	        	var pparr = $scope.watched.slice();
	        	var pmap={};
	        	
	        	GUI.getPartDetails = function(id,val) {
	        		var p = pmap[id];
	        		if (!p)
	        			return "-";
	        		if (val == "age")
	        			return (p.age || "");
	        		if (val == "start_group")
	        			return (p.start_group || "");
	        		if (val == "start_pos")
	        			return (p.start_pos || "0");
	        		if (val == "gender")
	        			return (p.gender || "");
	        		if (val == "club")
	        			return p.club || "-";
	        		if (val == "type") {
	        			return p.type || "";
	        		}
	        		//console.log("MISSING "+val+" | "+JSON.stringify(p));
	        		return "?";
	        	};
	        	
        		var ff=[];
	        	function onePart() {
	        		if (refreshPathHndlr)
	        			return; 
	        		var p = pparr.shift();
	        		if (!p) 
	        		{
		        		//----------------------
	        			pathByPerson={};
			        	var grps=[];
			        	if (!GUI.personColor)
			        		GUI.personColor={};
		        		//HERE HERE HERE
			        	for (var i=0;i<nitems.length;i++) 
			        	{
			        		var m = nitems[i];
			        		var pm = pathByPerson[m.person];
			        		if (!pm) 
			        		{
			        			pm={};
			        			pathByPerson[m.person]=pm;
			        			if (!GUI.personColor[m.person] && pmap[m.person]) {
						        	GUI.personColor[m.person]=pmap[m.person].color || defColor;
			        			}
			        		}
			        		//6,7 = glon,glat
			        		//8,9 = hdop,speed_in_kmh
			        		//10 = speed_in_kmh_exact
			        		pm[m.i]=[m.lon,m.lat,m.i,m.elapsed,m.avail,m.rank,m.glon,m.glat,m.hdop,m.speedInKmh,m.speedInKmhExact];
			        	}
			        	//---------------------------------------------------------------
		    			GUI.pathByPerson=pathByPerson;
			        	GUI.map.render();
		        		return;
	        		}
	        		//---------------------------------------------------------------------
	        		// LOAD PERSON DATA IF NOT DEFINED TODO MOVE FROM HERE
	        		if (!pmap[p.id]) 
	        		{	        			
	        			if (levent) {
	        				var pd = getPartInfoFromEvent(p.id);
	        				if (pd) 
		    	        		pmap[p.id]=pd;
	        				else
	        					LR.person.byIdWithEventDetails(p.id,levent.id,function(pdata) {
	        						pmap[p.id]=pdata;
	        					});
	        			} else {
		        			LR.person.byId(p.id,function(pdata) {
		    	        		pmap[p.id]=pdata;
		        			});
	        			}
	        		}
	        		//---------------------------------------------------------------------
		        	var arr=[];
		        	for (var chunk=firstChunk;chunk<=lastChunk;chunk++) 
		        	{
		        		var intv = LR.discrete.chunkToInterval(chunk,level);
		        		if (intv.isValid) 
		        		{
		        			if (intv.isLive) 
		        			{
			        			 if (!liveRefresh2) 
			        			 { 
			        				 liveRefresh2=setTimeout(function() {
				        				//console.log("REFRESH PATH! "+new Date());
				        				liveRefresh2=undefined;
				        				refreshPathData();
				        			 },liveChunkTimeout/2-250 /* live refresh time TODO TODO TODO!!! */);
				        		}
		        			}
		        			arr.push({person:p.id,chunk:chunk,intv:intv});
		        		}
		        	}
		        	var _umap={};
		        	one();
		        	function one() 
		        	{
		        		if (refreshPathHndlr)
		        			return; 
		        		var el = arr.shift();
		        		if (!el)
		        			return onePart();
		        		var chunk=el.chunk;
		        		var person=el.person;
		        		var intv = el.intv;
		        		/* SPECIAL  CASE , -person : select form soft storage TODO REDESIGN */
		        		LR.discrete.getChunk(levent ? levent.id : null,-person,level,chunk,function(res) {
		        			if (res < 0) {
		        				one();
		        				return;
		        			}
		        			var ctime = timeline.getCustomTime("crr").getTime();
		        			var pkey = el.chunk * LR.discrete.blockSize;
		        			for (var i=0;i<res.length;i++) 
		        			{
		        				var v = res[i];
		        				if (!v || v.i == undefined)
		        					continue;
		        				var chk = v.i + pkey; 
		        				if (!_umap[chk]) 
		        				{
		        					_umap[chk]=1;
		        					// VALID SIGNAL ? (only for path not for graph!)
		        					if (v.lon && v.lat) 
		        					{
		        						// NEW AVERAGE SPEED 
		        						nitems.push({ avail:v.avail,lon:v.lon,lat:v.lat,hdop:v.hdop,elapsed:v.elapsed,t:v.t,person:person,i:v.i,glon:v.glon,glat:v.glat,rank:v.rank,speedInKmhExact:v.speedInKmh,speedInKmh:v.speedInKmhAverage});
		        					}
		        				}
		        			}
		        			one();
		        		});
		        	}
	        	}
	        	onePart();
	        }
	        
	        function findPersonPosition(person,t,onDone) 
	        {		        	
				var chunk = LR.discrete.timeToChunk(t,0);
				var intv = LR.discrete.chunkToInterval(chunk,0);
				LR.discrete.getChunk(levent ? levent.id:null,-person,0,chunk,function(res) {
					if (res < 0) {
						onDone();
						return;
					}
					var p0,p1;
					var t0,t1;
					if (levent) 
					{
						var p0,p1;
						var t0,t1;
						for (var i=1;i<res.length;i++) 
						{
							var v = res[i-1];
							var xt = v.i*1000*UI.Config.location.step+UI.Config.location.timeOrigin;
							if (xt <= t && v.lon && v.lat) {
								t0=xt;
								p0=v.elapsed;
							}
							if (xt >= t && v.lon && v.lat) {
								t1=xt;
								p1=v.elapsed;
								break;
							}
						}
						if (p0 && p1) 
						{
							fract = (t-t0)/(t1-t0);
							var elapsed = p0+(p1-p0)*fract;
	        				var epos = track.getPositionAndRotationFromElapsed(elapsed);
	        				if (epos && epos[0]) {
								return onDone(epos);
	        				}
						}
					}
					p0=p1=t0=t1=undefined;
					for (var i=1;i<res.length;i++) 
					{
						var v = res[i-1];
						var xt = intv.min+(intv.max-intv.min)*(v.i)/LR.discrete.blockSize;
						if (xt <= t && v.lon && v.lat) {
							t0=xt;
							p0=[v.lon,v.lat];
						}
						if (xt >= t && v.lon && v.lat) {
							t1=xt;
							p1=[v.lon,v.lat];
							break;
						}
					}
					if (!p0 || !p1)
						return onDone();
					var fract = (t-t0)/(t1-t0);
					onDone([p0[0]+(p1[0]-p0[0])*fract,p0[1]+(p1[1]-p0[1])*fract]);
				});
	        }

	        function refreshGraphData() 
	        {
	        	if (isFullScreen())
	        		return;
	        	if (refreshHndlr)
	        		clearTimeout(refreshHndlr);
	        	refreshHndlr=setTimeout(replaceGraphs,250);
	        }
	        function refreshPathData() 
	        {
	        	if (refreshPathHndlr)
	        		clearTimeout(refreshPathHndlr);
	        	refreshPathHndlr=setTimeout(replacePaths,250);
	        }
	        
	        var fitYTime;
	        var fitYHandle;
	        var saveStateHandle;
	        var animateYScaleTo;
	        var animateYScaleOnDone;	
	        
	        function fitY(gdset,onDone) 
	        {
	        	if (isFullScreen())
	        		return;
	            var w = timeline.getWindow(); //w.start.getTime, w.end.getTime()
            	var b = w.start.getTime();
            	var e = w.end.getTime();
            	var minY=undefined;
            	var maxY=undefined;;
            	var dt = UI.Config.graph.modes[$scope.graphMode];
            	if (dt.staticLimits) {
            		minY=dt.staticLimits.min;
            		maxY=dt.staticLimits.max;
            	} else {
            		var ir = timeline.getWindow();
                	gdset.forEach(function (item) {
                		if (ir.start && ir.end)
                		if (item.x >= ir.start.getTime() && item.x <= ir.end.getTime()) {
                    		if (item.x >= b && item.x <= e) {
                    			if (minY === undefined || item.y < minY)
                    				minY=item.y;
                    			if (maxY === undefined || item.y > maxY)
                    				maxY=item.y;
                    		}
                		}
                	});
            	}
            	$scope.$parent.posOnYScaleChange(minY,maxY,dt);
            	if (minY !== undefined && maxY !== undefined) 
            	{
            		if (minY == maxY) 
            		{
            			var eps=0.0001;
            			if (minY)
            				eps=minY/100;
            			minY-=eps/2;
            			maxY+=eps/2;
            		}
            		var mr = (maxY-minY)*0.05;
            		minY-=mr;
            		maxY+=mr;
            	}
            	if (minY !== undefined && maxY !== undefined) 
            	{
            		if (!goptions.dataAxis.left.range) {
            			// initialization
            			goptions.dataAxis.left.range={min:minY, max:maxY};
            			graph.setOptions(goptions);
            			if (onDone)
            				onDone();
            		} else {
            			// animate to
	            		animateYScaleTo = {min:minY, max:maxY};
	            		animateYScaleOnDone = onDone;
            		}
            	}
	        }
	        
	        function saveStateInLocalStorage() {
	            var w = timeline.getWindow(); //w.start.getTime, w.end.getTime()
            	var b = w.start.getTime();
            	var e = w.end.getTime();
	        	var crrt = timeline.getCustomTime("crr").getTime(); // TODO CHECK?!?!
            	localStorage.setItem(__prefix+"-state",JSON.stringify({ext:ext,graphMode:$scope.graphMode,minY:yScale.min,maxY:yScale.max,start:b,end:e,crrt : crrt}));
	        	var ext = GUI.map.getView().calculateExtent(GUI.map.getSize()); 
            	localStorage.setItem(__prefix+"-extent",JSON.stringify(ext));
	        }
	        
	        $scope.onVisibilityDialogClose=loadWatchedSettings; 
	        function loadWatchedSettings() 
	        {
	        	var w;
	        	try {
	        		w=localStorage.getItem(__prefix+"-watched");
	        		if (w) w=JSON.parse(w);
	        	} catch (e) {}
	        	if (!w) 
	        		w=[];
        		var arr=[];
        		function oneW() 
        		{
        			var el = w.shift();
        			if (!el) {
        				$scope.$apply(function() {
        					recalculateWatched(arr);
        					//console.log("SETTING WATCHED "+arr.length);
        				});
        				return;
        			}
        			LR.person.byId(el,function(pdata) {
        				arr.push(pdata);
        				oneW();
        			});
        		}
        		setTimeout(oneW,0); // force no angular context
	        }
	        
	        function recalculateWatched(warr) 
	        {
	        	if (UI.Config.appearance.defaultIsFavorite && warr && warr.length === 0) 
		        	warr=$scope.participants;
	        	var arr;
	        	if (!warr) 
	        		arr=watched.slice();
	        	else
	        		arr=warr.slice();
	        	var oset={};
	        	var olen=0;
	        	for (var i in $scope.watched) {oset[$scope.watched[i].id]=1;olen++};
	        	var nset={};
	        	var nlen=0;
	        	var tnset={};
	        	for (var i in arr) if (!isForceParticipantHidden(arr[i].id)) {nset[arr[i].id]=1;tnset[arr[i].id]=1;nlen++};	                
	        	if (GUI.selectedParticipant1 && GUI.selectedParticipant1 && !nset[GUI.selectedParticipant1.id] && !isForceParticipantHidden(GUI.selectedParticipant1.id)) { 
	        		arr.push(GUI.selectedParticipant1);
	        		nset[GUI.selectedParticipant1.id]=1;nlen++
	        	}
	        	if (GUI.selectedParticipant2 && GUI.selectedParticipant2 && !nset[GUI.selectedParticipant2.id] && !isForceParticipantHidden(GUI.selectedParticipant2.id)) { 
	        		arr.push(GUI.selectedParticipant2);
	        		nset[GUI.selectedParticipant2.id]=1;nlen++
	        	}
	        	wset=tnset;
	        	fwset=nset;
	        	if (nlen == olen) 
	        	{
	        		var ok=true;
	        		for (var i in nset) {
	        			if (oset[i] != nset[i]) {
	        				ok=false;
	        				break;
	        			}
	        		}
	        		if (ok) 
	        			return;	// 
	        	}
	        	//-----------------------------
	        	$scope.watched=arr;
	        	if (warr)
	        		watched=warr;
	        	var done={};
	        	
	        	for (var i in oset) if (!done[i]) {
	        		done[i]=1;
	        		if (participantsCache[i]) 
	        			participantsCache[i].isWatched=true; // TODO REWRITE fwset[i];
	        	}
	        	for (var i in nset) if (!done[i]) {
	        		done[i]=1;
	        		if (participantsCache[i]) 
	        			participantsCache[i].isWatched=true; // TODO REWRITE fwset[i];
	        	}
	        	refreshGraphData();
	        	refreshPathData();
	        }
	        $scope.recalculateWatched=recalculateWatched;
	        GUI.isForceParticipantHidden = isForceParticipantHidden;
	        
	        GUI.onWatchClicked = function(pid) 
	        {
	        	LR.person.byId(pid,function(pdata)  
	        	{
	        		setTimeout(function() {
			        	$scope.$apply(function() 
			    	        	{
					        		function save() {
					        			var arr=[];
				    	        		for (var i=0;i<watched.length;i++) arr[i]=watched[i].id; 
					        			localStorage.setItem(__prefix+"-watched",JSON.stringify(arr));
					        			GUI.invalidatePopups();
			        					recalculateWatched();
					        			doGUIUpdate();
					        		}
			    	        		for (var i=0;i<watched.length;i++) 
			    	        		{
			    	        			if (watched[i].id == pid) 
			    	        			{
			    	        				watched.splice(i,1);
			    	        				save();
			    	        				return;
			    	        			}
			    	        		}
			    	        		watched.push(pdata);
			        				save();
			    	        	});
	        		},0);
	        	});
	        }
	        
	        GUI.onSelectionChanged = function() {
	        	setTimeout(function() {
		        	$scope.$apply(function() {
			        	recalculateWatched();
		        	});
	        	},0);
	        };
	        
	        var oldOfsd;
	        var oldPage;
	        var oldPage2;
	        var oldOfs;
	        function onChange(isRangeChange) 
	        {
	        	animateExtent();
	        	if (softChangeTimer) {
	        		clearTimeout(softChangeTimer);
	        		softChangeTimer=undefined;
	        	}
	        	if (!oldLevel || isRangeChange) 
	        	{
	        		if (!fitYHandle || ((new Date()).getTime()-fitYTime <= 1000))
	        		{
			            if (fitYHandle)
			            	clearTimeout(fitYHandle);
		            	fitYHandle=setTimeout(function() {
		            		fitYHandle=undefined;
			            	fitY(gdset);
			            },500);
	        		}
		            var pw = $("#vis .vis-time-axis").width();
		            if (!pw) {
		        		// HACKINTOSH -> hidden bar just update HTML data
		        		doGUIUpdate();
		            } else if (pw > 20) {
		            	pw=Math.round(pw);	
			            var w = timeline.getWindow(); 
			            if (!saveStateHandle) 
			            {
			            	saveStateHandle=setTimeout(function() {
			            		saveStateHandle=undefined;
				            	saveStateInLocalStorage();
				            },100);
			            } 
			            //----------------
			            var level = LR.discrete.resolutionToLevel(w.start.getTime(),w.end.getTime(),pw);
			            var firstChunk = LR.discrete.timeToChunk(w.start.getTime(),level);
			            var lastChunk = LR.discrete.timeToChunk(w.end.getTime(),level);				            
			            if (level != oldLevel || oldFirstChunk != firstChunk || oldLastChunk != lastChunk)
			            {
				            //console.log("NEW LEVEL : "+level+" | "+firstChunk+" | "+lastChunk);
				            if (!oldLevel) {
					        	doGUIUpdate();
				            }
				            oldLevel=level;
				            oldFirstChunk = firstChunk;
				            oldLastChunk = lastChunk;
				            refreshGraphData();
			            } else {
				            if (isRangeChange)
				            	return;
			            }
		            }		            
	        	} else {
	        		// TIME CHANGE
	        		doGUIUpdate();
	        	}
	        	//----------------------------------
	        	var ctime = timeline.getCustomTime("crr").getTime();
	        	var ofs = LR.discrete.timeToOffsetReal(ctime);
	        	var ofsd = Math.floor(ofs);
	        	var page = LR.discrete.timeToPage(ctime);
	        	var hp = LR.discrete.locationPageSize/2;
	        	//----------------------------------
        		//console.log("NEW PAGE : "+page+" | OLD="+oldPage+" | "+ofsd);
	        	if (page != oldPage) 
	        	{
	        		refreshLocationData(function() 
			        {
					});
	        	}
	        	oldOfsd=ofsd;
	        	oldPage=page;
	        	oldOfs=ofs;
	        	//---------- PATHS
	        	level = UI.Config.path.level;	        	
	        	var tofs = Math.round((UI.Config.path.durationInSeconds)*1000);
	        	var rofs = UI.Config.timeouts.deviceTimeout*1000;
	            var firstPathChunk = LR.discrete.timeToChunk(ctime-tofs,level);
	            var lastPathChunk = LR.discrete.timeToChunk(ctime+rofs,level);
	            if (oldFirstPathChunk != firstPathChunk || oldLastPathChunk != lastPathChunk)
	            {
		            oldFirstPathChunk = firstPathChunk;
		            oldLastPathChunk = lastPathChunk;
		            refreshPathData();
	            } 
	            refreshWatchedHTMLData();
	        	GUI.map.render();
	        }
	        
	        GUI.doInterpolate = doInterpolate; 
	        function doInterpolate() {
	        	var ctime = timeline.getCustomTime("crr").getTime();
	        	var page = LR.discrete.timeToPage(ctime);
	        	var ofs = LR.discrete.timeToOffsetReal(ctime);
	        	//-------------------
				var guiSelectedChanged=false;
        		for (var i in proxiesCache)
	        		interpolateProxy(i,page,ofs);
	        	for (var i in participantsCache) if (!isForceParticipantHidden(i)) 
	        		guiSelectedChanged|=interpolateParticipant(i,page,ofs);
	        	//-------------------
	        	if (guiSelectedChanged)
	        		doGUIUpdate();
	        }
	        
	        GUI.trackLayer.on("precompose",function(event) {
	        	doInterpolate();
	        	animateLocation();
	        	if (mode == "play")
	        		GUI.map.render();
	        });

	        var __ofsLimit=1/UI.Config.location.step;
	        function interpolateParticipant(id,page,ofs) 
	        {
	        	var guiSelectedChanged=false;
        		var part = participantsCache[id];
        		part.avail=1;
        		var pps = pathByPerson[id];
        		var loc = pps || part.loc;
        		if (!loc)
        			return false;
    			//---------------------------------
        		var lofi=undefined;
        		var l0=undefined;
        		var l1=undefined;
        		var l2=undefined;
        		var rot=undefined;
    			var accel=undefined;
    			var speed=undefined;
    			var speedExact=undefined;
    			var elapsed=undefined;
    			var elapsed1=undefined;
    			var elapsed2=undefined;
    			var elapsed0=undefined;
    			var hdop=undefined;
    			var glon=undefined;
    			var glat=undefined;
    			var rank=undefined;
    			var neleapsed=undefined;
    			var lon=undefined,lat=undefined;        			
    			//---------------------------------
        		var ps = UI.Config.location.pageSize;
        		var torigin=UI.Config.location.timeOrigin;
    			//---------------------------------
        		// DISCRETE LOCATION
        		l1=undefined;
        		l2=undefined;
        		var s1 = Math.floor(page*ps+ofs);	
        		var s2 = Math.ceil(page*ps+ofs);
        		l1 = loc[s1];
        		l2 = loc[s2];
        		if (l1 && l2) 
        		{
        			if (!doNotNotify && part.loc /*&& (ofs%1) < __ofsLimit */) 
        			{
        				var a1=part.loc[s1];
        				var a2=part.loc[s2];
        				if (a1 && a2) 
        				{
        					if (a1[5] > a2[5] || a1[6] > a2[6] || a1[7] > a2[7]) 
        					{
        						var data={};
        						if (a1[5] > a2[5]) 
        							data.ovr=a2[5];
        						if (a1[6] > a2[6]) 
        							data.grp=a2[6];
        						if (a1[7] > a2[7]) 
        							data.gen=a2[7];
        						notification(id,s2,"overrun",data);
        					}
        					var tc1 = Math.floor(a1[3]*trackLength/10000); // 10km 
        					var tc2 = Math.floor(a2[3]*trackLength/10000); // 10km
        					if (tc1 && tc2 && tc1 != tc2) {
            					notification(id,s2,"reached-km",{km:tc2*10},part.code);
        					}
        				}
        			}
        			//console.log("INTERPOLATED : "+Object.keys(loc).length);
        			var fi1 = l1[2];
        			var fi2 = l2[2];
        			var fract = ofs%1;	        			
        			elapsed=undefined;
        			// TRACKED?
        			//6,7 lon lat
        			if (l1[6] && l1[6]) {
        				glon = l1[6]+(l2[6]-l1[6])*fract;
            			glat = l1[7]+(l2[7]-l1[7])*fract;
        			}
        			if (levent && l1[3] >= 0 && l2[3] >= 0) 
        			{
        				var elapsed1 = l1[3];
        				var elapsed2 = l2[3];
        				elapsed = elapsed1+(elapsed2-elapsed1)*fract;
        				var epos = track.getPositionAndRotationFromElapsed(elapsed);
        				if (!epos || !epos[0]) {
        					part.avail=0.5;
        					return false;
        				}
	        			lon = epos[0];
	        			lat = epos[1];
	        			rot = epos[2];
        			} else {
        				lon = glon;
        				lat = glat;
	        			/*lon = l1[0]+(l2[0]-l1[0])*fract;
	        			lat = l1[1]+(l2[1]-l1[1])*fract;*/
        			}      
        			
        			
	        		//8,9 = hdop,speed_in_kmh
        			if (l1[8] && l2[8])
        				hdop = l1[8]+(l2[8]-l1[8])*fract;
        			if (l1[9] && l2[9])
        				speed = (l1[9]+(l2[9]-l1[9])*fract);
        			if (l1[10] && l2[10])
        				speedExact = (l1[10]+(l2[10]-l1[10])*fract);
        			var avail1 = l1[4];		// 0 = BEST availablity 
        			var avail2 = l2[4];
        			var isz = UI.Config.timeouts.deviceTimeout/UI.Config.location.step; 
        			if (avail1 >= 1)
        				avail1-=1;
        			else 
        				avail1=0;
        			if (avail2 >= 1)
        				avail2-=1;
        			else
        				avail2=0;
        			if (avail1 > isz)
        				avail1 = isz;
        			if (avail2 > isz)
        				avail2 = isz;
        			part.avail = 0.5+(1.0-(avail1+(avail2-avail1)*fract)/isz)/2.0; // interpolate from 1 (zero
            		guiSelectedChanged |= setParticipantLocation(part,lon,lat,elapsed,hdop,glon,glat,speed,accel,rot,rank,speedExact);
        			showParticipant(id);
        		} else {
        			//console.log("NOT OK WITH "+Object.keys(part.loc)+"!");
        			var ok=true;
        			if (part.loc)
        			for (var b in part.loc) {
        				ok=false;
        				break;
        			}
    				if (ok)
    					removeParticipant(id);
        		}
        		return guiSelectedChanged;
	        }
	        function interpolateProxy(id,page,ofs) {
        		var part = proxiesCache[id];
        		var loc = part.loc;
        		if (!loc.__sorted) {
        			loc.sort(function(a,b){
        				return a.i-b.i;
        			});
        			loc.__sorted=true;
        		}
        		var l1=undefined;
        		var l2=undefined;
        		var adj = (page-part.page)*LR.discrete.locationPageSize;
        		for (var j=0;j<loc.length;j++) 
        		{
        			var v = loc[j];
        			var fi = v[0]-adj;
        			if (fi <= ofs)
        				l1=v;
        			if (fi >= ofs) {
        				l2=v;
        				break;
        			}
        		}
        		if (l1 && l2) 
        		{
        			var fi1 = l1[0]-adj;
        			var fi2 = l2[0]-adj;
        			var fract = fi1 == fi2 ? 0 : (ofs-fi1)/(fi2-fi1);
        			var minlon = l1[1]+(l2[1]-l1[1])*fract;
        			var minlat = l1[2]+(l2[2]-l1[2])*fract;
        			var maxlon = l1[3]+(l2[3]-l1[3])*fract;
        			var maxlat = l1[4]+(l2[4]-l1[4])*fract;
        			var cnt = Math.round(l1[5]+(l2[5]-l1[5])*fract);
        			setProxyLocation(part,minlon,minlat,maxlon,maxlat,cnt);
        		} 
	        }

	        function refreshWatchedHTMLData() 
	        {
	        	if (isFullScreen())
	        		return;
	        	if ($scope.watched)
	        	for (var i=0;i<$scope.watched.length;i++) {
	        		var p = $scope.watched[i];
		        	if (!graphItemsByPerson[p.id])
		        		continue;
	        		var el = $("#pgval-"+p.id);
	        		if (el[0]) {
	        			el[0].innerHTML=getFormattedGraphValue(p.id);
	        		}
	        	}
	        }
	        //----------------------------------------------------------------------
	        // LOCATION LOADING /ANIMATION / DYNAMIC PARTICIPANT CREATIONG
	        //----------------------------------------------------------------------
	        function setParticipantLocation(part,lon,lat,elapsed,hdop,glon,glat,speed,acceleration,rotation,rank,speedExact) 
	        {
	        	part.rank=rank;
	        	part.isWatched=true; // TODO REWRITE fwset[part.id];
	        	part.hdop=hdop;
	        	var tp = ol.proj.transform([lon,lat],'EPSG:4326', 'EPSG:3857');
		        part.elapsed=elapsed;
	        	part.rotation=rotation;
	        	if (speed != undefined )
	        		part.speed=speed;	        	
	        	part.speedExact=speedExact;	        	
	        	part.glon=glon;
	        	part.glat=glat;
	        	part.wbest=undefined;
    			//---------------------------------
    			if (part.avail >= 1 && glon && glat && lon && lat) 
    			{
    				var dist = WGS84SPHERE.haversineDistance([lon,lat],[glon,glat]);
    				
    				// TODO TODO TODO TODO 
    				//dist = 0; 
    				
    				if (dist > UI.Config.constraints.offDutyDistanceMeters) 
    				{
    					if (!part.offDuty) {
        					if (part.offDutyElapsed == undefined) {
        						part.offDutyElapsed=elapsed;
        						part.offDutyElapsedTime=(new Date()).getTime();
        					} else {
        						if (part.offDutyElapsed == elapsed && (new Date()).getTime()-part.offDutyElapsedTime > UI.Config.constraints.offDutyElapsedNotChangedTriggerSeconds*1000) {
        		    				part.offDuty=true;
        						} else {
        							if (part.offDutyElapsed != elapsed) 
        							{
            							part.offDuty=false;
                						part.offDutyElapsed=elapsed;
                						part.offDutyElapsedTime=(new Date()).getTime();
        							}
        						}
        					}
    					}
    				} else {
        				part.offDuty=false;
        				delete part.offDutyElapsed;
        				delete part.offDutyElapsedTime;
    				}
    			} 
    			//---------------------------------
	        	// BUS MODE -> ESTIMATION OF TIME TO CURRENT POI
        		if (elapsed != undefined && levent && (($scope.poiByCode && $scope.crrPoiCode) || crrBus)) 
        		{
        			if (crrBus) 
        			{
        				if (crrBus == part.id) 
        				{
            				// BUS         				
        					var best = undefined;
        					var wbest = undefined;
            				for (var i in $scope.pois) 
            				{
                    			var poi = $scope.pois[i];
                    			if (poi) 
                    			{
                    				var tval="-";
                        			var te = elapsed % 1;
                        			var de = poi.elapsed-te;
                        			if (poi.elapsed < te)
                        				de+=1;
                        			var lenm = trackLength*de;
                    				if (speed > 0) {
                    					var durs = lenm/(speed*0.27777777777778);
                    		        	durs-=UI.Config.timeouts.liveConsistencyDisplayOffset;
                    		        	if (durs < 0) durs=0;
                    		        	var html=moment(GUI.getCrrTime()+durs*1000).format("HH:mm")+"";
                        				poi.displayText = Math.round(durs/60)+" min. ("+html+")"; 
                    		        	if (best == undefined || durs < best) {
                    		        		best=durs;
                    		        		wbest=[html,Math.round(durs/60)+" min."];
                    		        	}
                        				poi.sortNum=durs;
                    				} else {
                    					// SPEED NOT AVAIL -> display distance in km
                    					poi.displayText = parseFloat(Math.round(lenm / 1000 * 100) / 100).toFixed(2)+" km"; 
                        				poi.sortNum=1000;	//some hardcoded value
                    				}
                    			}
            				}
            				part.wbest=wbest;
        				}
        			} else {
        				// STATION 
    					var wbest = undefined;
            			var poi = $scope.poiByCode[$scope.crrPoiCode];
            			if (poi) 
            			{
            				var tval="-";
                			var te = elapsed % 1;
                			var de = poi.elapsed-te;
                			
                			/* TODO ADD IN CONFIG 30 METERS TOLLERANCE */
                			if (te > poi.elapsed && te-poi.elapsed < 30 / trackLength) {
                				te=poi.elapsed;
                				de =0;
                			}
                			
                			if (poi.elapsed < te)
                				de+=1;
                			var lenm = trackLength*de;
            				if (speed > 0) {
            					var durs = lenm/(speed*0.27777777777778);
            		        	durs-=UI.Config.timeouts.liveConsistencyDisplayOffset;
            		        	if (durs < 0) durs=0;
            		        	var html=moment(GUI.getCrrTime()+durs*1000).format("HH:mm")+"";
                				part.displayText = Math.round(durs/60)+" min. ("+html+")"; 
                				part.sortNum=durs;
                				if (best == undefined || durs < best) {
            		        		best=durs;
            		        		wbest=[html,Math.round(durs/60)+" min."];
            		        	}
            				} else {
            					// SPEED NOT AVAIL -> display distance in km
                				//part.displayText = parseFloat(Math.round(lenm / 1000 * 100) / 100).toFixed(2)+" km";
                				//part.sortNum=1000;
            				}
            				//console.log(part.code+" | TVAL : "+tval);
            			}
        				part.wbest=wbest;
        			}
        		}
    			//---------------------------------
	        	
				var geom = part.geometry;
				if (geom) 
				{
					if (geom[0] == tp[0] && geom[1] == tp[1])
						return setExtraData();
				}
				part.geometry = tp;
				if (GUI.selectedParticipant1 && GUI.selectedParticipant1.id == part.id) {
					GUI.selectedParticipant1.feature.geometry=tp;
					setExtraData();
					return true;
				}
				if (GUI.selectedParticipant2 && GUI.selectedParticipant2.id == part.id) {
					GUI.selectedParticipant2.feature.geometry=tp;
					setExtraData();
					return true;
				}
				function setExtraData() {
					var done=false;
					if (GUI.selectedParticipant1 && GUI.selectedParticipant1.id == part.id) {
						if (GUI.selectedParticipant1.rank != speed) {GUI.selectedParticipant1.rank=rank;done=true;}
						if (GUI.selectedParticipant1.speed != speed) {GUI.selectedParticipant1.speed=speed;done=true;}
						if (GUI.selectedParticipant1.acceleration != acceleration) {GUI.selectedParticipant1.acceleration=acceleration;done=true;}
						if (GUI.selectedParticipant1.elapsed != elapsed) {GUI.selectedParticipant1.elapsed=elapsed;done=true;GUI.setSelectedParticipant1ZIndex(elapsed);}
						if (GUI.selectedParticipant1.rotation != rotation) {GUI.selectedParticipant1.rotation=rotation;done=true;};
						
						/*if (done) 
							GUI.lastPopupReferesh1=0;*/
					}
					if (GUI.selectedParticipant2 && GUI.selectedParticipant2.id == part.id) {
						if (GUI.selectedParticipant2.rank != speed) {GUI.selectedParticipant2.rank=rank;done=true;}
						if (GUI.selectedParticipant2.speed != speed) {GUI.selectedParticipant2.speed=speed;done=true;}
						if (GUI.selectedParticipant2.acceleration != acceleration) {GUI.selectedParticipant2.acceleration=acceleration;done=true;}
						if (GUI.selectedParticipant2.elapsed != elapsed) {GUI.selectedParticipant2.elapsed=elapsed;done=true;GUI.setSelectedParticipant2ZIndex(elapsed);}
						if (GUI.selectedParticipant2.rotation != rotation) {GUI.selectedParticipant2.rotation=rotation;done=true;};
						/*if (done) 
							GUI.lastPopupReferesh2=0;*/
					}
					return done;
				}
				return false;
	        }
	        
	        function addParticipant(data) 
	        {	        	
	        	// data : id,code,color,pos
	        	var part = participantsCache[data.id];
	        	if (!part) 
	        	{ 	        	
	        		part = {};
	        		part.id=data.id;
	        		part.country=data.country;
	        		part.code=data.code || '??';
	        		part.color=data.color || 'rgba(0,0,0,0.35)';	        		
	        		part.opacity=0;
	                part.id=data.id;
	                participantsCache[data.id]=part;
    				setupPart(part);
	        	} else {
	        		if (data.seq < part.seq)
	        			return;
	        		setupPart(part);
	        	}
	        	part.loc=data.loc;
	        	part.page=data.page;
	        	part.seq=data.seq;
        		function setupPart(part) 
	        	{
    				//part.setPos(pos);
    				if (part.isVisible)
	        			return;
	        		if (part.opacity < 0.017)
	        			part.opacity=0.017;
    				part.isVisible=true;
    				doLocAnimation=true;
	        	}
        		var ts = toSelectAfterLoad[data.id];
        		if (ts) 
        		{
        			var ct = (new Date()).getTime();
        			if (ct-ts <= 10000) {
	    				GUI.setSelectedParticipant1(null);GUI.setSelectedParticipant2(null);
	    				GUI.toPan=undefined;
    	    			setTimeout(function() {
            				GUI.setSelectedFromCandidates([part]);
    	    			},50);
        			}
        			delete toSelectAfterLoad[data.id];
        		}
	        }

	        function removeParticipant(id,seq,isClosePopup) 
	        {
	        	var part = participantsCache[id];
	        	if (part && (!seq || part.seq == seq)) 
	        	{
	        		if (part.isVisible) 
	        		{
	    				part.isVisible=false;
	    				doLocAnimation=true;
	        		}
	        	}
	        	if (isClosePopup) 
	        	{
		        	if (GUI.selectedParticipant1 && GUI.selectedParticipant1.id == id)
		        		GUI.setSelectedParticipant1(null);
		        	if (GUI.selectedParticipant2 && GUI.selectedParticipant2.id == id)
		        		GUI.setSelectedParticipant2(null);
	        	}
	        }
	        function showParticipant(id) 
	        {
	        	var part = participantsCache[id];
	        	if (part && !part.isVisible) 
	        	{
	        		if (part.opacity < 0.017)
	        			part.opacity=0.017;
    				part.isVisible=true;
    				doLocAnimation=true;
	        	}
	        }

	        function setProxyLocation(part,minlon,minlat,maxlon,maxlat,cnt) 
	        {
	        	if (part.getGeometry() && part.minlon == minlon && part.minlat == minlat && part.maxlon == maxlon && part.maxlat == maxlat && cnt == part.cnt)
	        		return;
	        	var geom = part.getGeometry();
	        	var lon = (minlon+maxlon)/2;
	        	var lat = (minlat+maxlat)/2;
	        	var tp = ol.proj.transform([lon,lat],'EPSG:4326', 'EPSG:3857');
	        	var mm =  ol.proj.transform([minlon,minlat],'EPSG:4326', 'EPSG:3857');
	        	r = Math.sqrt((tp[0]-mm[0])*(tp[0]-mm[0])+(tp[1]-mm[1])*(tp[1]-mm[1]));
	        	part.r=r;
				part.cnt=cnt;
				part.lon=lon;
				part.lat=lat;
				var geom = new ol.geom.Point(tp);
				part.setGeometry(geom);
				part.minlon=geom.minlon=minlon;
				part.minlat=geom.minlat=minlat;
				part.maxlon=geom.maxlon=maxlon;
				part.maxlat=geom.maxlat=maxlat;
	        }

	        function addProxy(cnt,loc,key,page,seq,tileCoords,bbox,z) 
	        {
	        	// data : id,code,color,pos
	        	var part = proxiesCache[key];
	        	if (!part) 
	        	{ 	        	
	        		part = new ol.Feature();
	        		GUI.proxiesLayer.getSource().addFeature(part);
	        		part.isVisible=false;
	        		part.cnt=cnt;
	                part.opacity=0;
	                proxiesCache[key]=part;
    				setupProxy(part);
	        	} else {  
	        		if (seq < part.seq)
	        			return;
	        		setupProxy(part);
	        	}
	        	part.z=z;
	        	part.key=key;
	        	part.bbox=bbox;
	        	part.tileCoords=tileCoords; //(tileCoords[2]-tileCoords[0])/UI.Config.location.locationGridSize;
	        	part.seq=seq;
	        	part.loc=loc;
	        	part.page=page;        		
	        	function setupProxy(part) 
	        	{
    				if (part.isVisible)
	        			return;
	        		if (part.opacity < 0.017)
	        			part.opacity=0.017;
    				part.isVisible=true;
    				doLocAnimation=true;
	        	}
	        }
	        function removeProxy(id,seq) 
	        {
	        	var proxy = proxiesCache[id];
	        	if (proxy && (!seq || proxy.seq == seq)) 
	        	{
	        		if (proxy.isVisible) 
	        		{
	        			proxy.isVisible=false;
	        			doLocAnimation=true;
	        		}
	        	}
	        }	        
	        //----------------------------------------------------------------------
	        var lastpan=(new Date()).getTime();
	        function animateExtent() 
	        {
	        	if (!GUI.toPan) {
	        		lastpan=undefined;
	        		return;
	        	}
	        	var ctime = (new Date()).getTime();
	    		var ddur = Math.floor((ctime - lastpan)/40);
	    		if (ddur > 50 || !lastpan) {
	    			ddur=1;
	    			lastpan=ctime;
	    		} else {
	    			lastpan+=ddur*40;
	    		}
	        	ddur=1;
	    		for (var dd=0;dd<ddur;dd++) 
	    		{
		    		var tg = GUI.toPan;
		    		var ncen = [(tg[0]+tg[2])/2,(tg[1]+tg[3])/2];
		    		var p = GUI.popup1 || GUI.popup2;
		    		if (p) p.panIntoView_(ncen);
	    		}
	        }
	        var lastanime=(new Date()).getTime();
	        var doLocAnimation=false;
	        function animateLocation() 
	        {
	        	if (!doLocAnimation)
	        		return;
	        	//----------------------------------------------------------------
	        	// CRR POSITIONING DATA 
	        	//----------------------------------------------------------------
	    		var ctime = (new Date()).getTime();
	    		var ddur = Math.floor((ctime - lastanime)/UI.Config.timeouts.locationAnimationInterval);
	    		if (ddur == 0) {
	    			setTimeout(function() {
	    				animateLocation();
	    			},UI.Config.timeouts.locationAnimationInterval-(ctime - lastanime)+1);
	    			return;
	    		}
	    		if (ddur > 80 || !lastanime) {
	    			ddur=1;
	    			lastanime=ctime;
	    		} else {
	    			lastanime+=ddur * UI.Config.timeouts.locationAnimationInterval;
	    		}
    			//----------------------------------------------------------------
	    		var changed=false;
	    		for (var dd=0;dd<ddur;dd++) 
	    		{
	    			var toDel=[];
		    		for (var i in participantsCache) 
		    		{
						var prt = participantsCache[i];
						if (prt.opacity > 0 && !prt.isVisible) 
						{
							changed=true;
							prt.opacity=prt.opacity*0.5;	 // TODO ADD CONFIG OPTION
							if (prt.opacity < 0.01) 
							{	
								toDel.push(i);
								continue;
							}
						}	
						if (prt.opacity < 1 && prt.isVisible) 
						{
							changed=true;
							prt.opacity=prt.opacity*2;	 // TODO ADD CONFIG OPTION
							if (prt.opacity > 0.99)
								prt.opacity=1;
						}
					}
		    		
		    		for (var i=0;i<toDel.length;i++) {
						delete participantsCache[toDel[i]];		 // REMOVE PROXY FROM CACHE
		    		}
		    		toDel=[];
		    		for (var i in proxiesCache) 
		    		{
						var prt = proxiesCache[i];
						if (prt.opacity > 0 && !prt.isVisible) 
						{
							changed=true;
							prt.opacity=prt.opacity*0.5;	 // TODO ADD CONFIG OPTION
							if (prt.opacity < 0.01) 
							{
								toDel.push(i);
								continue;
							}
						}
						if (prt.opacity < 1 && prt.isVisible) 
						{
							changed=true;
							prt.opacity=prt.opacity*2;	 // TODO ADD CONFIG OPTION
				        	//console.log("DO LOCATION ANIMATION : "+prt.opacity);
							if (prt.opacity > 0.99) {
								prt.opacity=1;
								continue;
							}
						}
					}
		    		for (var i=0;i<toDel.length;i++) {
						GUI.proxiesLayer.getSource().removeFeature(proxiesCache[toDel[i]]);
						delete proxiesCache[toDel[i]];		 // REMOVE PROXY FROM CACHE
		    		}
	    		}	    		
	    		if (changed) {
	    			GUI.map.render();
	    		} else {
	    			doLocAnimation=false;
	    		}
	        }
	        //----------------------------------------------------------------------
	        var lastEstRef;
	        function doGUIUpdate() 
	        {
	        	GUI.refreshHTML();
	        	
	        	var c = (new Date()).getTime();
	        	if (!lastEstRef || c-lastEstRef > UI.Config.timeouts.estimationRefreshIntervalSeconds*1000) 
	        	{
	        		lastEstRef=c;
		        	// REFRESH ESTIMATE BUS TIME
	        		
	        		var sorted=[];
					for (var i in $scope.participants) 
						sorted.push($scope.participants[i]);
					sorted.sort(function(a,b) {
						a=participantsCache[a.id];
						b=participantsCache[b.id];
						var k1 = a ? 0 : 1;
						var k2 = b ? 0 : 1;
						if (k1 < k2)
							return -1;
						if (k1 > k2)
							return 1;
						if (!a)
							return 0;
						var sa = a.sortNum;
						var sb = b.sortNum;
						if (sa == undefined)
							sa = 1e20;
						if (sb == undefined)
							sb = 1e20;
						if (sa < sb)
							return -1;
						if (sa > sb)
							return 1;
						return 0;
					});
					
					// TODO WRITE ME CLEANER
					if ($scope.crrPoiCode && $scope.poiByCode && $scope.poiByCode[$scope.crrPoiCode]) {
						for (var k=0;k<sorted.length;k++) {
							var p = participantsCache[sorted[k].id];
							if (p && !p.offDuty) {
								window.crrBus = p.id;
								break;
							}
						}
					}
					
					var kr = $(".mdlistprs");
					for (var i=0;i<kr.length;i++)
						kr[i].style.display="none";
					
					for (var i in sorted) 
					{
						var id = $scope.participants[i].id;
						var part = sorted.shift();			
						$(document.getElementById("estpers-name-"+id)).html(part.first_name+" "+part.last_name+" "+(part.age ? "("+part.age+((" "+(part.gender||"")).toUpperCase())+")" : ""));
						var img = part.image || (part.gender == 'm' ? 'images/missing-male.png' : (part.gender == 'f' ? 'images/missing-female.png':null))
						$(document.getElementById("estpers-img-"+id)).attr("src",img);
						part = participantsCache[part.id];
						if (part  && part.displayText) 
						{
							$(document.getElementById("estpers-"+id)).html(part.displayText);
							document.getElementById("hidep"+id).style.display=part.offDuty ? "none" : "flex";
						}
					}
					var sorted=[];
					var pbc={};
					for (var i in $scope.pois) {
						var p = $scope.pois[i];
						if (p.code) 
							pbc[p.code]=p;
						sorted.push(p);
					}
					sorted.sort(function(a,b) {
						if (a.sortNum < b.sortNum)
							return -1;
						if (a.sortNum > b.sortNum)
							return 1;
						return 0;
					});
					
					for (var i in $scope.pois) {
						var code = $scope.pois[i].code;
						var poi = sorted.shift();
						var name = poi.name;
						if (!name) {
							name="&nbsp;";
							var k = poi.code.indexOf(":");
							if (k) {
								var tc = poi.code.substring(0,k);
								var tp = pbc[tc];
								if (tp && tp.name)
									name=tp.name;
								tp = pbc[tc+":1"];
								if (tp && tp.name)
									name=tp.name;
								tp = pbc[tc+":2"];
								if (tp && tp.name)
									name=tp.name;
							}
						}
						$(document.getElementById("estpois-"+code)).html(poi.displayText||"-");
						$(document.getElementById("estpois-name-"+code)).html(name);
						if (poi.image) 
							$(document.getElementById("estpois-img-"+code)).attr("src","img/"+poi.image);
						else
							$(document.getElementById("#estpois-img-"+code)).attr("src","");
					}
				}
	        }
	        //----------------------------------------------------------------------
	        timeline.on("rangechanged",function() {
	            onChange(true);
	        });

	        // heavy operation on many favorites (graph data)
	        // on change timeline > redraw graph
	        var softGraphTimer;
	        var lastGraphChanged;
	        timeline.on("changed",function() {
        		var cc = (new Date()).getTime();
	        	if (softGraphTimer) 
	        	{
	        		clearTimeout(softGraphTimer);
	        		if (cc-lastGraphChanged > 50) {
	        			redrawGraph();
	        			return;
	        		}
	        	}
	        	softGraphTimer=setTimeout(redrawGraph,50);
	        	function redrawGraph() {
	        		lastGraphChanged=cc;
	        		var w = timeline.getWindow(); //w.start.getTime, w.end.getTime()
			        graph.setWindow(w.start,w.end,{animation:false});
			        doGUIUpdate();
	        	}
	        });
	        
	        
	        var playStartTime;
	        var lastIct;
	        var lastAnimGuiUpdate;
	        //------------------------------------------------------------------
	        function timer() 
	        {
        		if (animateYScaleTo) 
        		{
        			var rn = goptions.dataAxis.left.range;
        			if (rn) 
        			{
            			var diff1 = Math.abs(animateYScaleTo.min-rn.min); 
            			var diff2 = Math.abs(animateYScaleTo.max-rn.max);
            			//console.log("DIFF : "+(diff1+diff2));
            			var kk = (animateYScaleTo.max-animateYScaleTo.min+rn.max-rn.min)/30;
            			if (kk > 0.1)
            				k=0.1;
            			if (diff1+diff2 < 0.1) 
            			{
            				//goptions.dataAxis.left.range=animateYScaleTo;
            				animateYScaleTo=undefined;
            				if (animateYScaleOnDone)
            					animateYScaleOnDone();
            			} else {
            				rn.min = rn.min + (animateYScaleTo.min-rn.min)*0.25;
            				rn.max = rn.max + (animateYScaleTo.max-rn.max)*0.25;
            			}        			
            			graph.setOptions(goptions);
        			} 
        		} 
	        	if (mode == "stop") 
	        	{
	        		var ctime = new Date();
		        	timeline.setCustomTime(ctime,"now");
		        	if (!lastAnimGuiUpdate || ctime.getTime()-lastAnimGuiUpdate >= 250 /* ms */) {
			        	lastAnimGuiUpdate=ctime.getTime();
		        		doGUIUpdate();
		        	} 
	            	return;
	        	}
	        	var ict = (new Date()).getTime();
	        	var ct = timeline.getCustomTime("crr").getTime();
	        	if (lastIct) 
	        		ct+=$scope.speed*(ict-lastIct);
	        	lastIct=ict;
	        	if (ict - playStartTime >= 600) {
	        		if (ct > ict-UI.Config.timeouts.minDisplayDelay*1000)
	        			ct=ict-UI.Config.timeouts.minDisplayDelay*1000;	   
	        		var t = timeline.getWindow();
	        		var d = (t.end.getTime()+t.start.getTime())/2.0;
	        		var kk = d+(ct-d)*0.15;
	        		timeline.moveTo(kk,{animation:false});
	        	}
	        	setCurrentTime(ct);
	        	timeline.setCustomTime(ict/*-UI.Config.timeouts.minDisplayDelay*1000*/,"now");
	        	onChangeSoft();
	        }
	        function stop() {
	        	onChange();
	        	mode="stop"; 
	        	playStartTime=undefined;
	        	lastIct=undefined;
	        }
	        function play() {
	        	if (mode == "play")
	        		return;	        	
	        	mode="play";
	        	playStartTime = (new Date()).getTime();
	        	lastIct=undefined;
	        	var pt = timeline.getCustomTime("crr").getTime();
	        	var w = timeline.getWindow();
	        	if ( w.end.getTime() - w.start.getTime() > 8*60*1000*2 )
	        		timeline.setWindow(pt-8*60*1000,pt+8*60*1000,{animation:true});
	        	else
	        		timeline.moveTo(pt,{animation:true});
	        }
	        var myInterval=setInterval(timer,50);
	        $scope.$on("$destroy", function(){
	            clearInterval(myInterval);
	        });
	        //-----------------------------------------------
	        $scope.$parent.registerPosCtrl($scope);
	    	$scope.setGraphMode = function(mode) {
	    		$scope.graphMode=mode;
	    		saveStateInLocalStorage();
	        	delete goptions.dataAxis.left.range;
	        	refreshGraphData();
	    	};
	    	$scope.setSpeed = function(speed) {
	    		$scope.speed=speed;
	    	};
	    	$scope.selectParticipant = function(person) {
	    		findPersonPosition(person.id,timeline.getCustomTime("crr").getTime(),function(pos) {
	    			if (!pos) {
	    				return;
	    			}
	    			GUI.map.getView().setCenter(ol.proj.transform(pos,'EPSG:4326','EPSG:3857'));
	    			if (participantsCache[person.id] && participantsCache[person.id].geometry && participantsCache[person.id].isVisible) {
		    			var parr = [participantsCache[person.id]];
	    				GUI.setSelectedParticipant1(null);GUI.setSelectedParticipant2(null);
	    				GUI.toPan=undefined;
	    				setTimeout(function() {
		    				GUI.setSelectedFromCandidates(parr);
		    			},50);
			    		//GUI.onWatchClicked(person.id,true);
		    		} else {
		    			toSelectAfterLoad[person.id]=(new Date()).getTime();
		    		}
	    		});

	    	};
	        //-----------------------------------------------
	    	function isFullScreen() {
	    	 	  if ($("body").hasClass("fullscreen"))
	    			return true;
				  var doc = window.document;
				  var docEl = $("#location-map")[0];
				  if (!docEl)
					  return 0;
				  var requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
				  var cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
				  if(!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement)
					  return 0;
				  return 1;
	    	}
	    	
			$(document).on('webkitfullscreenchange mozfullscreenchange fullscreenchange MSFullscreenChange', function() {
				var fullscreenElement = document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement;
				if (!fullscreenElement) {
		    		$("body").removeClass("fullscreen")
				} else {
		    		$("body").addClass("fullscreen")
				}
			});

	    	function toggleFullScreen() {
	    		if (!UI.Utils.mobileAndTabletCheck()) 
	    		{
					var doc = window.document;
					var docEl = $("body").hasClass("root-gui") ? document.body : $("#location-map")[0];
					var requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
					var cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
					if(!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
					    requestFullScreen.call(docEl);$("body").addClass("fullscreen");
					} else {
					    cancelFullScreen.call(doc);$("body").removeClass("fullscreen");
					}
	    		} else {
		    		if ($("body").hasClass("fullscreen")) {
		    			$("body").removeClass("fullscreen")
		    		} else {
		    			$("body").addClass("fullscreen")
		    		}
	    		}
	        	GUI.map.updateSize(); 
	    	}
	    	$scope.toggleFullScreen=toggleFullScreen;
	    	$scope.openEarth = function() {
	    		if (!levent)
	    			return;
	    		var eid = levent.id;
	    		var pid = 1; //?!	    		
	    		var t = timeline.getCustomTime("crr").getTime();
	    		var dur = 40;	//400 seconds 
	    		t-=dur*1000*10;
	    		var arr=[];
	    		for (var i in wset)
	    			arr.push(i);
	    		if (!arr.length)
	    			return;
	    		//console.log(arr.join(","));
	    		var url="/busmap.kml?t="+t+"&eid="+eid+"&dur="+dur+"&ids="+arr.join(",");
	    		window.open(url,"_blank");
	    		//console.log(url);
	    	};
	        //-----------------------------------------------
	        function onPlayStopClick() {
	    		if ($(".play-stop-btn").hasClass("play")) {
	    			$(".play-stop-btn").removeClass("play");
	    			$(".play-stop-btn").addClass("stop");
	    			// play..
	    			play();
	    		} else {
	    			$(".play-stop-btn").removeClass("stop");
	    			$(".play-stop-btn").addClass("play");
	    			// stop
	    			stop();
	    		}
	    	}
	        $(".play-stop-btn").unbind("click");
	    	$(".play-stop-btn").click(onPlayStopClick);

	        $("#vis").unbind("mousedown",fix1);
	    	$("#vis").mousedown(fix1);
	    	//---------------------------------------
	    	function fix1() {
		    	$(document).unbind("mouseup",fix2);	    	
		    	$(document).mouseup(fix2);
	    	}
	    	function fix2() {
		    	$(document).unbind("mouseup",fix2);
	    		setTimeout(function() {
		    		$("#vis").mouseup();
	    		},0)
	    	}
	        $(".persons-toolbar .inner").unbind("mousedown",fix3);
	    	$(".persons-toolbar .inner").mousedown(fix3);
	        $(".persons-toolbar .inner").unbind("touchstart",fix3);
	    	$(".persons-toolbar .inner").bind("touchstart",fix3);
	        $(".persons-toolbar .inner").unbind("mouseup",fix4);
	    	$(".persons-toolbar").mouseup(fix4);
	        $(".persons-toolbar").unbind("touchend",fix4);
	    	$(".persons-toolbar").bind("touchend",fix4);
	    	//---------------------------------------
	    	function fix3() {
	    		$(".persons-toolbar").css("pointer-events","auto");
		        $(document).unbind("touchend",fix4);
		        $(document).bind("touchend",fix4);
	    		$(document).unbind("mouseup",fix4);	    	
		    	$(document).mouseup(fix4);
	    	}
	    	function fix4() {
	    		$(".persons-toolbar").css("pointer-events","none");
	    	}
	    	function keypress(e) {
	    		if(angular.element(document).find('md-dialog').length > 0) {
	    			// skip on popup
	    			return;
	    		}
	    		if (!($("md-sidenav._md-closed").length))
	    				return;
	    		var s = timeline.getWindow();
    			var a = s.start.getTime();
    			var b = s.end.getTime();
    			if (e.which == 32) {
	    			onPlayStopClick();
	    			e.preventDefault();
	    			e.stopPropagation();
	    		} else if (e.which == 48 && !e.ctrlKey) {
	    			if (mode == "play") onPlayStopClick();
	    		} else if (e.which == 49 && !e.ctrlKey) {
	    			$scope.$apply(function(){$scope.$parent.speed="1x";});
	    			if (mode == "stop") onPlayStopClick();
	    		} else if (e.which == 50 && !e.ctrlKey) { 
	    			$scope.$apply(function(){$scope.$parent.speed="2x";});
	    			if (mode == "stop") onPlayStopClick();
	    		} else if (e.which == 51 && !e.ctrlKey) {
	    			$scope.$apply(function(){$scope.$parent.speed="4x";});
	    			if (mode == "stop") onPlayStopClick();
	    		} else if (e.which == 52 && !e.ctrlKey) {
	    			$scope.$apply(function(){$scope.$parent.speed="8x";});
	    			if (mode == "stop") onPlayStopClick();
	    		} else if (e.which == 53 && !e.ctrlKey) {
	    			$scope.$apply(function(){$scope.$parent.speed="16x";});
	    			if (mode == "stop") onPlayStopClick();
	    		} else if (e.which == 37 && e.ctrlKey) { // left
	    			var ct = timeline.getCustomTime("crr").getTime()
	    			var cdiff = ct-timeline.getWindow().start.getTime();
	    			ct = fixTime(ct-Math.round((b-a)/100));
		        	setCurrentTime(ct);
	    			if (mode == "stop") 
	    				timeline.setWindow(Math.round(ct-cdiff),Math.round(ct-cdiff+(b-a)),{animation:false});
		        	onChange(); 
	    		} else if (e.which == 39 && e.ctrlKey) { // right
	    	        var ct = timeline.getCustomTime("crr").getTime()
	    			var cdiff = ct-timeline.getWindow().start.getTime();
	    			ct = fixTime(ct+Math.round((b-a)/100));
		        	setCurrentTime(ct);
	    			if (mode == "stop") 
	    				timeline.setWindow(Math.round(ct-cdiff),Math.round(ct-cdiff+(b-a)),{animation:false});
		        	onChange(); 
	    		} else if (e.which == 38 && e.ctrlKey) { // up
	    			timeline.setWindow(Math.round(a+(b-a)/20),Math.round(b-(b-a)/20),{animation:false});
	    			e.preventDefault();
	    			e.stopPropagation();
	    		} else if (e.which == 40 && e.ctrlKey) { // down
	    			timeline.setWindow(Math.round(a-(b-a)/20),Math.round(b+(b-a)/20),{animation:false});
	    			e.preventDefault();
	    			e.stopPropagation();
    			} else if (e.which == 122 /* F12 */) {
	    			e.preventDefault();
	    			e.stopPropagation();
	    			toggleFullScreen();
    			} 
    			function fixTime(t) {
    				if (levent && levent.beginTime && t < levent.beginTime)
    					return levent.beginTime;
    				if (levent && levent.endTime && t > levent.endTime)
    					return levent.endTime;
    				return t;
    			}
	    	}
	    	$(document).keydown(keypress);
	        $scope.$on("$destroy", function(){
		    	$(document).unbind("keydown",keypress);
	        });
	        $("#location-map").focus();
	    	//---------------------------------------
	    	onChange();
		}
	};
	//-------------------------------------------------------------
}})();   