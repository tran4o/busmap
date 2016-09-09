(function () {
    'use strict';

    angular
    	.module('app')
        .controller('LoginController', LoginController);

    LoginController.$inject = ['$scope','$location', 'AuthenticationService', 'FlashService'];
    function LoginController($scope,$location, AuthenticationService, FlashService) {
        var vm = this;

        vm.login = login;

        (function initController() {
            // reset login status
            AuthenticationService.ClearCredentials();
        	// TODO : can not solve it directly with angular dep (COPIED IN app.js ALSO)
        	document.getElementById("header-tabs").className="header-tabs hidden";
        })();
        function login() {
            vm.dataLoading = true;
            AuthenticationService.Login(vm.username, vm.password, function (response) {
                if (response.success) {
                	// !!IMPORTANT!!!
                	// TODO : can not solve it directly with angular dep (COPIED IN app.js ALSO)
                	// TODO : FIXME 
                	// TODO : REMOVE RELOAD PAGE ETC !!!!
                	// !!IMPORTANT!!!
                	document.getElementById("header-tabs").className="header-tabs";
                	AuthenticationService.SetCredentials(response.data);
                	location.href="/www/#/?t="+(new Date()).getTime();
                	location.reload();
                } else {
                    FlashService.Error(response.message);
                    vm.dataLoading = false;
                }
            });
        };
    }

})();
