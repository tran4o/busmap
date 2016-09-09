var moment = require("moment");
module.exports = 
{
	isLoop : true,				// BUS MODE = true (gpx track import is loop)
	isShowStartFinish : false,
	maxDailyEventsHistory : 7,  // 1 week
	
	liveExtraOffsetSeconds : 50, // now shifter in the isLive (discrete.js) calculation with this value !!! HIGH VALUE BECAUSE OF INTERPOLATION STORAGE CAN WAIT FOR DEFINED POSITION !!!
	liveConsistencyDisplayOffset : 60, // initial time shift
	minDisplayOffset : 30, // lower offset 
	
	timeOrigin : moment.utc("01.01.2016", "DD.MM.YYYY") + 0,
	pathLevel : 0, // discrete storage level used for path calcualtion (0 = coef 8 = 8 seconds) 
	locationGridSize : 256,	// TODO SET IN OL3 GRID SETTINGS
	locationPageSize : 16,	//TODO 256!
	locationStep : 10,	//seconds	10 ORIGINAL (TRYING TO MATCH PATH LEVEL DISCRETISATION )
	locationPageSubGrid : 2, 	// each tile divided into pieces NxN
	maxPersonsInLocationTile: 250,			// TODO ENABLE AFTER ROTH EVENT AND TEST!!
	maxPersonsInSubGrid : 15,				// TODO ENABLE AFTER ROTH EVENT AND TEST!!
	blockSize : 64,
	graphPixelResolution : 3,
	//  FIRST RESOLUTION -> SECOND
	// last resolution ~ half a day (1 day = 86400 seconds, 16384 = 81920)
	resolutions : 
	[
	 	10,20,40,80,160,320,640,1280,2560,5120,10240,20480,40960,81920,163840	
	],
	signalTimeout : 60, 	// seconds
	prefferedUploadInterval : 10, // seoconds (gpx log user upload)
	// if > this val then = this val (SOME STRANGE 99 hdop values appear?!)
    // if > this val then = this val (SOME STRANGE 99 hdop values appear?!)
    maxHDOP : 4,
    //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    startTrigerDistanceMeters : 1200,    // TODO SET ME
    basicTrackingGPSToleranceMeters : 60,   // VALUE OK ?
    HDOPMultipliedGPSToleranceMeters : 16,   // extra tolerance per HDOP unit
    upperLimitSumTrackingGPSTolerances : 200,	// MAX SUMM ALL
    maxSpeedBasedPredictionDurationInSeconds : 60, // (10 not ok > 20!) 
    trackingStartInMeters : 4050, // start trigger from start in meters
    
    predictionAverageIntervalSeconds : 15,
    maxTrackingGapInMeters : 10000,					//12km!??! NOO!!!
    rankingSpeedAverageSeconds : 60,			
    
    maxSpeedSwimKMH  : 20,                          //TODO 
    maxSpeedBikeKMH  : 80,                          //TODO
    maxSpeedRunKMH  : 35,                           //TODO
    trackingPointPerMeters : 15                      // TODO THIS IS BRUTE FORECE CHECK QUERY
}