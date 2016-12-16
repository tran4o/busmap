var log = require("../misc/log");
var inst = require("../conf/installation");
var fs = require("fs");
var path = require("path");
var moment = require("moment");
var persons = require("../db/persons");
var events = require("../db/events");

events.cloneEvent(5, 
	moment().format('DD.MM.YYYY'),
	(new Date(moment().format("YYYY-MM-DD")+'T04:00:00.000Z')).getTime(),
	(new Date(moment().format("YYYY-MM-DD")+'T21:30:00.000Z')).getTime(), 
	function() { console.log('cerated'); }
);

