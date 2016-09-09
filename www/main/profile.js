(function () {
  angular
  	.module('app')
  	.controller('ProfileCtrl',ProfileCtrl)
	.config(function($mdThemingProvider) {
	    // Configure a dark theme with primary foreground yellow
	    $mdThemingProvider.theme('docs-dark', 'default')
	      .primaryPalette('yellow')
	      .dark();
  });
  
  function ProfileCtrl ($scope,$mdDialog,$mdMedia) 
  {
	var working = false;	
	var defBirth = new Date();
	defBirth.setYear(defBirth.getYear()-18);
	if (!$scope.user) 
	{
		$scope.user = {}; //$rootScope,globals.currentUser;
		setTimeout(function() {
			onLiveLankBoot(function() {
				$scope.$apply(function() {
					$scope.user=$scope.globals.currentUser;
				});
			});
		},0);
	}
    //------------------------------------------------------------------
	// PROFILE 
	//------------------------------------------------------------------
	  $scope.types =
		  [
			  {code : "PRO", name : "PRO"},
			  {code : "AG" , name : "AG"},
			  {code : "VIP", name : "VIP"}
		  ];
    var arr=[];
    for (var k in isoCountries)
    	arr.push({code:k,name:isoCountries[k]});
    $scope.countries = arr; 
    //------------------------------------
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
    //------------------------------------
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
	//------------------------------------
	var insideClick=false;
	$scope.openColorPopup=function($event){
		if (insideClick) {
			return;
		}
		insideClick=true;
		setTimeout(function() {
			$(".md-color-picker-result").show().focus().click();
			setTimeout(function() {
				insideClick=false;
			},0);
		},0);
	};
	//------------------------------------
	$scope.cancelUser = function(user,$event) {
    	if (working)
    		return;
    	working=true;
        LR.person.byId(user.id,function(res) {
        	working=false;
        	if (res && res.id) {
            	$safeScope($scope,function() {
            		$scope.user=res;
                });
        	}
        });	
    };
	$scope.saveUser = function(user,$event) {
    	if (working)
    		return;
    	working=true;
        LR.person.update(user,function(res) {
        	working=false;
        	if (!res || !res.id)
        		$scope.showAlertError();
        	else {
        		$safeScope($scope,function() {
        			$scope.user=res;
                    $scope.showAlertDone();                	
                    $scope.globals.currentUser=res; 

                });
        	}
        });	
    };
    //------------------------------------
	$scope.selectImage = function($event) 
	{
		var rootScope = $scope;
	    function CropCtrl ($rootScope,$scope,$mdDialog,$mdMedia) 
	    {
	        $scope.cropper = {};
	        $scope.cropper.sourceImage = null;
	        $scope.cropper.croppedImage = null;
	        $scope.cancelCrop=function() {
    			$mdDialog.hide();
	        };
	        $scope.acceptCrop=function() {
        		var t= $("#inputImageFile").val();
        		if (!t || !t.length) {
        			$mdDialog.hide();
        		} else {
        			rootScope.user.image = $("#cropped-image-result")[0].src; 
        			$mdDialog.hide();
        		}
	        };
	        
	        $scope.resetImage=function() {
	        	rootScope.user.image = null; 
        		$mdDialog.hide();
	        };
	        
	        // nasty js/angluar/jquery horror 
	        // todo : reimplement me 
	        $scope.cropDialogClick = function() {
        		var t= $("#inputImageFile").val();
        		if (!t || !t.length) { 
        			setTimeout(function() {
	        			$("#inputImageFile").show().focus().click().hide();
        			},0);
        		}
	        };
	        setTimeout(function() {
	        	$("#inputImageFile").show().focus().click().hide();
	        },0);
	    }
	    //------------------------------------
	    var useFullScreen = ($mdMedia('sm') || $mdMedia('xs'))  && $scope.customFullscreen;
	    $mdDialog.show({
	      controller: CropCtrl,
	      templateUrl: 'crop.html',
	      parent: angular.element(document.body),
	      targetEvent: $event,
	      clickOutsideToClose:true,
	      fullscreen: useFullScreen
	    });
	    $scope.$watch(function() {
	      return $mdMedia('xs') || $mdMedia('sm');
	    }, function(wantsFullScreen) {
	      $scope.customFullscreen = (wantsFullScreen === true);
	    });
	  };
	};
  
})();