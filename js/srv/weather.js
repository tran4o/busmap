var request = require('request');

var lastTime = undefined;
var lastWeather = undefined;

exports.getCachedWeather = function(data,onDone) {
	var ct = (new Date()).getTime();
	if (!lastTime || ct - lastTime > 30*60*1000 /* 30 mins */) 
	{
		// RAIN AND WIND
		//var url = "https://api.darksky.net/forecast/4afa1dc8b571e0629d299414bc7d6a33/54.7121661,-8.7427857";
		// BAD WEATHER SOMEWHERE
		//var url = "https://api.darksky.net/forecast/4afa1dc8b571e0629d299414bc7d6a33/50.5173144,-120.4830287";
		var url = "https://api.darksky.net/forecast/4afa1dc8b571e0629d299414bc7d6a33/41.6541368,24.6935049";
		request({
		    url: url,
		    json: true
		}, function (error, response, body) {
		    if (!error && response.statusCode === 200 && body.currently && body.currently.summary) {
		    	var data = {
		    		wind : body.currently.windSpeed || 0,
		    		clouds : body.currently.cloudCover   
		    	};
		    	console.log(body.currently.summary);
		    	if (body.currently.summary.toLowerCase().indexOf("heavy rain") >= 0) {
		    		data.rain = {
		    			intensity : 1,
		    			wind : data.wind
		    		};
		    	} else if (body.currently.summary.toLowerCase().indexOf("light rain") >= 0) {
		    		data.rain = {
			    		intensity : 0.25,
			    		wind : data.wind
			    	};
		    	} else if (body.currently.summary.toLowerCase().indexOf("rain") >= 0) {
		    		data.rain = {
		    			intensity : 0.5,
				    	wind : data.wind
				    };
			    } else if (body.currently.summary.toLowerCase().indexOf("heavy snow") >= 0) {
		    		data.snow= {
		    			intensity : 1,
		    			wind : data.wind
			    	};
		    	} else if (body.currently.summary.toLowerCase().indexOf("light snow") >= 0) {
		    		data.snow = {
			    		intensity : 0.2,
			    		wind : data.wind
			    	};
		    	} else if (body.currently.summary.toLowerCase().indexOf("snow") >= 0) {
		    		data.snow = {
		    			intensity : 0.5,
				    	wind : data.wind
				    };
			    } 
		    	lastTime = (new Date()).getTime();
		    	lastWeather = data;
		    	onDone(data);
		    } else if (error) {
		    	console.error(error);
		    }
		})		
	} else {
		onDone(lastWeather);
	}
};

