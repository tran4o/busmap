var log = require("../misc/log");
var persons = require("../db/persons");

var admin = exports.admin = 
{
	userGroup : 1			/* ADMIN */
};

exports.loginUser = function(username,password,onDone) {
	persons.getPersonByUsername(admin,username,function(res) {
		if (res < 0 || !res.id || res.password != password) {
			log.error("Unable to authentificate user "+username+" with password "+password+"!");
			onDone(-1);
		} else 
			onDone(res);
	});
}; 