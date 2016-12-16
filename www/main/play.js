(function () {

	angular
	  	  .module('app')
	      .controller('PlayCtrl', PlayCtrl);
    function PlayCtrl ($scope,$mdDialog,$mdMedia,$mdSidenav) 
    {
	    $scope.selectCrrPoi = function(ev) {
		    // Appending dialog to document.body to cover sidenav in docs app
		    var confirm = $mdDialog.prompt()
		      .title('Login as POI!')
		      .textContent('Enter POI code.')
		      .placeholder('Code')
		      .targetEvent(ev);
		    $mdDialog.show(confirm).then(function(result) {
		    	if (!$scope.posCtrl) {
		    		alert("Pos ctrl not initialized!");
		    		return;
		    	}
		    	if (!$scope.posCtrl.pois) {
		    		alert("No POIs defined!");
		    		return;
		    	}
		    	var tc=[];
		    	for (var k in $scope.posCtrl.pois) 
		    	{
		    		var pp = $scope.posCtrl.pois[k];
		    		if (pp.code == result) {
				    	localStorage.setItem("CRRPOI",result);
				    	localStorage.setItem("CRRPOIN",pp.name);
				    	$scope.crrPoiCode=result;
				    	$scope.crrPoiName=pp.name;
				    	$scope.posCtrl.crrPoiCode=result;
				    	$scope.posCtrl.crrPoiName=pp.name;
				    	$scope.posCtrl.crrBus=$scope.crrBus;
				    	return;
		    		}
		    		if (pp.code)
		    			tc.push(pp.code);
		    	}
		    	alert("POI with this code not found. Possible candidates are : "+tc.join(" | "));
		    }, function() {
		    	
		    });
		  };
		$scope.crrPoiCode = "UNKNOWN";
    	$scope.crrPoiName = "UNKNOWN";
    	if (localStorage.getItem("CRRPOI")) 
    		$scope.crrPoiCode=localStorage.getItem("CRRPOI");
    	if (localStorage.getItem("CRRPOIN")) 
    		$scope.crrPoiName=localStorage.getItem("CRRPOIN");
    	
    	
    	
    	
     	$scope.favGender="all";
    	$scope.favType="ALL";
    	$scope.doNotify=!(localStorage.getItem("doNotNotify") == "true");
		$scope.types =
			[
				{code : "ALL", name : "All"},
				{code : "PRO", name : "PRO"},
				{code : "AG", name : "AG"},
				{code : "VIP", name : "VIP"}
			];

    	function getParameterByName(name, url) {
    	    if (!url) url = window.location.href;
    	    name = name.replace(/[\[\]]/g, "\\$&");
    	    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
    	        results = regex.exec(url);
    	    if (!results) return null;
    	    if (!results[2]) return '';
    	    return decodeURIComponent(results[2].replace(/\+/g, " "));
       }
       //--------------------------------------------------------
        function buildToggler(navID) {
            return function() {
              // Component lookup should always be available since we are not using `ng-if`
              $mdSidenav(navID)
                .toggle()
                .then(function () {
                  //console.log("TOGGLE IS DONE!");
                });
            }
        }
        function calcFiltered()
        {
        	var lastData=[];
        	for (var i in $scope.participants) {
        		var p = $scope.participants[i];
        		if ($scope.favFirstName && $scope.favFirstName.length && (p.first_name||'').toUpperCase().indexOf($scope.favFirstName.toUpperCase()) < 0)
        			continue;
				if ($scope.favLastName && $scope.favLastName.length && (p.last_name||'').toUpperCase().indexOf($scope.favLastName.toUpperCase()) < 0)
					continue;
				if ($scope.favClub && $scope.favClub.length && (p.club||'').toUpperCase().indexOf($scope.favClub.toUpperCase()) < 0)
					continue;
				if ($scope.favGender && $scope.favGender != "all" && p.gender != $scope.favGender)
					continue;
				if ($scope.favType && $scope.favType != "ALL" && $scope.favType.length && !(p.type||'').toUpperCase().startsWith($scope.favType.toUpperCase()))
					continue;
				if ($scope.favStartPos && $scope.favStartPos.length && !((p.start_pos||'0')+"").startsWith($scope.favStartPos))
					continue;
				if ($scope.favStartGroup && $scope.favStartGroup.length && !((p.start_group||'')+"").startsWith($scope.favStartGroup))
					continue;
        		lastData.push(p)
        	}
        	$scope.filteredParticipants=lastData;
        	if ($scope.posCtrl) {
        		$scope.posCtrl.onFavSelectedChange();
        	}
        };
        $scope.toggleFav = function(id) 
        {
        	for (var i in $scope.participants) 
        	{
        		if ($scope.participants[i].id == id) 
        		{
        			$scope.participants[i].selected=!$scope.participants[i].selected;
                    if ($scope.posCtrl)
                    	$scope.posCtrl.updateFav(id,$scope.filteredParticipants);        	
        			break;
        		} 
        	}
        	calcFiltered();
        };
        $scope.showFav = function(part) {
        	if ($scope.posCtrl)
        		$scope.posCtrl.selectParticipant(part);        	
        	$mdSidenav('right').close();
        	calcFiltered();
        };
        $scope.updateFav=function(id) {
        	if ($scope.posCtrl)
        		$scope.posCtrl.updateFav(id,$scope.filteredParticipants);        	
        	calcFiltered();
        };
        $scope.addFav=function(id) {
        	if ($scope.posCtrl)
        		$scope.posCtrl.addFav(id,$scope.filteredParticipants);
        	calcFiltered();
        };
        $scope.removeFav=function(id) {
        	if ($scope.posCtrl)
        		$scope.posCtrl.removeFav(id,$scope.filteredParticipants);
        	calcFiltered();
        };
        $scope.$watch("doNotify",function() {
        	if ($scope.posCtrl)
        		$scope.posCtrl.setDoNotNotify(!$scope.doNotify);
        });
		$scope.$watch("participants",calcFiltered);
		$scope.$watch("favGender",calcFiltered);
		$scope.$watch("favFirstName",calcFiltered);
		$scope.$watch("favLastName",calcFiltered);
		$scope.$watch("favClub",calcFiltered);
		$scope.$watch("favType",calcFiltered);
		$scope.$watch("favStartPos",calcFiltered);
		$scope.$watch("favStartGroup",calcFiltered);
        $scope.filteredParticipants=[];
    	$scope.toggleLeft = buildToggler('left');
    	$scope.toggleRight = buildToggler('right');
    	$scope.eventId = parseInt(getParameterByName("event"));
    	
    	$scope.crrBus = getParameterByName("bus");
    	var ppoi = getParameterByName("poi");
    	if (ppoi) {
        	$scope.crrPoiCode=ppoi;
        	$scope.crrPoiName=undefined;
    	}
    	if ($scope.crrBus && !$scope.crrBus.length) 
    		$scope.crrBus=undefined;
    	
	   onLiveLankBoot(function() {
	       LR.event.byId($scope.eventId,function(res) {
	    	   setTimeout(function() {
		    	   $scope.$apply(function() {
		    		   $scope.eventCaption=res.name || res.code || res.id;
		    	   })
	    	   },0);
	       });
	   });
       //--------------------------------------------------------
       $scope.speed="1x";
       $scope.graphModes=UI.Config.graph.modes;
       $scope.graphMode = "speed";
       $scope.$watch("graphMode",function() {
    	   if ($scope.posCtrl && $scope.posCtrl.setGraphMode) {
    		   $scope.posCtrl.setGraphMode($scope.graphMode);
    	   }  
       });
       $scope.$watch("speed",function() {
    	   if ($scope.posCtrl && $scope.posCtrl.setSpeed && $scope.speed) {
    		   $scope.posCtrl.setSpeed(parseInt($scope.speed));
    	   }  
       });
//---------------------------------------------------------------------------------------------------------------------------------------------
// VISIBILITY CTRL 
//---------------------------------------------------------------------------------------------------------------------------------------------
	  function CustomizeVisibility($mdEditDialog, $q, $scope, $timeout,$mdDialog) 
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
		  //-----------------------------------------------------------------
		  /* TODO REWRITE ME TODO CHECK PATCH FOR md-data-table TODO CHECK IF SET TIMEOUT CONVEXT CLEARED IN ALL BROWSERS (?!)
		     REASON : watch for 'selected' does not work with md-data-table (listed in the github issues page) ! */
		  //-----------------------------------------------------------------
		  var intr;
		  var working=false;
		  var afterWorkDoneTryAgain=false;
		  
		  $scope.mdOnSelect=function() 
		  {
			  if (working) {
				  afterWorkDoneTryAgain=true;
				  return;
			  }
			  function forward(newState) {
				  var oldState = $scope.oldSelected;
				  var a={};
				  var b={};
				  if (oldState)
					  for (var e in oldState) a[oldState[e].id]=1;
				  if (newState)
					  for (var e in newState) b[newState[e].id]=1;
				  var toRemove = [];
				  var toAdd = [];
				  for (var e in a) 
				  {
					  if (!b[e])
						  toRemove.push(e);
				  }
				  for (var e in b) 
				  {
					  if (!a[e])
						  toAdd.push(e);
				  }
				  //------------------------
				  function doRemove(onDone) 
				  {
					  var e = toRemove.shift();
					  if (!e) 
					  {
						  if (!onDone) 
						  {
							  working=false;
							  if (afterWorkDoneTryAgain) {
								  afterWorkDoneTryAgain=false;
								  $scope.mdOnSelect(); 
							  }
						  } else {
							  onDone();
						  }
						  return;
					  }
					  LR.person.setEventVisibility({person:e,event:event,visibility:false},function() { $scope.$apply(function() {doRemove(onDone);}); });
				  }
				  
				  function doAdd(onDone) {
					  var e = toAdd.shift();
					  if (!e) 
					  {
						  if (!onDone) 
						  {
							  working=false;
							  if (afterWorkDoneTryAgain) {
								  aftersWorkDoneTryAgain=false;
								  $scope.mdOnSelect(); 
							  }
						  } else {
							  onDone();
						  }
						  return;
					  }
					  LR.person.setEventVisibility({person:e,event:event,visibility:true},function() { $scope.$apply(function() {doAdd(onDone);}); });
				  }
				  //------------------------
				  if (!toAdd.length) {
					  if (!toRemove.length) {
						  return;
					  }
					  // ONLY REMOVE
					  working=true;
					  afterWorkDoneTryAgain=false;
					  doRemove();
				  } else if (!toRemove.length) {
					  // ONLY ADD
					  working=true;
					  afterWorkDoneTryAgain=false;
					  doAdd();
				  } else {
					  // ADD AND REMOVE					  
					  working=true;
					  afterWorkDoneTryAgain=false;
					  doRemove(function() {
						  doAdd();
					  });
				  }
			  }
			  if (!$scope.selected || !$scope.selected.length) {
				  if ($scope.oldSelected  && $scope.oldSelected.length) {
					  forward(null);
					  $scope.oldSelected=null;
				  }
				  return;
			  }

			  function save() {
				  var t = [];
				  for (var i=0;i<$scope.selected.length;i++) t.push($scope.selected[i]);
				  forward(t);
				  $scope.oldSelected=t;
				  localStorage.setItem("event-watched",null);
			  }
	  
			  if (!$scope.oldSelected || !$scope.oldSelected.length || $scope.oldSelected.length != $scope.selected.length ) {
				  save();
				  return;
			  }
			  for (var i=0;i<$scope.selected.length;i++) 
			  {
				  if ($scope.selected[i].id != $scope.oldSelected[i].id) {
					  save();
					  return;
				  }
			  }
		  };
		  //-----------------------------------------------------------------
		  $scope.showAll = function () {
			  if (working)
				  return;
			  working=true;
			  var where=[];
			  if ($scope.searchName && $scope.searchName.length)
			      where.push("name");
			  if ($scope.searchClub && $scope.searchClub.length)
					 where.push("club");
			 if ($scope.searchNationality && $scope.searchNationality.length)
					 where.push("nationality");
			  LR.person.setEventVisibility({visibility:true,event:event,where:where,nameFilter:$scope.searchName,clubFilter:$scope.searchClub,nationalityFilter : $scope.searchNationality},function() {
				  working=false;
				  $scope.$apply($scope.getPersons);
				  localStorage.setItem("event-watched",null);
			  });
		  };
		  $scope.clearAll = function () {
			  if (working)
				  return;
			  working=true;
			  var where=[];
			  if ($scope.searchName && $scope.searchName.length)
			      where.push("name");
			  if ($scope.searchClub && $scope.searchClub.length)
					 where.push("club");
			 if ($scope.searchNationality && $scope.searchNationality.length)
					 where.push("nationality");
			  LR.person.setEventVisibility({visibility:false,event:event,where:where,nameFilter:$scope.searchName,clubFilter:$scope.searchClub,nationalityFilter : $scope.searchNationality},function() {
				  working=false;
				  $scope.$apply($scope.getPersons);
				  localStorage.setItem("event-watched",null);
			  });
		  };
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
			 var where=["event_participant"];
			 if ($scope.searchName && $scope.searchName.length)
				 where.push("name");
			 if ($scope.searchClub && $scope.searchClub.length)
				 where.push("club");
			 if ($scope.searchNationality && $scope.searchNationality.length)
				 where.push("nationality");
			 //----------------------------
			 LR.person.listIdsOrderBy({where:where,event:event,isCount:true,nameFilter:$scope.searchName,clubFilter:$scope.searchClub,nationalityFilter : $scope.searchNationality},function(cres) 
			 {
			     $scope.$apply(function() 
			     {			    	 
					 if (cres && cres.length == 1) 
					 {					 
						 $scope.objectCount=cres[0].id;
						 LR.person.listIdsOrderBy({visibility:"event",orderBy : query.order,limit : query.limit,where:where,page:query.page-1,nameFilter:$scope.searchName,clubFilter:$scope.searchClub,nationalityFilter : $scope.searchNationality},function(res) {
							 $scope.$apply(function() 
							 {
								 if (!res || !res.length) {
									 if (!res || res < 0)
										 console.error("Error list persons order by "+query.order+" | "+JSON.stringify(res));
									 defer.resolve({data:[]});
									 $scope.oldSelected=null;
									 $scope.selected=null;
									 working=false;
									 return;
								 }
								 else {
									 var arr=[];
									 var sel=[];
									 function one() {
										 var el = res.shift();
										 if (!el) {
											 defer.resolve({data:arr});
											 working=false;
											 $scope.oldSelected=sel.slice();
											 $scope.selected=sel;
											 return;
										 }
										 LR.person.byId(el.id,function(res) {
											 if (el.visibility)
												 sel.push(res);
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
		  //-------------
		  $scope.getPersons();
	  }
	  //--------------------------------------------
	  $scope.customizeVisibility=function($event) {
		  $mdDialog.show({
		      controller: CustomizeVisibility,
		      templateUrl: 'customize-visibility.html',
		      parent: angular.element(document.body),
		      targetEvent: $event,
		      clickOutsideToClose:true,
		      fullscreen: true
		  }).finally(function() {
			  if ($scope.posCtrl)
				  $scope.posCtrl.onVisibilityDialogClose();
          });
	  };
	  $scope.fullScreen=function($event) {
		  $scope.posCtrl.toggleFullScreen();
	  };
	  $scope.toggleFullScreen=function($event) {
		  $scope.posCtrl.toggleFullScreen();
	  };
	  //--------------------------------------------
	  $scope.onParticipantsLoaded = function(participants) {
		  // SELECTED HARDCODED BUSMAP TODO REDESIGN!
		  for (var i in participants) participants[i].selected=true;
		  $scope.participants = participants;
		  $scope.participantsLoaded=true;
	  };
	  $scope.registerPosCtrl = function(posCtrl) 
	  {
		  $scope.posCtrl=posCtrl;
		  $scope.pois={};
		  for (var i in $scope.posCtrl.pois) {
			  if ($scope.posCtrl.pois[i] && $scope.posCtrl.pois[i].code) {
				  $scope.pois[i]=$scope.posCtrl.pois[i];
			  }
		  }
		  $scope.$apply(function() {
			  $scope.graphMode=posCtrl.graphMode;
			  posCtrl.crrPoiCode=$scope.crrPoiCode;
			  if ($scope.crrPoiName) 
				  posCtrl.crrPoiName=$scope.crrPoiName;
			  else {
				  for (var i in $scope.pois) if ($scope.pois[i].code == $scope.crrPoiCode) {
				      posCtrl.crrPoiName=$scope.pois[i].name;
					  break;
				  }
			  }
		      posCtrl.crrBus=$scope.crrBus;
		  });
	  };
	  $scope.posOnYScaleChange = function(minY,maxY,dataType) {
		  var midY=Math.floor((minY+maxY)*50.0*$scope.posCtrl.getGraphMultiplier())/100.0;
		  minY=Math.floor(minY*100*$scope.posCtrl.getGraphMultiplier())/100.0;
		  maxY=Math.floor(maxY*100*$scope.posCtrl.getGraphMultiplier())/100.0;
		  if (isNaN(minY) || minY == undefined)
			  $("#vis-wrapper .y-scale-legend").hide();  
		  else {
			  $("#vis-wrapper .y-scale-legend").show()
			  $("#vis-wrapper .y-scale-legend .min").html(minY+" "+(dataType.unit||""));
		  }
		  if (isNaN(maxY) || maxY == undefined) {
			  $("#vis-wrapper .y-scale-legend").hide();
		  } else {
			  $("#vis-wrapper .y-scale-legend").show();
			  $("#vis-wrapper .y-scale-legend .max").html(maxY+" "+(dataType.unit||""));
		  }
		  
		  if (isNaN(midY) || midY == undefined || (dataType.staticLimits && dataType.staticLimits.hideMiddle)) {
			  $("#vis-wrapper .mid").hide();
		  } else {
			  $("#vis-wrapper .mid").show().html(midY+" "+(dataType.unit||""));
		  }
	  };
    }
})();