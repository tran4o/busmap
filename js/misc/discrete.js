var consts = require("../conf/constants");
//---------------------------------------------------
exports.blockSize = consts.blockSize;
exports.timeToChunk=function(time,level) 
{
	var diff = time-consts.timeOrigin;
	var pgSize = ( 1000*consts.blockSize * consts.resolutions[level] );
	return Math.floor(diff / pgSize);
};
//---------------------------------------------------
exports.chunkToInterval=function(chunk,level) 
{
	var cSize = 1000*consts.blockSize*consts.resolutions[level];
	var b = chunk * cSize + consts.timeOrigin;
	var bt = (chunk-1) * cSize + consts.timeOrigin;
	var isValid=true;
	var isLive=false;
	var now = (new Date()).getTime();
	var eofs = consts.liveExtraOffsetSeconds*1000;
	if (b < consts.timeOrigin || bt > now+eofs)
		isValid=false;
	else {
		if (b+cSize+eofs >= now) {
			isLive=true;
		}
	}
	return {isValid : isValid, isLive : isLive, min : b, max : b + cSize};
};

exports.resolutionToLevel = function(minTime,maxTime,optimalMaxRecordsPerFrame) {
	var dseconds = (maxTime-minTime)/1000;
	// dseconds -> at level 0
	var level = 0;
	while (dseconds/consts.resolutions[level] >= optimalMaxRecordsPerFrame/consts.graphPixelResolution && level < consts.resolutions.length-1)
		level++;
//	console.log("Interval of dseconds : "+dseconds+" >> level="+level+" | COEF = "+consts.resolutions[level]+" | TOTAL : "+dseconds/consts.resolutions[level]);
	return level;
};
//-------------------------------------------------------------
exports.locationPageSize = consts.locationPageSize;
exports.locationStep = consts.locationStep;
exports.timeToPage=function(time) 
{
	var idx = Math.floor(time-consts.timeOrigin)/(1000*consts.locationStep);
	return Math.floor(idx / consts.locationPageSize);
};
exports.timeToOffset=function(time) 
{
	var idx = Math.floor(time-consts.timeOrigin)/(1000*consts.locationStep);
	return Math.floor(idx % consts.locationPageSize);
};

exports.timeToOffsetReal=function(time) 
{
	var idx = Math.floor(time-consts.timeOrigin)/(1000*consts.locationStep);
	return idx % consts.locationPageSize;
};


exports.pageToInterval = function(page) {
	var cSize = consts.locationPageSize*1000*consts.locationStep;
	var b = consts.timeOrigin + page * cSize;
	var bt = consts.timeOrigin + (page-1) * cSize; // one page more
	var isValid=true;
	var isLive=false;
	var now = (new Date()).getTime();
	var eofs = consts.liveExtraOffsetSeconds*1000;
	if (b < consts.timeOrigin || bt > now)
		isValid=false;
	else
		if (b+cSize+eofs >= now+eofs)
			isLive=true;
	return {isValid : isValid, isLive : isLive, min : b, max : b + cSize };	
};
