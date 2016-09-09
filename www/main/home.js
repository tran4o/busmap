﻿(function () {
//-----------------------------------	
    angular
    	.module('app')
        .controller('HomeController', HomeController);

    HomeController.$inject = ['$rootScope','AuthenticationService','$mdDialog'];
    function HomeController($rootScope,AuthenticationService,$mdDialog) 
    {
    	$rootScope.moment=moment;
    	$rootScope.invitations=[];
    	$rootScope.missingPersons=[];
    	onLiveLankBoot(function() 
    	{
    		$rootScope.isAdmin = ($rootScope.globals.currentUser.userGroup == 1)
    		if (!$rootScope.isAdmin) 
    			doInv();
    		else {
        		LR.person.listMissingPersons(function(lres) 
        		{
        			var tres=lres.slice();
        			doInv();
        			$rootScope.$apply(function() {
        				$rootScope.missingPersons=lres;
        			});
        			oneLoc();
        			function oneLoc() {
        				var el = tres.shift();
        				if (!el) {
        					return;
        				}
        				LR.person.getGPSLocationName({imei:el.imei,lon:el.lon,lat:el.lat},function(res) {
        					if (res.txt && res.imei) {
        						$("#imei-"+res.imei+"-location").html(res.txt);
        					}
        					oneLoc();
        				});
        			}
        		});
    		}    		
    		function doInv() 
    		{
        		LR.person.getInvitations(function(lres) 
	    		{    		
	    			var rarr=[];
	    			one();
	    			function one() {
	    				var el =  lres.shift();
	    				if (!el) 
	    				{
	    					$rootScope.$apply(function() {
	    						$rootScope.invitations=rarr;
	    						// NASTY HACK BECAUSE OF SOME WEIRD ANGULAR BEHAVIOUR, CAN NOT ESCAPE SOME INITIAL NON-EXISTING-VALUE CREATION 
	    						// TODO FIXME 
	    						// src set to data-src instead direct to src
	    						setTimeout(function() {
	    							var a = $("img.invitation-owner-icon");
	    							var len = a.length;
	    							for (var i=0;i<len;i++) 
	    							{
	    								var val = $(a[i]).data("src");
	    								if (val && val.length) {
	        								$(a[i]).attr("src",val);
	    								}
	    							}
	    						},0);
	    					});
	    					return;
	    				}
	    				var res={invitation:el.invitation,totalJoined:el.total_joined,totalInvited:el.total_invited,startPos:el.start_pos,startGroup:el.start_group};
	    				if (el.event) 
	    				{
	            			LR.event.byId(el.event,function(event) {
	            				if (event < 0)
	            					oneDone();
	            				else {
	            					res.event=event;
	                				if (event.owner) {
	                					res.owner=event.owner;
	                				} 
	                				oneDone();
	            				}
	            			});
	    				}
	    				function oneDone() {
	    					var usr = res.owner || {}; 
	    		        	var arr = [];
	    		        	if (usr.lastName)
	    		        		arr.push(usr.lastName);
	    		        	if (usr.firstName)
	    		        		arr.push(usr.firstName);
	    		        	if (!arr.length && usr.code)
	    		        		arr.push(usr.code);
	    		        	var img = "";
	    		        	var ui = usr.image;
	    		        	if (!ui) {
	        		        	if (!ui && usr.gender == 'm')
	        		        		ui='images/missing-male.png';
	        		        	else
	        		        		ui='images/missing-female.png';
	    		        	}
	    		        	if (ui) 
	    		        		res.ownerImage=ui;
	    		        	res.color=usr.color;
	    		        	res.ownerText=!res.owner ? "Public event" : "Owner "+arr.join(", ");
	    		        	rarr.push(res);
	    		        	one();
	    				}
	    			}
	    			$rootScope.acceptInvitation=function(item) {
	    				LR.person.acceptInvitation({event : item.event.id},function(res) {
	    					if (res < 0) {
	    						alert("Execution terminated with error!");
	    						return;
	    					}
	    					$rootScope.$apply(function() {
	        					for (var i=0;i<$rootScope.invitations.length;i++) {
	        						var e = $rootScope.invitations[i];
	        						if (e.id == event.id) {
	        							$rootScope.invitations.splice(i,1);
	        							break;
	        						}
	        					}
	    					});
	    				});
	    			};
	    			$rootScope.removeInvitation=function(item) {
	    				LR.person.removeInvitation({event : item.event.id},function(res) {
	    					if (res < 0) {
	    						alert("Execution terminated with error!");
	    						return;
	    					}
	    					$rootScope.$apply(function() {
	        					for (var i=0;i<$rootScope.invitations.length;i++) 
	        					{
	        						var e = $rootScope.invitations[i];
	        						if (e.id == event.id) {
	        							$rootScope.invitations.splice(i,1);
	        							break;
	        						}
	        					}
	    					});
	    				});
	    			};
	    	        /*$rootScope.invitations=[{
	    	        	ownerText : "Huj, Bai",
	    	        	name: "Nai dalgiq beee!",
	    	        	totalJoined : 17,
	    	        	totalIntited : 30 
	    	        }]*/
	    		});
    		}
    	});
    	//------------------------
  	  function UploadGPXController($scope, $timeout,$mdDialog) 
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
  	  	  $scope.uploadData = function($event) 
  	  	  {
  	  		  var ps = $scope.pointDetails;
  	  		  $scope.beginTime.setSeconds(0);
  	  		  $scope.beginTime.setMilliseconds(0);
  	  		  var bt = $scope.beginTime.getTime();
  	  		  var et = (new Date($scope.beginTime));
  	  		  et.setHours($scope.endTime.getHours());
  	  		  et.setMinutes($scope.endTime.getMinutes());
  	  		  et=et.getTime();
  	  		  
  	  		  var ln = et-bt;
  	  		  if (!ln || ln < 0) {
  	  			  alert("Duration is not valid!");
  	  			  return;
  	  		  }
  	  		  if (!ps || !ps.length) {
  	  			  alert("Track data is invalid!");
  	  			  return;
  	  		  }
  	  		  var mint;
  	  		  var maxt;
  	  		  for (var i=0;i<ps.length;i++) 
  	  		  {
  	  			  var t = ps[i].t;
  	  			  if (!mint || t < mint)
  	  				  mint=t;
  	  			  if (!maxt || t > maxt)
  	  				  maxt=t;
  	  		  }
  	  		  
  	  		  var data=[];
  	  		  for (var i=0;i<ps.length;i++) 
  	  		  {
  	  			  var p = ps[i];
  	  			  var t = Math.round(bt+(et-bt)*(p.t-mint)/(maxt-mint));
  	  			  var spd = 0;
  	  			  var len = 0;
  	  			  if (i != 0) 
  	  			  {
  	  	  			  var pp = ps[i-1];
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
  	  				  uptimeSystem : (et-bt)*(p.t-mint)/(maxt-mint)/1000/60, // minutes
  	  				  uptimeConnection : (et-bt)*(p.t-mint)/(maxt-mint)/1000/60, // minutes
  	  				  lastError : 0,
  	  				  errorCnt : 0,
  	  				  grp : bt			// placeholder for the whole track 
  	  			  };
  	  			  data.push(rec);
  	  		  }
  	  		  LR.person.uploadGPXPositions({data:data},function(res) {
  	  			 if (res != 0)
  	  				 alert("ERROR UPLADING GPX POSITIONS!");
  	  			 else {
  	  				 alert("DONE OK!");
  	  				 $scope.$apply(function() {
  	  					 $scope.closeDialog();
  	  				 });
  	  			 }
  	  		  });
  	  	  };
  		  //------------------------------------
  		  $scope.trackLength = null;
  		  $scope.points=null;
  		  $scope.pointDetails=null;
  		  //------------------------------------
  		  var working=false;
  		  var trackData = null;
  		  var vector = null;
  		  var track;
  		  var map;
  		  //------------------------------------
  		  setTimeout(initMap,0);
  		  function replaceVector(url) 
  		  {
  			  if (vector) {
  				  map.removeLayer(vector);
  				  vector=undefined;
  			  }
  			  
  			  function doWork(points,pointDetails,btime,etime) {
  					//-----------------------------------------------------------------------
  					track = new Track();
  					track.bikeStartKM = $scope.bikeStart || 0;
  					track.runStartKM = $scope.runStart || 0;
  					track.route = [points,null,null];
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
  					$scope.$apply(function() {
  						$scope.pointDetails=pointDetails;
  						$scope.points=points;
  	  					$scope.trackLength = Math.round(track.getTrackLength()/1000.0*100)/100+" km.";
  	  					var b;
  	  					var e;
  	  					if (btime) {
  	  						b = new Date(parseInt(btime));
  	  						b.setSeconds(0);
  	  						b.setMilliseconds(0);
  	  						if (etime) {
  	  	  						e = new Date(parseInt(etime));
  	  	  						e.setSeconds(0);
  	  	  						e.setMilliseconds(0);
  	  						}
  	  						
  	  					} else {
  	  						if (etime) {
  	  	  						e = new Date(parseInt(etime));
  	  	  						e.setSeconds(0);
  	  	  						e.setMilliseconds(0);
  	  	  						e.setHours(8);
  	  	  						e.setMinutes(0);
  	  	  						b = new Date(e);
  	  	  						b.addHours(-4);
  	  						} else {
  	  	  						b = new Date();
  	  	  						b.setSeconds(0);
  	  	  						b.setMilliseconds(0);
  	  	  						b.setHours(8);
  	  	  						b.setMinutes(0);
  	  	  						e = new Date(b);
  	  	  						e.setHours(14);
  	  						}
  	  					}
  	  					if (b.getTime() > e.getTime()) {
  	  						var t=b;b=e;e=t;
  	  					}
  	  					
  						var td = new Date();
  						td.setFullYear(2016);
  						td.setMonth(0);
  						td.setDate(1);
  						td.setHours(0);
  						td.setMinutes(0);
  						td.setSeconds(0);
  						td.setMilliseconds(0)
  						var hmin = td.getTime();
  	  					//------------------------------------	
  						// FIX interval it begin < 01.01.2016
  	  					//------------------------------------	
  	  					if (b.getTime() < hmin) {
  	  						var diff = hmin - b.getTime();
  	  						b=new Date(hmin);
  	  						e=new Date(e.getTime()+diff);
  	  					}
  	  					//------------------------------------	
  	  					$scope.beginTime=b;
  	  					$scope.endTime=e;
  					});
  			  }
			  //begins with data:;base64,
			  url=url+"";
			  var txt;
			  var ind = url.indexOf(";base64,");
			  if (ind >= 0)
				  txt = Base64.decode(url.substring(ind+";base64,".length));
			  
			  if (txt)
			  gpxParse.parseGpx(txt, function(error, data) {
					if (error) {
						console.error("Unable to read GPX file "+error);
						return;
					}
					var points=[];
					var pdetails=[];
					var mint;
					var maxt;
					if (data.tracks) 
					{
						for (var po in data.tracks) 
						{
							var ttrack = data.tracks[po];
							for (var ph in ttrack.segments) 
							{
								var seq=ttrack.segments[ph];
								for (var ps in seg) 
								{
									var p = seq[ps];
									if (p.time) 
									{
  										if (!mint || p.time.getTime() < mint)
  											mint=p.time.getTime();
  										if (!maxt || p.time.getTime() > maxt)
  											maxt=p.time.getTime();
  										if (pdetails.length && p.time.getTime() == pdetails[pdetails.length-1].t) {
  											// TODO ??? SKIP ???
  											continue;
  										}
									}
									points.push([p.lon,p.lat]);
									pdetails.push({lon:p.lon,lat:p.lat,t:p.time.getTime(),alt:p.elevation});
								}
							}
						}
					}
					if (points.length < 2 || !mint || !maxt) {
						alert("Invalid track!");
						return;
					}						
					doWork(trackData=points,pdetails,mint,maxt);
			  });
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
  					center: ol.proj.transform(UI.Config.location.defaultCenter, 'EPSG:4326', 'EPSG:3857'),
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
  							track.bikeStartKM = $scope.bikeStart || 0;
  							track.runStartKM = $scope.runStart || 0;
  							var source = vector.getSource();
  							source.changed();
  							map.updateSize();
  					   }
  				  }
  				  $
  				  $scope.$watch("gpxFile.length",function() {
  					  if ($scope.gpxFile && $scope.gpxFile.length && $scope.gpxFile[0]) {
  						  var file = $scope.gpxFile[0].lfFile;
  						  if (file) 
  						  {
  							  var reader = new FileReader();
  				              reader.onload = function (loadEvent) {
  				            	  var data = loadEvent.target.result;
  								  replaceVector(data);
  				              }
  				              reader.readAsDataURL(file);
  						  }
  					  }
  				  });
  				  if (trackData && trackData.length) 
  					  replaceVector(trackData);
  			  });
  		  }

  	  }
  	  //--------------------------------------------
  	  //--------------------------------------------
  	  $rootScope.uploadGPX=function($event) {
  		  $mdDialog.show({
  		      controller: UploadGPXController,
  		      templateUrl: 'upload-gpx.html',
  		      parent: angular.element(document.body),
  		      targetEvent: $event,
  		      clickOutsideToClose:true,
  		      fullscreen: true
  		  });
  	  };
  	  //--------------------------------------------
    } // END OF HOME CONTROLLER
})();