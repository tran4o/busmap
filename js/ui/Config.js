var Utils = require("./Utils.js");
var consts = require("../conf/constants");
var CONFIG = 
{
	graph: 
	{
		modes : 
		{
			"speed" : { name : "Speed (km/h)" , pro : "speedInKmh", unit : "km/h"}, 	 
			"speedAvg" : { name : "AVG speed (1h) (km/h)" , pro : "speedInKmhAverage", unit : "km/h"}, 	 
			"elapsed" : { name : "Elapsed (%)" , pro : "elapsed", unit : "km" , multiply : "trackLen"},		 
			"grprank" : { name : "GRP Rank #" , pro : "grprank" },	
			"genrank" : { name : "GEN Rank #" , pro : "genrank" },	
			"ovrrank" : { name : "OVR Rank #" , pro : "ovrrank" },	
			"battPerc" : {name : "Batt. (%)", pro : "battPercent",staticLimits : {min:0,max:100},unit : "%"  },
			"alt" : {name : "Elevation (m)", pro : "alt", unit : "m"},
			"ecall" : {name : "E-Call", pro : "ecallActive", staticLimits : {min:0,max:1,hideMiddle : true}},
			"gsmSignal" : {name : "GSM Signal (%)", pro : "gsmSignal", multiply : 100/30,unit : "%"},			//0..30
			"uptimeSys" : {name : "Sys uptime (min)", pro : "uptimeSystem",unit : "min"  },
			//"sats" : {name : "GNSS Sats (#)", pro : "sats"},
			//"charger" : {name : "Charger", pro : "chargerActive", staticLimits : {min:0,max:1,hideMiddle : true}},
			//"battVolt" : {name : "Batt. (V)", pro : "battVolt", staticLimits : {min:0,max:32},unit : "V" },
			//"lon" : { name : "Lon" , pro : "lon"}, 
			//"lat" : { name : "Lat" , pro : "lat"}, 
			//"distanceNext" : { name : "Next (m))" , pro : "nelapsed",unit : "km", multiply : "trackLen" },	
			//"pulsRate" : {name : "Puls rate", pro : "puls_rate"},
			//"temperature" : {name : "Temperature", pro : "temperature", unit : "grad"},
			//"gpsValid" : {name : "GPS Valid", pro : "gpsValid", staticLimits : {min:0,max:1,hideMiddle : true}},
			//"raceMode" : {name : "Race mode", pro : "isRace", staticLimits : {min:0,max:1,hideMiddle : true}},
			// first derivation functions
			//"acceleration" : {name : "Acceler. (m/s)", pro : "speedInKmh", derivation : "true" , multiply : 1000/3600,unit : "m/s" },
			//"consumption" : {name : "Power usage (%/h)", pro : "battPercent", derivation : "true" , multiply : 3600,unit : "%/h" },
			"avail" : { name : "Duration since last avail" , pro : "avail", unit : "sec" , multiply : consts.locationStep},
			"hdop" : {name : "HDOP", pro : "hdop"},
		}
	},
	path : {
		level : consts.pathLevel,
		durationInSeconds : 60*5	// 5 min 		
	},
	cache : {
		maxChunks : 500,
		maxTiles : 500,
		liveChunkTimeout : 5, 	//SECONDS
		liveTileTimeout : 5	//SEONDS
	},
	location : {
		timeOrigin : consts.timeOrigin,
		pageSize : consts.locationPageSize,
		step : consts.locationStep,
		defaultCenter : [11.617602,48.130851 ],
		locationGridSize : consts.locationGridSize,
		basicTrackingGPSToleranceMeters : consts.basicTrackingGPSToleranceMeters,
		startTrigerDistanceMeters : consts.startTrigerDistanceMeters,
		HDOPMultipliedGPSToleranceMeters : consts.HDOPMultipliedGPSToleranceMeters,
		upperLimitSumTrackingGPSTolerances : consts.upperLimitSumTrackingGPSTolerances,
		maxHDOP : consts.maxHDOP
	},
	times : {
	},
	timeouts : // in seconds
	{
		estimationRefreshIntervalSeconds : 2,
		deviceTimeout : consts.signalTimeout ,
		animationFrame : Utils.mobileAndTabletCheck() ? 0.6 : 0.3,
		gpsLocationDebugShow : 4,		// time to show gps location (debug) info
		minDisplayDelay : consts.minDisplayOffset,
		liveConsistencyDisplayOffset : consts.liveConsistencyDisplayOffset,
		locationAnimationInterval : 100 /* milliseconds */
	},
	distances : // in m
	{
		stayOnRoadTolerance : 500,	// 500m stay on road tolerance
		elapsedDirectionEpsilon : 500 // 500m direction tolerance, too fast movement will discard 
	},
	constraints : {
		backwardsEpsilonInMeter : 400, //220 m movement in the backward direction will not trigger next run counter increment		
		maxSpeed : 20,	//kmh
		maxParticipantStateHistory : 1000, // number of elements
		popupEnsureVisibleWidth : 200,
		popupEnsureVisibleHeight: 120,
		maxParticipantsInToolbar : 50,
		stopSpeedLimitKmh : consts.stopSpeedLimitKmh
	},
	simulation : {
		pingInterval : 10,  // interval in seconds to ping with gps data
		gpsInaccuracy : 4, //8,  // error simulation in METER (look math.gpsInaccuracy, min 1/2)
		speedCoef : 100
	},
	settings : {
		noMiddleWare : 0, 	// SKIP middle ware node js app
		noInterpolation : 0	// 1 -> no interpolation only points
	},
	math : {
		projectionScaleY : 0.75,				// TODO EXPLAIN (rectange creation in world mercator coef y 
		gpsInaccuracy : 30,						 //TODO 13 min ? 
		speedAndAccelerationAverageDegree : 2,	// calculation based on N states (average) (MIN 2)
		displayDelay : 35,						// display delay in SECONDS
		interpolateGPSAverage : 0 // number of recent values to calculate average gps for position (smoothing the curve.min 0 = NO,1 = 2 values (current and last))
	},
	constants : 
	{
		ageGroups :  
		[
		 {
			 from : null,
			 to : 8, 
			 code : "FirstAgeGroup"
		 }
		 ,{
			 from : 8,
			 to : 40, 
			 code : "MiddleAgeGroup"
		 }
		 ,{
			 from : 40,
			 to : null, 
			 code : "LastAgeGroup"
		 }
		]
	},

	event : {
		beginTimestamp : (new Date()).getTime(),
		duration : 60, //MINUTES
		id : 3
	},

	server : {
		prefix : "/triathlon/"
	},
	
	gpx : {
		isLoop : consts.isLoop,
		isReverse : consts.isReverse
	},
	appearance : {
		defaultIsFavorite : true, // BUS MODE = true, LR = false
		isShowStartFinish : consts.isShowStartFinish,
		debug : 0,
		trackColorSwim : 'rgba(86,118,255,0.75)',
		trackColorBike : 'rgba(226,0,116,0.75)',
		trackColorRun :  'rgba(7,159,54,0.75)',

		// Note the sequence is always Swim-Bike-Run - so 2 change-points
		// TODO Rumen - add scale here, not in Styles.js
		imageStart : "img/start.png",
		imageFinish : "img/finish.png",
		imageCam : "img/camera.svg",
		imageCheckpointSwimBike : "img/wz1.svg",
		imageCheckpointBikeRun : "img/wz2.svg",
		isShowCheckpointImage : false, /* show an image on the checkpoints (e.g on the changing WZ points */
		isShowCheckpoint : false,  /* show an square on the same color on the checkpoints, only if isShowCheckpointImage is not true*/

        // the distance between the direction icons - in pixels,
        // if set non-positive value (0 or less) then don't show them at all
		//directionIconBetween : 200
		directionIconBetween : -1
	},

    hotspot : {
        cam : {image :"img/camera.svg"},  // use the same image for static cameras as for the moving ones
		camSwimBike : {image : "img/wz1.svg"},
		camBikeRun : {image : "img/wz2.svg"},
        water : {image : "img/water.svg"},
        uturn : {image : "img/uturn.svg"},

		km10 : {image : "img/10km.svg", scale : 1.5},
		km20 : {image : "img/20km.svg", scale : 1.5},
		km30 : {image : "img/30km.svg", scale : 1.5},
		km40 : {image : "img/40km.svg", scale : 1.5},
		km60 : {image : "img/60km.svg", scale : 1.5},
		km80 : {image : "img/80km.svg", scale : 1.5},
		km100 : {image : "img/100km.svg", scale : 1.5},
		km120 : {image : "img/120km.svg", scale : 1.5},
		km140 : {image : "img/140km.svg", scale : 1.5},
		km160 : {image : "img/160km.svg", scale : 1.5},
		km180 : {image : "img/180km.svg", scale : 1.5}
    }
};

for (var i in CONFIG)
	exports[i]=CONFIG[i];

for (var i in CONFIG.graph.modes)
	CONFIG.graph.modes[i].code=i;