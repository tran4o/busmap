var gpxParse = require("gpx-parse");
function getGpxPointsFromFile(file,onDone) 
{
	gpxParse.parseGpxFromFile(file, function(error, data) {
		if (error) {
			log.error("Unable to read GPX file "+error);
			onDone(-1);
			return;
		}
		var points=[];
		if (data.tracks) 
		{
			for (var track of data.tracks) 
			{
				for (var seg of track.segments) 
				{
					for (var p of seg) 
					{
						points.push([p.lon,p.lat]);
					}
				}
			}
		}
		onDone(points);
	});
}
exports.getGpxPointsFromFile = getGpxPointsFromFile;