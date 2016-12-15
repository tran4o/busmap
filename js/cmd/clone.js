var log = require("../misc/log");
var inst = require("../conf/installation");
var fs = require("fs");
var path = require("path");
var moment = require("moment");
var persons = require("../db/persons");
var events = require("../db/events");

events.cloneEvent(5, 
	moment().format('DD.MM.YYYY'),
	(new Date('2016-12-15T01:00:00.000Z')).getTime(),
	(new Date('2016-12-15T23:00:00.000Z')).getTime(), 
	function() { console.log('cerated'); }
);

