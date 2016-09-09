var fs = require("fs");
var path = require("path");
var log = require("../misc/log");
var installDir = exports.installDir = path.normalize(__dirname+"/../../"); 
var fnDefJson = path.normalize(installDir+"/installation.json");

if (!fs.existsSync(fnDefJson)) 
{
	log.warn("File "+fnDefJson+" does not exists! Starting without default configuration data!");
} else {
	try 
	{
		var json = JSON.parse(fs.readFileSync(fnDefJson));
		exports.json = json;
	} catch (e) {
		log.error("Error reading "+fnDefJson+" : "+(e.stack||e));
		process.exit(-1);
	}
}
