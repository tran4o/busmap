(function () {
    'use strict';

    angular
    	.module('app')
        .controller('RegisterController', RegisterController);

    function RegisterController($scope,$location, FlashService, AuthenticationService,$routeParams) 
    {
    	var id = location.href.indexOf("?imei=");
    	var imei = id < 0 ? null : location.href.substring(id+6);
    	if (imei && imei.indexOf("&") >= 0)
    		imei=null;
    	var vm = this;
        vm.register = register;
        vm.user={
        	imei : imei
        };
        function register() 
        {
            vm.dataLoading = true;

            function CreateUser(data,callback) 
            {
            	LR.person.create({firstName : data.firstName, lastName : data.lastName,username : data.username,password : data.password,imei:data.imei},function(res) {
            		var response;
            		if (res && res.id ) {
            			response = { success: true , data : res };
            			$scope.$apply(function() {
            				AuthenticationService.user=res;
            			});
            		} else
            			response = { success: false, message: 'Can not register. Please try with another username again!' };
        			$scope.$apply(function() {
                        callback(response);
        			});
            	});
            }
            
            CreateUser(vm.user,function (response) 
            {
                if (response.success) {
                    FlashService.Success('Registration successful', true);
                    if (imei) {
                        $location.path('/');
                    } else {
                        $location.path('/login');
                    }
                } else {
                    FlashService.Error(response.message);
                    vm.dataLoading = false;
                }
            });
        }
    }

})();
