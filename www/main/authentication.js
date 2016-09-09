﻿(function () {
    'use strict';

    angular
    	.module('app')
        .factory('AuthenticationService', AuthenticationService);

    AuthenticationService.$inject = ['$http', '$cookieStore', '$rootScope', '$timeout','FlashService'];
    function AuthenticationService($http, $cookieStore, $rootScope, $timeout,FlashService) {
        var service = {};

        service.Login = Login;
        service.SetCredentials = SetCredentials;
        service.ClearCredentials = ClearCredentials;
        service.AuthenticationService = AuthenticationService;
        return service;

        function Login(username, password, callback) {

        	// BusMap authentification
            function check(res) {
            	$safeScope($rootScope,function() {
            		var response;
            		delete service.user;
            		if (res && res.id ) {
                        response = { success: true , data : res };
                        service.user=res;
                		$rootScope.globals.currentUser=res;
            		} else
            			response = { success: false, message: 'Username or password is incorrect' };
            		callback(response);
            	});
            }
        	LR.login(username,password,check);
        }

        function SetCredentials(data) {
            $rootScope.globals = {
                currentUser: data
            };
            $cookieStore.put('globals', $rootScope.globals);
        }

        function ClearCredentials() {
            $rootScope.globals = {};
            $cookieStore.remove('globals');
        }
    }

})();