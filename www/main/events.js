(function () {
  angular
  	  .module('app')
      .controller('EventsCtrl', EventsCtrl);
  
  function EventsCtrl ($scope,$mdDialog) 
  {	  
	  $.getJSON( "/list-img.json", function( data ) {
		  if (data && data.length) {
			  $scope.$apply(function() {
				  $scope.imgFiles=data;
			  });
		  }
	  });
	  var defCenter = UI.Config.location.defaultCenter;
	  //--------------------------------------------------------------
	  // NASTY HACK BECAUSE OF SOME WEIRD ANGULAR BEHAVIOUR (see home.js)
	  function hackImages() 
	  {
			setTimeout(function() {
				var a = $("img.to-fix-src");
				var len = a.length;
				for (var i=0;i<len;i++) 
				{
					var val = $(a[i]).attr("data-src");
					$(a[i]).attr("src",val);
				}
			},0);
	  }
	  //--------------------------------------------------------------
	  $scope.hasChanged=false;
	  $scope.eventFilter="all";
	  if (typeof localStorage != "undefined" && localStorage.getItem("event-filter")) {
		  $scope.eventFilter=localStorage.getItem("event-filter");
	  }
	  var oldEventFilter=$scope.eventFilter;
	  if (typeof localStorage != "undefined")
	  {
		$scope.$watch("eventFilter",function() 
		{
		  localStorage.setItem("event-filter",$scope.eventFilter);
		  if ($scope.eventFilter && typeof LR != "undefined") {
			  if (oldEventFilter != $scope.eventFilter) {
				  oldEventFilter=$scope.eventFilter;
				  $scope.refreshTabs();
			  }
		  }
		});
	  }

	  function checkChanges(tab) {
		  function cnv(e) {
			  if (e instanceof Date) {
				  return e.getTime();
			  }
			  return e+"";
		  }
		  $scope.hasChanged = (tab.origSwimCount  != tab.swimCount || tab.origBikeCount  != tab.bikeCount || tab.origRunCount  != tab.runCount || tab.origCode != tab.code || tab.origName != tab.name || cnv(tab.beginTime) != cnv(tab.origBeginTime) || cnv(tab.endTime) != cnv(tab.origEndTime));
	  }
	  
	  function fixEvent(res) {
			res.isOwner = ($scope.globals.currentUser && res.owner && res.owner.id == $scope.globals.currentUser.id);
			res.origCode = res.code;
			res.origName = res.name;
			res.origBeginTime = res.beginTime;
			res.origEndTime = res.endTime;
			res.origSwimCount = res.swimCount;
			res.origBikeCount = res.bikeCount;
			res.origRunCount = res.runCount;
			return res;
	  }
	  var oldHandlers=[];
	  var oldMaps=[];
	  
	  $scope.attachWatch=function() {
		  for (var i=0;i<oldHandlers.length;i++)
			  oldHandlers[i]();
		  for (var i=0;i<oldMaps.length;i++)
			  oldMaps[i].setTarget(null);
		  oldHandlers=[];
		  oldMaps=[];
		  var data={};
		  if ($scope.tabs && $scope.tabs.length)
		  for (var k in $scope.tabs) 
		  {
				var e = $scope.tabs[k];
			    function chk() {
			    	checkChanges(this);
			    }
				oldHandlers.push($scope.$watch("tabs["+k+"].code",chk.bind(e)));
				oldHandlers.push($scope.$watch("tabs["+k+"].name",chk.bind(e)));
				oldHandlers.push($scope.$watch("tabs["+k+"].beginTime",chk.bind(e)));
				oldHandlers.push($scope.$watch("tabs["+k+"].endTime",chk.bind(e)));
			   data["event-map-tab-"+e.id]=e;
		  }
		  //$scope.tabs=[];
		  
		  // CREATE MAP WIDGET
		  setTimeout(function() {
			  for (var i in data) 
			  {
				  var e = data[i]
				  if ($("#"+i).data("done")) {
					  return;
				  }
				  $("#"+i).data("done","1");
				  var map = new ol.Map({
					  renderer : "canvas",
					  target: i,
					  layers: [
					           new ol.layer.Tile({
					               source: new ol.source.OSM()
					           })
							//,this.trackLayer,
					  ],
					  view: new ol.View({
						center: ol.proj.transform(defCenter, 'EPSG:4326', 'EPSG:3857'),
						zoom: 8,
						minZoom: 3,
						maxZoom: 17
					  })
				  });
				  
				  if (e.track) {
					  var track = new Track();
					  track.swimCount = e.swimCount || 1;
					  track.bikeCount = e.bikeCount || 1;
					  track.runCount = e.runCount || 1;
					  track.route = e.track;
					  track.init();										  
					  var features=[track.getFeature()];
					  var source = new ol.source.Vector({
						features: features
					  });
					  vector = new ol.layer.Vector({
						  source : source
					  });
					  map.addLayer(vector);
					  map.getView().fit(source.getExtent(), map.getSize());
					  //$scope.trackLength = Math.round(track.getTrackLength()/1000.0*100)/100+" km.";
				  }
				  oldMaps.push(map);
			  }
		  },250);
	  };
	  
	  $scope.showAlertError = function(ev) {
		    $mdDialog.show(
		      $mdDialog.alert()
		        .parent(angular.element(document.querySelector('#popupContainer')))
		        .clickOutsideToClose(true)
		        .title('Execution failed')
		        .textContent('Action finished with error code or is not applicable!')
		        .ok('Continue')
		        .targetEvent(ev)
		    );
	  };

	  $scope.showAlertDone = function(ev) {
		    $mdDialog.show(
		      $mdDialog.alert()
		        .parent(angular.element(document.querySelector('#popupContainer')))
		        .clickOutsideToClose(true)
		        .title('Done successefully!')
		        .ok('OK')
		        .targetEvent(ev)
		    );
	  };
	  
	  $scope.showConfirmRemove = function(ev,tab) {
		    // Appending dialog to document.body to cover sidenav in docs app
		    var confirm = $mdDialog.confirm()
		          .title('Are you sure?')
		          .textContent('Deleted objectes are not recoverable!')
		          .targetEvent(ev)
		          .ok('Yes, Delete it!')
		          .cancel('No, Cancel');
		    $mdDialog.show(confirm).then(function() {
		    	$scope.removeTab(tab);
		    }, function() {
		    });
		  };
		  
	  $scope.selectedIndex=0;	  
	  var tabs=[];
	  var working = false;
	  $scope.newEvent = function () 
	  {
		if (working) 
			return;
		working=true;
		var code = "Event "+(new Date().getTime());		
		var name = "New event";
		var beginTime=new Date();
		beginTime.setHours(0);
		beginTime.setMinutes(0);
		beginTime.setSeconds(0);
		beginTime.setMilliseconds(0);
		beginTime.setDate(beginTime.getDate()+1);
        var b = new Date(beginTime);
        b.setHours(8);
        var e = new Date(beginTime);
        e.setHours(13);
        LR.event.create({code:code,name:name,beginTime:b,endTime:e},function(res) {
        	working=false;
        	if (!res || !res.id)
        		$scope.showAlertError();
        	else {
        		res=fixEvent(res);
                tabs.push(res);
                $safeScope($scope,function() {
    				$scope.tabs=tabs;
    				$scope.attachWatch();
    				hackImages();
                });
        	}
        })
	  };
	  
	  $scope.cancelEvent = function (event) 
	  {
			if (!event.id)
				return;
			if (working) 
				return;
			working=true;
	        LR.event.byId(event.id,function(res) {
	        	working=false;
	        	if (!res || !res.id)
	        		$scope.showAlertError();
	        	else {
	        		$safeScope($scope,function() {
	        			for (var e in event) if (e != "favorite") delete event[e];
	        			for (var e in res) event[e]=res[e];
	                    fixEvent(event);
	                });
	        	}
	        });
	  }; 

	  $scope.setFavorite = function ($event,event) 
	  {
		if (working) 
			return;
		working=true;
		LR.event.setFavorite({event:event.id,favorite:!event.favorite},function(res) {
        	working=false;
        	if (typeof res != "boolean")
        		$scope.showAlertError();
        	else {
        		$safeScope($scope,function() {
        			event.favorite=res;
					hackImages();
                });
        	}
        });
	  };
	  $scope.postFixEvent = function (event,onSaveDone) {
		  $scope.saveEvent(event,onSaveDone,true)  
	  };
	  $scope.saveEvent = function (event,onSaveDone,doPostFix) 
	  {
		if (working) 
			return;
		var te = {};
		for (var e in event)
			te[e]=event[e];
		if (te.beginTime && te.endTime) 
		{
			var t = new Date(te.beginTime);
			t.setHours(te.endTime.getHours());
			t.setMinutes(te.endTime.getMinutes());
			te.endTime=t;
			if (te.beginTime > te.endTime) {
				t=te.beginTime;te.beginTime=te.endTime;te.endTime=t;
			}
		}
		if (te.owner)
			te.owner = te.owner;
		working=true;
		te.doPostFix=doPostFix;
		LR.event.update(te,function(res) {
        	working=false;
        	if (!res || !res.id)
        		$scope.showAlertError();
        	else {
        		$safeScope($scope,function() {
        			for (var e in event) if (e != "favorite") delete event[e];
        			for (var e in res) event[e]=res[e];
        			fixEvent(event);
                    if (onSaveDone)
                    	onSaveDone();
                    else
                    	$scope.hasChanged=false;
                    	$scope.showAlertDone();
                });
        	}
        });
	  };

	  $scope.removeTab = function (tab) {
        var index = tabs.indexOf(tab);	        
        tabs.splice(index, 1);
        if (tab.id)
        LR.event.remove({id:tab.id},function(res) {
        	if (res < 0)
        		$scope.showAlertError();
        })
	  };
	  //-------------------------------------------------------------------------------------------------
	  var isFirstRefreshDone=false;
	  $scope.refreshTabs = function() 	  
	  {
		  isFirstRefreshDone=true;
		  tabs.length=0;
		  setTimeout(function() {
			  LR.event.listIds({filter:$scope.eventFilter,selectFavorite:true},function(res) 
			  {
				  one();
				  function one() 
				  {
					  var d = res.shift();
					  if (!d) 
					  {
						  // DONE
			              $safeScope($scope,function() 
						  {
							  $scope.tabs=tabs;
							  $scope.attachWatch();
							  hackImages();
						  });
						  return;
					  }
					  var e = d.id;
					  var fav = d.favorite;
					  LR.event.byId(e,function(res) {
				          res=fixEvent(res);
				          res.favorite=fav;
						  tabs.push(res);
						  one();
					  });
				  }
			  });
		  },0);
	  };
	  //-------------------------------------------------------------------------------------------------
	  onLiveLankBoot(function(isDirect) 
	  {
		  // working only on dalayed execution (TODO?)
		  if (!isDirect)
			  $scope.refreshTabs();
		  else if (!isFirstRefreshDone)
			  $scope.refreshTabs();
	  });
	  //-------------------------------------------------------------------------------------------------
	  var parentScope = $scope;
	  var crrEvent = null;
	  function EditTrackController($scope, $timeout,$mdDialog) 
	  {
		  $scope.imgFiles=parentScope.imgFiles;
		  $scope.closeDialog=function() {
			  $mdDialog.hide();
		  };
		  $scope.showAlertError = function(ev) {
			  alert('Action finished with error code or is not applicable!');
		  };
		  $scope.showAlertDone = function(ev) {
			   //('Done successefully!')
		  };
		  $scope.saveTrack=function() {
			  if ($scope.swimCount < 1 || $scope.bikeCount < 1 || $scope.runCount < 1)
				  return $scope.showAlertError();
			  crrEvent.swimCount=$scope.swimCount;
			  crrEvent.bikeCount=$scope.bikeCount;
			  crrEvent.runCount=$scope.runCount;
			  crrEvent.track=trackData;
			  parentScope.saveEvent(crrEvent,$scope.closeDialog);
		  };
		  //------------------------------------
		  $scope.swimCount = crrEvent.swimCount;
		  $scope.bikeCount = crrEvent.bikeCount;
		  $scope.runCount = crrEvent.runCount;
		  $scope.trackLength = null;
		  //------------------------------------
		  var working=false;
		  var vector = null;
		  var vectorPois = null;
		  var track;
		  var map;
		  //------------------------------------
		  if (crrEvent.track && crrEvent.track.length) {
			  var sumx=0.0;
			  var sumy=0.0;
			  var cc=0;
			  for (var i in crrEvent.track) 
			  {
				  var c = crrEvent.track[i];
				  if (c && c.length) 
				  {
					  for (var j in c) 
					  {
						  sumx+=c[j][0];
						  sumy+=c[j][1];
						  cc++;
					  }
				  }
			  }
			  sumx/=cc;
			  sumy/=cc;
			  defCenter=[sumx,sumy];
		  }
		  setTimeout(initMap,0);
		  var okey;
		  function replaceVector(urlSwim,urlBike,urlRun) 
		  {
			  var key = urlSwim+"."+urlBike+"."+urlRun;
			  if (okey && okey != key)
				  delete crrEvent.pois;				  
			  if (vectorPois) {
				  map.removeLayer(vectorPois);
				  vectorPois=undefined;
			  }
			  if (vector) {
				  map.removeLayer(vector);
				  vector=undefined;
			  }
			  trackData=[];
			  function doSwim(points) {
					//-----------------------------------------------------------------------
					trackData.push(points);					
					if (typeof urlBike == "string") {
						parseUrl(urlBike,doBike);
					} else {
						doBike(urlBike);
					}			  
			  }
			  function doBike(points) {
					//-----------------------------------------------------------------------
					trackData.push(points);					
					if (typeof urlRun == "string") {
						parseUrl(urlRun,doRun);
					} else {
						doRun(urlRun);
					}			  
			  }
			  function doRun(points) {
					trackData.push(points);
					track = new Track();
					track.swimCount = $scope.swimCount || 1;
					track.bikeCount = $scope.bikeCount || 1;
					track.runCount = $scope.runCount || 1;
					track.route = trackData;
					track.init();					
					var features=[track.feature];
					var source = new ol.source.Vector({
						    features: features
					});
					vector = new ol.layer.Vector({
						source : source
				    });
					map.addLayer(vector);
					LR.event.getElapsedData(crrEvent.id,function(res) {
						  var features=[];
						  var source = new ol.source.Vector({
							features: features
						  });
						  vectorPois = new ol.layer.Vector({
							  source : source,
							  style : UI.Styles["elapsed"]
						  });
						  //-------------------------------------------------------------
						  if (res && res.length) 
						  {
							  for (var i in res) 
							  {
								  var p = res[i];
								  var mpos = ol.proj.transform([p.lon,p.lat], 'EPSG:4326', 'EPSG:3857');
								  var feature = new ol.Feature(new ol.geom.Point(mpos));
								  feature.elapsed=p.elapsed;
								  feature.data=p;
								  feature.getIcon=function(elapsed) {
									if (crrEvent.pois && crrEvent.pois[elapsed] ) {
										return crrEvent.pois[elapsed];
									}
									return null;
								  };
								  source.addFeature(feature);
							  }
							  //-------------------------------------------------------------
							  var attached=false;
							  map.on("click", function(e) 
							  {
								  $scope.$apply(function() 
								  {
									  $scope.selectedPoi=undefined; 
									  var wbest = undefined; 
									  var best = undefined;
									  map.forEachFeatureAtPixel(e.pixel, function (feature, layer) {
											if (layer == vectorPois) {
												var a = e.coordinate[0]-feature.getGeometry().getCoordinates()[0];
												var b = e.coordinate[1]-feature.getGeometry().getCoordinates()[1];
												var dist = 	(a*a+b*b);
												if (!wbest || wbest > dist) {
													wbest=dist;
													best=feature;
												}
											}
									   });
									   if (best) 
									   {
											var d = best.data;
											var poi = undefined;
											if (crrEvent.pois)
												poi=crrEvent.pois[d.elapsed];
											$scope.selectedPoi=poi || { elapsed : d.elapsed };
											$scope.poiImage=$scope.selectedPoi.image;
											$scope.poiScale=$scope.selectedPoi.scale;
											$scope.poiX=$scope.selectedPoi.x;
											$scope.poiY=$scope.selectedPoi.y;
											$scope.poiName=$scope.selectedPoi.name;
									   }
								  });
							  });
							  map.addLayer(vectorPois);
						  }
					});
					map.getView().fit(source.getExtent(), map.getSize());
					$scope.trackLength = 
						" | swim "+Math.round(track.getTrackLength(0)/1000.0*100)/100+" km."+
						" | bike "+Math.round(track.getTrackLength(1)/1000.0*100)/100+" km."+
						" | run "+Math.round(track.getTrackLength(2)/1000.0*100)/100+" km."+
						" | TOTAL "+Math.round(track.getTrackLength()/1000.0*100)/100+" km.";
			  }
			  

			  function parseUrl(url,onDone) {
				  //begins with data:;base64,
				  url=url+"";
				  var txt;
				  var ind = url.indexOf(";base64,");
				  if (ind >= 0)
					  txt = Base64.decode(url.substring(ind+";base64,".length));
				  
				  if (txt)
				  gpxParse.parseGpx(txt, function(error, data) {
						if (error) {
							alert("Unable to read GPX file "+error);
							return;
						}
						var points=[];
						if (data.tracks) 
						{
							for (var po in data.tracks) 
							{
								var ttrack=data.tracks[po];
								for (var pk in ttrack.segments) 
								{
									var seq = ttrack.segments[pk];
									var rarr = [];
									for (var ps in seq)
									{
										var p = seq[ps];
										points.push([p.lon,p.lat]);
										rarr.unshift([p.lon,p.lat]);
									}
									//-------------------------------
									if (UI.Config.gpx.isLoop) {
										rarr.shift();
										for (var ps in rarr)
											points.push(rarr[ps]);
									}
								}
							}
						}
						if (points.length < 2) {
							alert("Invalid track!");
							return;
						}						
						onDone(points);
				  });  
			  }
			  if (typeof urlSwim == "string") {
				  parseUrl(urlSwim,doSwim);
			  } else {
				  doSwim(urlSwim);
			  }			  
		  }
		  
		  function initMap() 
		  {
			  map = new ol.Map({
				  renderer : "canvas",
				  target: 'gpx-preview-map',
				  layers: [
				           new ol.layer.Tile({
				               source: new ol.source.OSM()
				           })
						//,this.trackLayer,
				  ],
				  view: new ol.View({
					center: ol.proj.transform(defCenter, 'EPSG:4326', 'EPSG:3857'),
					zoom: 8,
					minZoom: 3,
					maxZoom: 17
				  })
				});
			  $scope.$apply(function() 
			  {
				  function refreshMap() 
				  {
					   if (track && vector) 
					   {
							track.swimCount = $scope.swimCount || 1;
							track.bikeCount = $scope.bikeCount || 1;
							track.runCount = $scope.runCount || 1;
							var source = vector.getSource();
							source.changed();
							map.updateSize();
					   }
				  }

				  
				  $scope.savePoiData = function() 
				  {
					  if ($scope.selectedPoi) 
					  {						  
						  // TODO FIX ME ANGULAR HORROR WHY NOT UPDATED!!!!
						  $scope.selectedPoi.scale=parseFloat($("#poiScale").val());
						  $scope.selectedPoi.x=parseFloat($("#poiX").val()) || 0;
						  $scope.selectedPoi.y=parseFloat($("#poiY").val()) || 0;
						  $scope.selectedPoi.name=$("#poiName").val();
						  var t = $("#hack1 md-select-value img").attr("src");
						  if (t) 
						  { 
							  t=t.split("/");
						  	  t=t[t.length-1];
					  	  } 
						  $scope.selectedPoi.image=t;
						  //$scope.selectedPoi.scale=parseFloat($scope.poiScale || 1);
						  //$scope.selectedPoi.x=parseFloat($scope.poiX) || 0;
						  //$scope.selectedPoi.y=parseFloat($scope.poiY) || 0;
						  //$scope.selectedPoi.name=$scope.poiName;
						  if (!crrEvent.pois)
							  crrEvent.pois={};
						  crrEvent.pois[$scope.selectedPoi.elapsed]=$scope.selectedPoi;
						  var f = vectorPois.getSource().getFeatures();
						  for (var k in f) f[k].changed();
						  map.render();
					  }
				  };
				  $scope.$watch("swimCount",refreshMap);
				  $scope.$watch("bikeCount",refreshMap);
				  $scope.$watch("runCount",refreshMap);			
				  $scope.$watch("gpxSwim.length",onSwimChange);
				  $scope.$watch("gpxBike.length",onBikeChange);
				  $scope.$watch("gpxRun.length",onRunChange);
				  var swimUrl=(crrEvent.track || [])[0];
				  var bikeUrl=(crrEvent.track || [])[1];
				  var runUrl=(crrEvent.track || [])[2];
				  if (swimUrl || bikeUrl || runUrl) 
					  replaceVector(swimUrl,bikeUrl,runUrl);

				  function onSwimChange() 
				  {
					  if ($scope.gpxSwim && $scope.gpxSwim.length && $scope.gpxSwim[0]) 
					  {
						  var file = $scope.gpxSwim[0].lfFile;
						  if (file) 
						  {
							  var reader = new FileReader();
				              reader.onload = function (loadEvent) {
				            	  swimUrl = loadEvent.target.result;
								  replaceVector(swimUrl,bikeUrl,runUrl);
				              }
				              reader.readAsDataURL(file);
						  }
					  }
				  }
				  
				  function onBikeChange() 
				  {
					  if ($scope.gpxBike && $scope.gpxBike.length && $scope.gpxBike[0]) 
					  {
						  var file = $scope.gpxBike[0].lfFile;
						  if (file) 
						  {
							  var reader = new FileReader();
				              reader.onload = function (loadEvent) {
				            	  bikeUrl = loadEvent.target.result;
								  replaceVector(swimUrl,bikeUrl,runUrl);
				              }
				              reader.readAsDataURL(file);
						  }
					  }
				  }
				  
				  function onRunChange() 
				  {
					  if ($scope.gpxRun && $scope.gpxRun.length && $scope.gpxRun[0]) 
					  {
						  var file = $scope.gpxRun[0].lfFile;
						  if (file) 
						  {
							  var reader = new FileReader();
				              reader.onload = function (loadEvent) {
				            	  runUrl = loadEvent.target.result;
								  replaceVector(swimUrl,bikeUrl,runUrl);
				              }
				              reader.readAsDataURL(file);
						  }
					  }
				  }
			  });
		  }
	  }
	  //--------------------------------------------
	  $scope.editTrack=function($event,tab /* real event */) {
		  crrEvent=tab;
		  parentScope=$scope;
		  $mdDialog.show({
		      controller: EditTrackController,
		      templateUrl: 'edit-track.html',
		      parent: angular.element(document.body),
		      targetEvent: $event,
		      clickOutsideToClose:true,
		      fullscreen: true
		  });
	  };
	  //--------------------------------------------
	  function InviteParticipantsController($mdEditDialog, $q, $scope, $timeout,$mdDialog) 
	  {
		  $scope.closeDialog=function() {
			  $mdDialog.hide();
		  };
		  $scope.showAlertError = function(ev) {
			  alert('Action finished with error code or is not applicable!');
		  };
		  $scope.showAlertDone = function(ev) {
			  alert('Done successefully!');
		 };
		  var working=false;
		  $scope.closeDialog=function() {
			  $mdDialog.hide();
		  };
		  //------------------------------------
		  var working=false;
		  $scope.selected = [];
		  $scope.filter = {
			options: {
			  debounce: 500
			}
		  };
		  $scope.query = {
			filter: '',
			limit: '20',
			order: 'lastNameToLower',
			page: 1
		  };
		  var intr;
		  var working=false;
		  var afterWorkDoneTryAgain=false;
		  //-----------------------------------------------------------------
		  function success(persons) {
			 $scope.persons = persons;
		  }		  
		  $scope.$watch('searchName', function() {
			  $scope.getPersons();
		  });
		  $scope.$watch('searchClub', function() {
			  $scope.getPersons();
		  });
		  $scope.$watch('searchNationality', function() {
			  $scope.getPersons();
		  });
		  $scope.getPersons = function () {
			  if (working)
				 return;
			 working=true;
			 var defer = $q.defer()
			 $scope.promise = defer.promise;
			 $scope.promise.then(success);
			 var query = $scope.query;
			 //----------------------------
			 var where=["not_invited"];
			 if ($scope.searchName && $scope.searchName.length)
				 where.push("name");
			 if ($scope.searchClub && $scope.searchClub.length)
				 where.push("club");
			 if ($scope.searchNationality && $scope.searchNationality.length)
				 where.push("nationality");
			 //----------------------------
			 LR.person.listIdsOrderBy({event:crrEvent.id,where:where,isCount:true,nameFilter:$scope.searchName,clubFilter:$scope.searchClub,nationalityFilter : $scope.searchNationality},function(cres) 
			 {
				 $scope.$apply(function() 
				 {			    	 
					 if (cres && cres.length == 1) 
					 {					 
						 $scope.objectCount=cres[0].id;
						 LR.person.listIdsOrderBy({event:crrEvent.id,orderBy : query.order,limit : query.limit,where:where,page:query.page-1,nameFilter:$scope.searchName,clubFilter:$scope.searchClub,nationalityFilter : $scope.searchNationality},function(res) {
							 $scope.$apply(function() 
							 {
								 if (!res || !res.length) {
									 if (!res || res < 0)
										 console.error("Error list persons order by "+query.order+" | "+JSON.stringify(res));
									 defer.resolve({data:[]});
									 working=false;
									 return;
								 }
								 else {
									 var arr=[];
									 function one() {
										 var el = res.shift();
										 if (!el) {
											 defer.resolve({data:arr});
											 working=false;
											 return;
										 }
										 LR.person.byId(el.id,function(res) {
											 if (res && res.id) {
												arr.push(res);
											}
											one();
										 });
									 }
									 one();
								 }
							 });
						 });
					 }
				 });
			 });
		  };
		  $scope.inviteAll = function () {
			  if (working)
				  return;
			  working=true;
			  var where=["not_invited"];
			  var query = $scope.query;
			  if ($scope.searchName && $scope.searchName.length)
				  where.push("name");
			  if ($scope.searchClub && $scope.searchClub.length)
				  where.push("club");
			  if ($scope.searchNationality && $scope.searchNationality.length)
				  where.push("nationality");
			  LR.person.listIdsOrderBy({event:crrEvent.id,where:where,nameFilter:$scope.searchName,clubFilter:$scope.searchClub,nationalityFilter : $scope.searchNationality},function(res) {
					 $scope.$apply(function() 
					 {
						 if (res && res.length) {
							 function oneRes() {
								 var el=res.shift();
					 			 if (!el) {
					 				 working=false;
					 				 $scope.$apply(function(){
										 $scope.showAlertDone();					 					
					 					 $scope.getPersons();
					 				 });
									 return;
					 			 }
					 			 LR.event.setParticipant({event:crrEvent.id,participant:el.id,invitation:$scope.invitation,startGroup:$scope.startGroup},oneRes);		 
							 }
							 oneRes();
						 } else {
							 working=false;
						 }
					 });
			  });
		  };
		  $scope.inviteSelected = function () {
			  if (working || !$scope.selected || !$scope.selected.length)
				  return;
			  working=true;
			  var where=["not_invited"];
			  var res = [];
			  for (var i in $scope.selected)
				  res.push($scope.selected[i].id)
			  function oneRes() {
				 var el=res.shift();
	 			 if (!el) {
	 				 working=false;
	 				 $scope.$apply(function(){
	 					 $scope.getPersons();
	 				 });
					 return;
	 			 }
	 			 LR.event.setParticipant({event:crrEvent.id,participant:el,invitation:$scope.invitation,startGroup:$scope.startGroup},oneRes);		 
			  }
			  oneRes();
		  };
		  //-------------
		  $scope.getPersons();
	  }
	  //--------------------------------------------
	  $scope.inviteParticipants=function($event,tab /* real event */) {
		  crrEvent=tab;
		  parentScope=$scope;
		  $mdDialog.show({
		      controller: InviteParticipantsController,
		      templateUrl: 'invite-participants.html',
		      parent: angular.element(document.body),
		      targetEvent: $event,
		      clickOutsideToClose:true,
		      fullscreen: true
		  });
	  };
	  //--------------------------------------------
	  function EditParticipantsController($mdEditDialog, $q, $scope, $timeout,$mdDialog) 
	  {
		  $scope.closeDialog=function() {
			  $mdDialog.hide();
		  };
		  $scope.showAlertError = function(ev) {
			  alert('Action finished with error code or is not applicable!');
		  };
		  $scope.showAlertDone = function(ev) {
			   //('Done successefully!')
		  };
		  var working=false;
		  $scope.showAlertError = function(ev) {
			  alert('Action finished with error code or is not applicable!');
		  };
		  $scope.showAlertDone = function(ev) {
			   //('Done successefully!')
		  };
		  //------------------------------------
		  var working=false;
		  $scope.isOwner = crrEvent.isOwner;
		  $scope.searchJoined=true;
		  $scope.selected = [];
		  $scope.filter = {
			options: {
			  debounce: 500
			}
		  };
		  $scope.query = {
			filter: '',
			limit: '20',
			order: 'startPos',
			page: 1
		  };
		  var intr;
		  var working=false;
		  var afterWorkDoneTryAgain=false;
		  //-----------------------------------------------------------------
		  function success(persons) {
			 $scope.persons = persons;
		  }		  
		  $scope.$watch('searchName', function() {
			  $scope.getPersons();
		  });
		  $scope.$watch('searchClub', function() {
			  $scope.getPersons();
		  });
		  $scope.$watch('searchNationality', function() {
			  $scope.getPersons();
		  });
		  $scope.$watch('searchJoined', function() {
			  $scope.getPersons();
		  });
		  $scope.getPersons = function () {
			  if (working)
				 return;
			 working=true;
			 var defer = $q.defer()
			 $scope.promise = defer.promise;
			 $scope.promise.then(success);
			 var query = $scope.query;
			 //----------------------------
			 var where=["invited"];
			 if ($scope.searchName && $scope.searchName.length)
				 where.push("name");
			 if ($scope.searchClub && $scope.searchClub.length)
				 where.push("club");
			 if ($scope.searchNationality && $scope.searchNationality.length)
				 where.push("nationality");
			 //----------------------------
			 LR.person.listIdsOrderBy({joined:$scope.searchJoined,event:crrEvent.id,where:where,isCount:true,nameFilter:$scope.searchName,clubFilter:$scope.searchClub,nationalityFilter : $scope.searchNationality},function(cres) 
			 {
				 $scope.$apply(function() 
				 {			    	 
					 if (cres && cres.length == 1) 
					 {					 
						 $scope.objectCount=cres[0].id;
						 LR.person.listIdsOrderBy({joined:$scope.searchJoined,event:crrEvent.id,orderBy : query.order,limit : query.limit,where:where,page:query.page-1,nameFilter:$scope.searchName,clubFilter:$scope.searchClub,nationalityFilter : $scope.searchNationality},function(res) {
							 $scope.$apply(function() 
							 {
								 if (!res || !res.length) {
									 if (!res || res < 0)
										 console.error("Error list persons order by "+query.order+" | "+JSON.stringify(res));
									 defer.resolve({data:[]});
									 working=false;
									 return;
								 }
								 else {
									 var arr=[];
									 function one() {
										 var el = res.shift();
										 if (!el) {
											 defer.resolve({data:arr});
											 working=false;
											 return;
										 }
										 LR.person.byId(el.id,function(res) {
											 if (res && res.id) {
												res.startPos=el.start_pos;
												res.startGroup=el.start_group;
												arr.push(res);
											}
											one();
										 });
									 }
									 one();
								 }
							 });
						 });
					 }
				 });
			 });
		  };
		  $scope.removeAll=function() {
			  if (confirm("Are you sure? All participant wiil be removed!") == true) {
				  if (working)
					  return;
				  working=true;
				  var where=["invited"];
				  LR.person.listIdsOrderBy({event:crrEvent.id,where:where},function(res) {
						 $scope.$apply(function() 
						 {
							 if (res && res.length) {
								 function oneRes() {
									 var el=res.shift();
						 			 if (!el) {
						 				 working=false;
						 				 $scope.$apply(function(){
											 $scope.showAlertDone();					 					
						 					 $scope.getPersons();
						 				 });
										 return;
						 			 }
						 			 LR.event.setParticipant({event:crrEvent.id,participant:el.id,doRemove:true},oneRes);		 
								 }
								 oneRes();
							 } else {
								 working=false;
							 }
						 });
				  });
			  }
		  };
		  $scope.removeSelected=function() {
			  if (working || !$scope.selected || !$scope.selected.length)
				  return;
			  working=true;
			  var where=["invited"];
			  var res = [];
			  for (var i in $scope.selected)
				  res.push($scope.selected[i].id);
			  function oneRes() 
			  {
				 var el=res.shift();
				 if (!el) {
					 working=false;
					 $scope.$apply(function(){
						 $scope.showAlertDone();					 					
						 $scope.getPersons();
					 });
					 return;
				 }
				 LR.event.setParticipant({event:crrEvent.id,participant:el,doRemove:true},oneRes);		 
			  }
			  oneRes();
		  };
		  //-------------
		  $scope.getPersons();
	  }
	  //--------------------------------------------
	  $scope.editParticipants=function($event,tab /* real event */) {
		  crrEvent=tab;
		  parentScope=$scope;
		  $mdDialog.show({
		      controller: EditParticipantsController,
		      templateUrl: 'edit-participants.html',
		      parent: angular.element(document.body),
		      targetEvent: $event,
		      clickOutsideToClose:true,
		      fullscreen: true
		  });
	  };
	  //--------------------------------------------
	  function EditGroupsController($mdEditDialog, $q, $scope, $timeout,$mdDialog) 
	  {
		  $scope.closeDialog=function() {
			  $mdDialog.hide();
		  };
		  $scope.showAlertError = function(ev) {
			  alert('Action finished with error code or is not applicable!');
		  };
		  $scope.showAlertDone = function(ev) {
			   //('Done successefully!')
		  };
		  var working=false;
		  $scope.showAlertError = function(ev) {
			  alert('Action finished with error code or is not applicable!');
		  };
		  $scope.showAlertDone = function(ev) {
			   //('Done successefully!')
		  };
		  //------------------------------------
		  var working=false;
		  $scope.isOwner = crrEvent.isOwner;
		  $scope.searchJoined=true;
		  $scope.selected = [];
		  $scope.filter = {
			options: {
			  debounce: 500
			}
		  };
		  $scope.query = {
			filter: '',
			limit: '20',
			order: 'code',
			page: 1
		  };
		  var intr;
		  var working=false;
		  var afterWorkDoneTryAgain=false;
		  //-----------------------------------------------------------------
		  function success(groups) {
			 $scope.groups = groups;
		  }
		  
		  $scope.editStartTime = function (e, group) {
			  e.stopPropagation();
			  var input;
			  var promise = $mdEditDialog.small({
			    modelValue: group.startTime,
			    placeholder: 'HH:mm',
			    save: function () {
			    	
			    	if (!input.$modelValue || !input.$modelValue.trim().length) {
				    	group.startTime=null;
			    	} else {
						 var m = moment(input.$modelValue,"HH:mm");
						 if (!m.isValid()) {
							 alert("Wrong time!");
							 return;
						 }
						 group.startTime=m.format('HH:mm');
			    	}
					var startTime=group.startTime;
					if (!startTime || !startTime.length)
						startTime=null;
					else {
						 startTime=moment(group.startTime,"HH:mm").toDate();
						 if (crrEvent.beginTime) {
							var t = new Date(crrEvent.beginTime);
							t.setHours(startTime.getHours());
							t.setMinutes(startTime.getMinutes());
							t.setSeconds(0);
							t.setMilliseconds(0);
							startTime=t;
						 }
						 startTime=startTime.getTime();
					}
					var endTime=group.endTime;
					if (!endTime || !endTime.length)
						endTime=null;
					else {
						 endTime=moment(group.endTime,"HH:mm").toDate();
						 if (crrEvent.beginTime) {
							 var t = new Date(crrEvent.beginTime);
							 t.setHours(endTime.getHours());
							 t.setMinutes(endTime.getMinutes());
							 endTime=t;
						 }
						 endTime=endTime.getTime();
					}
			    	LR.event.setGroupTimes({event:crrEvent.id,code:group.code,startTime:startTime,endTime:endTime},function(cres) {
						$scope.$apply(function() {
							$scope.getGroups();
						});
					});
			    },
			    targetEvent: e,
			    validators: {
			      'md-maxlength': 8
			    }
			  });
			  promise.then(function (ctrl) {
				input = ctrl.getInput();
				 input.$viewChangeListeners.push(function () {
				    });
			  });
		  };

		  $scope.editEndTime = function (e, group) {
			  e.stopPropagation();
			  var input;
			  var promise = $mdEditDialog.small({
			    modelValue: group.endTime,
			    placeholder: 'HH:mm',
			    save: function () {
			    	
			    	if (!input.$modelValue || !input.$modelValue.trim().length) {
				    	group.endTime=null;
			    	} else {
						 var m = moment(input.$modelValue,"HH:mm");
						 if (!m.isValid()) {
							 alert("Wrong time!");
							 return;
						 }
						 group.endTime=m.format('HH:mm');
			    	}
					var endTime=group.endTime;
					if (!endTime || !endTime.length)
						endTime=null;
					else {
						endTime=moment(group.endTime,"HH:mm").toDate();
						 if (crrEvent.beginTime) {
							var t = new Date(crrEvent.beginTime);
							t.setHours(endTime.getHours());
							t.setMinutes(endTime.getMinutes());
							t.setSeconds(0);
							t.setMilliseconds(0);
							endTime=t;
						 }
						 endTime=endTime.getTime();
					}
					var startTime=group.startTime;
					if (!startTime || !startTime.length)
						startTime=null;
					else {
						 startTime=moment(group.startTime,"HH:mm").toDate();
						 if (crrEvent.beginTime) {
							 var t = new Date(crrEvent.beginTime);
							 t.setHours(startTime.getHours());
							 t.setMinutes(startTime.getMinutes());
							 startTime=t;
						 }
						 startTime=startTime.getTime();
					}
			    	LR.event.setGroupTimes({event:crrEvent.id,code:group.code,startTime:startTime,endTime:endTime},function(cres) {
						$scope.$apply(function() {
							$scope.getGroups();
						});
					});
			    },
			    targetEvent: e,
			    validators: {
			      'md-maxlength': 8
			    }
			  });
			  promise.then(function (ctrl) {
				input = ctrl.getInput();
				 input.$viewChangeListeners.push(function () {
				    });
			  });
		  };

		  $scope.getGroups = function () {
			  if (working)
				 return;
			 working=true;
			 var defer = $q.defer()
			 $scope.promise = defer.promise;
			 $scope.promise.then(success);
			 var query = $scope.query;
			 //----------------------------
			 LR.event.listGroupsOrderBy({event:crrEvent.id,isCount:true},function(cres) 
			 {
				 $scope.$apply(function() 
				 {			    	 
					 if (cres && cres.length == 1) 
					 {					 
						 $scope.objectCount=cres[0].id;
						 LR.event.listGroupsOrderBy({event:crrEvent.id,orderBy : query.order,limit : query.limit,page:query.page-1},function(res) {
							 $scope.$apply(function() 
							 {
								 if (!res || !res.length) {
									 if (!res || res < 0)
										 console.error("Error list start groups order by "+query.order+" | "+JSON.stringify(res));
									 defer.resolve({data:[]});
									 working=false;
									 return;
								 }
								 else {
									 var arr=[];
									 function one() {
										 var el = res.shift();
										 if (!el) {
											 defer.resolve({data:arr});
											 working=false;
											 return;
										 }
										 if (el.start_time)
											 el.start_time=moment(el.start_time).format("HH:mm");
										 if (el.end_time)
											 el.end_time=moment(el.end_time).format("HH:mm");
										 arr.push({code:el.code,startTime : el.start_time,endTime : el.end_time,count:el.count});
										 one();
									 }
									 one();
								 }
							 });
						 });
					 }
				 });
			 });
		  };
		  //-------------
		  $scope.getGroups();
	  }
	  //--------------------------------------------
	  $scope.editGroups=function($event,tab /* real event */) {
		  crrEvent=tab;
		  parentScope=$scope;
		  $mdDialog.show({
		      controller: EditGroupsController,
		      templateUrl: 'edit-groups.html',
		      parent: angular.element(document.body),
		      targetEvent: $event,
		      clickOutsideToClose:true,
		      fullscreen: true
		  });
	  };
	  //--------------------------------------------

  }
  //--------------------------------------------
  // END MAIN CTRL
})();