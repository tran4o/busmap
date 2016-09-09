﻿// define hackintosh function for fixing the $scope context horror
window.$safeScope=function($scope,callback) {
	if($scope.$$phase)
		callback();
	else
		$scope.$apply(callback);
};
window.escapeHTML = function(string) {
	  return String(string).replace(/[&<>"'\/]/g, function (s) {
		  var entityMap = {
				    "&": "&amp;",
				    "<": "&lt;",
				    ">": "&gt;",
				    '"': '&quot;',
				    "'": '&#39;',
				    "/": '&#x2F;'
				  };
		  return entityMap[s];
	  });
};
window.Base64={_keyStr:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",encode:function(e){var t="";var n,r,i,s,o,u,a;var f=0;e=Base64._utf8_encode(e);while(f<e.length){n=e.charCodeAt(f++);r=e.charCodeAt(f++);i=e.charCodeAt(f++);s=n>>2;o=(n&3)<<4|r>>4;u=(r&15)<<2|i>>6;a=i&63;if(isNaN(r)){u=a=64}else if(isNaN(i)){a=64}t=t+this._keyStr.charAt(s)+this._keyStr.charAt(o)+this._keyStr.charAt(u)+this._keyStr.charAt(a)}return t},decode:function(e){var t="";var n,r,i;var s,o,u,a;var f=0;e=e.replace(/[^A-Za-z0-9+/=]/g,"");while(f<e.length){s=this._keyStr.indexOf(e.charAt(f++));o=this._keyStr.indexOf(e.charAt(f++));u=this._keyStr.indexOf(e.charAt(f++));a=this._keyStr.indexOf(e.charAt(f++));n=s<<2|o>>4;r=(o&15)<<4|u>>2;i=(u&3)<<6|a;t=t+String.fromCharCode(n);if(u!=64){t=t+String.fromCharCode(r)}if(a!=64){t=t+String.fromCharCode(i)}}t=Base64._utf8_decode(t);return t},_utf8_encode:function(e){e=e.replace(/rn/g,"n");var t="";for(var n=0;n<e.length;n++){var r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r)}else if(r>127&&r<2048){t+=String.fromCharCode(r>>6|192);t+=String.fromCharCode(r&63|128)}else{t+=String.fromCharCode(r>>12|224);t+=String.fromCharCode(r>>6&63|128);t+=String.fromCharCode(r&63|128)}}return t},_utf8_decode:function(e){var t="";var n=0;var r=c1=c2=0;while(n<e.length){r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r);n++}else if(r>191&&r<224){c2=e.charCodeAt(n+1);t+=String.fromCharCode((r&31)<<6|c2&63);n+=2}else{c2=e.charCodeAt(n+1);c3=e.charCodeAt(n+2);t+=String.fromCharCode((r&15)<<12|(c2&63)<<6|c3&63);n+=3}}return t}};
for (var e in UI.Utils)
    window[e] = UI.Utils[e];
//------------------------------------------------
(function () {
    'use strict';

    angular
        .module('app', ['ngRoute', 'ngCookies', 'ngMaterial', 'ngMessages', 'material.svgAssetsCache','angular-img-cropper','mdColorPicker','md.data.table','ngFlag','lfNgMdFileInput','slickCarousel'])
        .config(config)
        .run(run);
    
    
    config.$inject = ['$routeProvider', '$locationProvider'];
    function config($routeProvider, $locationProvider) {
        $routeProvider
            .when('/', {
                templateUrl: 'main/home.html',
                controllerAs: 'vm'
            })
            .when('/login', {
                controller: 'LoginController',
                templateUrl: 'main/login.html',
                controllerAs: 'vm'
            })

            .when('/login', {
                controller: 'LoginController',
                templateUrl: 'main/login.html',
                controllerAs: 'vm'
            })

            .when('/register', {
                controller: 'RegisterController',
                templateUrl: 'main/register.html',
                controllerAs: 'vm'
            })

            .when('/events', {
                templateUrl: 'main/events.html',
                controllerAs: 'vm'
            })

            .when('/location', {
                templateUrl: 'main/location.html',
                controllerAs: 'vm'
            })
            
            .when('/profile', {
                templateUrl: 'main/profile.html',
                controllerAs: 'vm'
            })

            .when('/play', {
                templateUrl: 'main/play.html',
                controllerAs: 'vm'
            })

            .otherwise({ redirectTo: '/login' });
    }

    
    var handlers=[];
    window.onLiveLankBoot=function(handler) {
    	if (!handlers)
    		handler(true);
    	else
    		handlers.push(handler);
    };
    
    
    run.$inject = ['$rootScope', '$location', '$cookieStore', '$http'];
    function run($rootScope, $location, $cookieStore, $http) {

    	$(function() {
    	    FastClick.attach(document.body);
    	});
    	
    	var restrictedPage = ($location.path() != '/login' && $location.path() != '/register'); 
    	$rootScope.restrictedPage = restrictedPage; 
        $rootScope.globals = $cookieStore.get('globals') || {};
        
        $rootScope.$watch("globals.currentUser",function() {
        	var usr=($rootScope.globals.currentUser) || {};
        	var arr = [];
        	if (usr.lastName)
        		arr.push(usr.lastName);
        	if (usr.firstName)
        		arr.push(usr.firstName);
        	var img = "";
        	var ui = usr.image;
        	if (!ui && usr.gender == 'm')
        		ui='images/missing-male.png';
        	if (!ui && usr.gender == 'f')
        		ui='images/missing-female.png';
        	if (ui) {
        		img="<a href='#/'><img ";
        		if (usr.color) {
        			img+="style='background-color:"+usr.color+"' ";
        		}
        		img+="src='"+ui+"' id='user-header-icon'/></a>";" +";
        	}        	 
        	$("#user-header-info").html(img+escapeHTML(arr.join(", ")));
        })

    	// CONNECT TO DEFAULT LOCATION (THIS SERVER)
    	busMapApi(null,function(api) 
    	{
    		window.LR = api;
            // keep user logged in after page refresh
            var usr = $rootScope.globals.currentUser;
            $rootScope.globals.loggedIn=false;
            if (usr && usr.username && usr.password) 
            {
                LR.login(usr.username,usr.password,function(res) {
                	if (res && res.id) {
                		$rootScope.globals.currentUser=res;
                    	// TODO : can not solve it directly with angular dep (COPIED IN login.controller.js ALSO)
                    	document.getElementById("header-tabs").className="header-tabs";
                        for (var k in handlers) {
                        	handlers[k]();
                        }
                        handlers=null;
                	} else {
                		$rootScope.globals.currentUser={};
                	}
                })
            } else {
                $location.path('/login');
            }
            $rootScope.$on('$locationChangeStart', function (event, next, current) {
                // redirect to login page if not logged in and trying to access a restricted page
                var restrictedPage = ($location.path() != '/login' && $location.path() != '/register'); 
            	$rootScope.restrictedPage = restrictedPage; 
                var loggedIn = $rootScope.globals.currentUser;
                if (restrictedPage && !loggedIn) {
                    $location.path('/login');
                }
            });
    	});
    }
})();
