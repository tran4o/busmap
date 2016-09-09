(function () {

	angular
	  	  .module('app')
	      .controller('LocationCtrl', LocationCtrl);
	
    function LocationCtrl ($scope,$mdDialog,$mdMedia) 
    {	
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
      function ShareLocationCtrl($mdEditDialog, $q, $scope, $timeout,$mdDialog) 
	  {
		  $scope.closeDialog=function() {
			  $mdDialog.hide();
		  };
		  
		  $scope.showAlertError = function(ev) {
			  alert('Action finished with error code or is not applicable!');
		  };
		  $scope.showAlertDone = function(ev) {
			   //('Done successefully!')
			  $scope.selectedPerson=null;
			  $scope.searchByNameText=null;
			  $scope.select=[];
			  $scope.selectionHack=false;
		  };
		  //------------------------------------

		  var working=false;
		  $scope.selectedPerson=null;
		  $scope.selectedClub=null;
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

		  $scope.$watch('selectedClub', function() {
			  $scope.selectedPerson=null;
			  $scope.searchByNameText=null;
		  });
		  
		  $scope.$watch('selectedPerson', function() {
			  if ($scope.selectedPerson)
				  $scope.selected = [];
		  });
		  //-----------------------------------------------------------------
		  $scope.onPersonSelectionChanged = function() {
			  if ($scope.selectedPerson)
				  $scope.selectedPerson=null;
			  if ($scope.searchByNameText && $scope.searchByNameText.length)
				  $scope.searchByNameText=null;			  
		  };
		  //-----------------------------------------------------------------
		  /* TODO REWRITE ME TODO CHECK PATCH FOR md-data-table TODO CHECK IF SET TIMEOUT CONVEXT CLEARED IN ALL BROWSERS (?!)
		     REASON : watch for 'selected' does not work with md-data-table (listed in the github issues page) ! */
		  //-----------------------------------------------------------------
		  $scope.mdOnSelect=function() {
			  if (!$scope.selected || !$scope.selected.length) {
				  $scope.oldSelected=null;
				  $scope.selectionHack=false;
				  return;
			  }

			  function save() {
				  var t = [];
				  for (var i=0;i<$scope.selected.length;i++) t.push($scope.selected[i]);
				  $scope.oldSelected=t;
				  $scope.onPersonSelectionChanged();
				  $scope.selectionHack = (t.length > 0);
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

		  $scope.queryClub = function(query) {
			  var defer = $q.defer();
			  var clubQuery = $scope.selectedClub;
			  LR.person.listClubs({where:"contains",filter:query,limit : 20,page:0},function(res) {
					 $scope.$apply(function() 
					 {
						 if (!res || !res.length) {
							 if (!res || res < 0)
								 console.error("Error list clubs | "+JSON.stringify(res));
							 defer.resolve({data:[]});
							 return;
						 }
						 else {
							 var arr=[];
							 for (var k in res)
								 arr.push((res[k]));
						    defer.resolve(arr);
						 }
					 });
			  });
			  return defer.promise;
		  };
		  
		  $scope.addPerson = function() {
			  if (!$scope.selectedPerson || !$scope.selectedPerson.id)
				  return;
			  if (working)
				  return;
			  working=true;
			  LR.person.shareLocation({share_to : $scope.selectedPerson.id},function(res) {
				  working=false;
				  $scope.$apply(function() {
					  $scope.getPersons();
					  if (res < 0)
						  $scope.showAlertError();
					  else
						  $scope.showAlertDone();
				  });
			  });
		  }
		  
		  $scope.removePersons = function() {
			  var arr=[];
			  if (!$scope.selected || !$scope.selected.length) {
				  if ($scope.selectedPerson && $scope.selectedPerson.id)
					  arr.push($scope.selectedPerson.id)
				  else 
					  return;
			  } else {
				  for (var e in $scope.selected) arr.push($scope.selected[e].id);
			  }
			  if (working)
				  return;
			  working=true;
			  one();
			  function one(res) 
			  {
				  if (res < 0) 
				  {
					  working=false;
					  $scope.$apply(function() {
						  $scope.showAlertError();
						  $scope.getPersons();
					  });
					  return;
				  }
				  var id = arr.shift()
				  if (!id) {
					  working=false;
					  $scope.$apply(function() {
						  $scope.showAlertDone();
						  $scope.getPersons();
					  });
					  return;
				  }
				  LR.person.shareLocation({share_to : id,doRemove:true},one);  
			  }			  
		  }

		  $scope.queryPersonByName = function(query) 
		  {
			  var defer = $q.defer();
			  var clubQuery = $scope.selectedClub;
			  LR.person.listIdsOrderBy({orderBy : "lastName,firstName,club",where:"contains",filter:query,clubFilter: clubQuery,limit : 20,page:0},function(res) {
					 $scope.$apply(function() 
					 {
						 if (!res || !res.length) {
							 if (!res || res < 0)
								 console.error("Error list persons order by lastName,firstName,club | "+JSON.stringify(res));
							 defer.resolve({data:[]});
							 return;
						 }
						 else {
							 var arr=[];
							 function one() {
								 var el = res.shift();
								 if (!el) {
									 defer.resolve(arr);
									 return;
								 }
								 LR.person.byId(el.id,function(res) {
									if (res && res.id) {
										var tr = [];
										var ta = [];
										if (res.lastName)
											ta.push((res.lastName));
										if (res.firstName)
											ta.push((res.firstName));
										tr.push(ta.join(" "));
										if (res.club)
											tr.push((res.club));
										if (res.description)
											tr.push((res.description));
										var hcode = tr.join("  |  ");
										res.display=hcode;
										arr.push(res);
									}
									one();
								 });
							 }
							 one();
						 }
					 });
			  });
			  return defer.promise;
		  };
		  		  
		  function success(persons) {
		     $scope.persons = persons;
		  }
		  
		  //   defer.reject(e); -> exception
		  //   defer.resolve(res); -> return res
		  
		  $scope.getPersons = function () {
			  if (working)
				 return;
			 working=true;
			 var defer = $q.defer()
			 $scope.promise = defer.promise;
			 $scope.promise.then(success);
			 var query = $scope.query;
			 //----------------------------
			 var where="share_location_with_persons";
			 //----------------------------
			 LR.person.listIdsOrderBy({where:where,isCount:true},function(cres) 
			 {
			     $scope.$apply(function() 
			     {			    	 
					 //console.log("CRES : "+JSON.stringify(cres));
					 if (cres && cres.length == 1) 
					 {					 
						 $scope.objectCount=cres[0].id;
						 LR.person.listIdsOrderBy({orderBy : query.order,limit : query.limit,where:where,page:query.page-1},function(res) {
					
							 $scope.$apply(function() {
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
		  //-------------
		  $scope.getPersons();
	  }
	  //--------------------------------------------
	  $scope.openShareLocation=function($event) {
		  $mdDialog.show({
		      controller: ShareLocationCtrl,
		      templateUrl: 'share-location.html',
		      parent: angular.element(document.body),
		      targetEvent: $event,
		      clickOutsideToClose:true,
		      fullscreen: true
		  });
	  };
//---------------------------------------------------------------------------------------------------------------------------------------------
// VISIBILITY CTRL 
//---------------------------------------------------------------------------------------------------------------------------------------------
	  function CustomizeLocationVisibility($mdEditDialog, $q, $scope, $timeout,$mdDialog) 
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
					  LR.person.setLocationVisibility({person:e,visibility:false},function() { $scope.$apply(function() {doRemove(onDone);}); });
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
					  LR.person.setLocationVisibility({person:e,visibility:true},function() { $scope.$apply(function() {doAdd(onDone);}); });
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
				  localStorage.setItem("location-watched",null);
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
			  LR.person.setLocationVisibility({visibility:true,where:where,nameFilter:$scope.searchName,clubFilter:$scope.searchClub,nationalityFilter : $scope.searchNationality},function() {
				  working=false;
				  $scope.$apply($scope.getPersons);
				  localStorage.setItem("location-watched",null);
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
			  LR.person.setLocationVisibility({visibility:false,where:where,nameFilter:$scope.searchName,clubFilter:$scope.searchClub,nationalityFilter : $scope.searchNationality},function() {
				  working=false;
				  $scope.$apply($scope.getPersons);
				  localStorage.setItem("location-watched",null);
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
			 var where=["shared_locations"];
			 if ($scope.searchName && $scope.searchName.length)
				 where.push("name");
			 if ($scope.searchClub && $scope.searchClub.length)
				 where.push("club");
			 if ($scope.searchNationality && $scope.searchNationality.length)
				 where.push("nationality");
			 //----------------------------
			 LR.person.listIdsOrderBy({where:where,isCount:true,nameFilter:$scope.searchName,clubFilter:$scope.searchClub,nationalityFilter : $scope.searchNationality},function(cres) 
			 {
			     $scope.$apply(function() 
			     {			    	 
					 if (cres && cres.length == 1) 
					 {					 
						 $scope.objectCount=cres[0].id;
						 LR.person.listIdsOrderBy({visibility:"location",orderBy : query.order,limit : query.limit,where:where,page:query.page-1,nameFilter:$scope.searchName,clubFilter:$scope.searchClub,nationalityFilter : $scope.searchNationality},function(res) {
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
	  $scope.customizeLocationVisibility=function($event) {
		  $mdDialog.show({
		      controller: CustomizeLocationVisibility,
		      templateUrl: 'customize-location-visibility.html',
		      parent: angular.element(document.body),
		      targetEvent: $event,
		      clickOutsideToClose:true,
		      fullscreen: true
		  }).finally(function() {
			  if ($scope.posCtrl)
				  $scope.posCtrl.onVisibilityDialogClose();
          });
	  };
	  //--------------------------------------------
	  $scope.registerPosCtrl= function(posCtrl) 
	  {
		  $scope.posCtrl=posCtrl;
		  $scope.$apply(function() {
			  $scope.graphMode=posCtrl.graphMode;	  
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