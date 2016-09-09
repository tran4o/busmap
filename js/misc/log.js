var winston = require("winston");
var fs = require("fs");
var path = require("path");
var pfx = path.resolve(__dirname+"/../../")
if (!fs.existsSync(pfx+"log"))
	fs.mkdirSync(pfx+"log");
if (process.stdout.isTTY) 
{
	winston.remove(winston.transports.Console);
	/*winston.addColors({
	  trace: 'magenta',
	  input: 'grey',
	  verbose: 'cyan',
	  prompt: 'grey',
	  debug: 'blue',
	  info: 'green',
	  data: 'grey',
	  help: 'cyan',
	  warn: 'yellow',
	  error: 'red'
	});*/
	winston.add(winston.transports.Console, {
	  prettyPrint: true,
	  colorize: false,
	  silent: false,
	  timestamp: false
	});
}
module.exports = winston;
//--------------------
winston.logToFile = function(name) 
{
	winston.add(require('winston-daily-rotate-file'), {
		name : 'file',
		datePattern : '.yyyy-MM-dd.log',
		filename : pfx+"log/name",
		json : false,
		exitOnError : false,
		timestamp : false,
		formatter : function(options) {
			// Return string will be passed to logger.
			return (undefined !== options.message ? options.message : '');
		}
	});
}