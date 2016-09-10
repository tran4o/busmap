require('joose');
require('./Point');
var RBTree = require('bintrees').RBTree;
var CONFIG = require('./Config');
var Utils = require('./Utils');

var coefy = CONFIG.math.projectionScaleY;
//----------------------------------------
Class("Participant",
{
    has: 
	{
    	altitude : {
    		is : "rw"
    	},
    	opacity : {
    		is : "rw",
    		init : 1
    	},
    	acceleration : {
    		is : "rw"
    	},
    	freq : {
    		is : "rw",
    		init : 40
    	},
    	feature : {
    		is : "rw"
    	},
    	code : {
    		is : "rw",
    		init : "? ?"
    	},
    	speed : {
    		is : "rw"
    	},
    	lastPingTimestamp : {
    		is : "rw",
    		init : null
    	},
    	signalLostDelay : {
    		is : "rw",
    		init : null
    	},
    	lastRealDelay : {
    		is : "rw",
    		init : 0
    	},
    	track : {
    		is : "rw"
    	},
		isTimedOut : {
			is : "rw",
			init : false
		},
		isDiscarded : {
			is : "rw",
			init : false
		},
		isSOS : {
			is : "rw",
			init : false
		},
		icon: {
			is: "rw",
	        init: "img/player1.png"
	    },
	    image :	{
	        is:   "rw",
	        init: "img/profile1.png"  //100x100
	    },
	    color : {
	        is:   "rw",
	        init: "#fff"
	    },
	    ageGroup : {
	    	is : "rw",
	    	init : "-"
	    },
	    age : {
	    	is : "rw",
	    	init : "-"
	    },
	    rotation : {
	    	is : "rw",
	    	init : 0
	    }, 
	    elapsed : {
	    	is : "rw",
	    	init : 0
	    },
		seqId : {
			is : "rw",
			init : 0
		},
		country : {
			is : "rw",
			init : "DE"
		},
		startPos : {
			is : "rw",
			init : 0
		},
		startTime : {
			is : "rw",
			init : 0
		},
		gender : {
			is : "rw",
			init : "M"
		},
		isFavorite : {
			is : "rw",
			init : false
		},
		pos : {
			is : "rw"
		},
		id : {
			is : "rw"
		}
    },
    //--------------------------------------
	methods: 
	{
		init : function(pos, track) 
		{
			this.setTrack(track);
			this.setPos(pos);
			var ctime = (new Date()).getTime();
			this.setIsSOS(false);
			this.setIsDiscarded(false);
			if (this.feature) {
				this.initFeature();
			}
		},

		initFeature : function() {
			this.feature.participant=this;
		},

		getInitials : function() {
			var tt = (this.getCode() || "? ?").split(" ");
			if (tt.length >= 2) {
				return tt[0][0]+tt[1][0];
			}
			if (tt.length == 1) {
				return tt[0][0]+tt[0][1];
			}
			return "?";
		},
		//----------------------------------------------------------
		// main function call > 
		//----------------------------------------------------------
		updateFeature : function() 
		{
			var p = this.getPos();
			if (!p)
				return;
			var mpos = ol.proj.transform(p, 'EPSG:4326', 'EPSG:3857');
			if (this.feature) { 
				this.feature.setGeometry(new ol.geom.Point(mpos));
				this.feature.participant = this;
			}
		},

		getPopupHTML : function(track,extraRows) 
		{
			var tlen = track ? track.getTrackLength() : 0;
			var elapsed = this.getElapsed();
			var tpart = 0;
			var target;
			var partStart;
			var tpartMore="TEST";
			var tparts="";
			if (track && track.route) 
			{
				tpart=track.getTrackPart(elapsed);
				if (tpart == 0) {
					tparts="SWIM";
					target=track.bikeStart;
					partStart=0;
					tpartMore="SWIM";
				} else if (tpart == 1) {
					tparts="BIKE";
					target=track.runStart;
					partStart=track.bikeStart;
					tpartMore="RIDE";
				} else if (tpart == 2) { 
					tparts="RUN";
					target=tlen;
					partStart=track.runStart;
					tpartMore="RUN";
				}
			}

			var elkm = elapsed*tlen/1000;
			var elkms = parseFloat(Math.round(elkm * 100) / 100).toFixed(2);			
			//-----------------------------------------------------
			var estf=null;
			var etxt1=null;
			var etxt2=null;
			var speed = this.getSpeed();
			var ctime = this.getCrrTime ? this.getCrrTime() : (new Date().getTime());
			if (speed && speed > 0 && ctime) 
			{
				var acceleration = this.getAcceleration();
				var rot = track ? track.getPositionAndRotationFromElapsed(elapsed)*180/Math.PI : this.getRotation();
				if (rot < 0)
					rot+=360;
				var spms = Math.ceil(speed*100) / 100;
				etxt1=parseFloat(spms).toFixed(2)+" km/h";
				if (rot != null) 
				{
					if (rot <= 0) 
						etxt1+=" E";
					else if (rot <= 45)
						etxt1+=" SE";
					else if (rot <= 90)
						etxt1+=" S";
					else if (rot <= 135)
						etxt1+=" SW";
					else if (rot <= 180)
						etxt1+=" W";
					else if (rot <= 225)
						etxt1+=" NW";
					else if (rot <= 270)
						etxt1+=" N";
					else 
						etxt1+=" NE";
				}
				estf=Utils.formatTime( new Date( ctime +  (target / 1000 - elkm)*1000 / speed * 1000 ));  
				/*if (acceleration != undefined)
					etxt2=parseFloat(Math.ceil(acceleration * 100) / 100).toFixed(2)+" m/s2";*/
			}
			//-------------------------------------------------------------------------------------------------
			var rank="-";
			if (this.__pos != undefined)
				rank=this.__pos + 1;   // the first pos - the FASTEST is 0
			var isDummy=!(elapsed > 0);
			var html=undefined
			//-----------------------------------------------------------------
			var speedFrame = 0;
			var speedReplacement = "";
			if (extraRows) 
			{
				for (var i in extraRows) if (extraRows[i].code == "ranking") 
				{
					var pp = Math.round(((new Date()).getTime() / 1000 / 2))%extraRows[i].value.length;
					html="<div class='info-header'>"+(etxt1 ? etxt1 : "")+"<div style='position:absolute;right:3px;top:8.6px;'>"+extraRows[i].value[pp]+"</div></div>";
					//html="<div class='info-header'>"+extraRows[i].value+"</div>";
					break;
				}
			}
			if (!html)
				html="<div class='info-header'>Speed "+(etxt1 ? etxt1 : "-")+"</div>";
			//-----------------------------------------------------------------
			html+="<table class='info-table'>";
			var rows = [];
			if (!isDummy) 
			{
				rows.push({code:"Elapsed", value : (isDummy ? "-" : elkms+" km")});
				rows.push({code:"More to "+tpartMore.toLowerCase(), value : (isDummy ? "-" : elkm >= target/1000 ? "FINISHED" : parseFloat(Math.round((target/1000-elkm) * 100) / 100).toFixed(2)+" km" )});
				rows.push({code:"Finish "+ tparts.toLowerCase() ,value : (!estf ? "-" : estf)});					
			} else {
				var lon=undefined;
				var lat=undefined;
				var alt=this.altitude;
				if (this.feature) 
				{
					var pp = this.feature.geometry;
					if (pp) {
						var kk = ol.proj.transform(pp, 'EPSG:3857', 'EPSG:4326');
						lon=kk[0];lat=kk[1];
					}
				}
				rows.push({code:"Lon", value : lon == undefined ? "-" : Math.round(lon*10000)/10000.0});
				rows.push({code:"Lat", value : lat == undefined ? "-" : Math.round(lat*10000)/10000.0});
				rows.push({code:"Altitute", value : alt == undefined ? "-" : Math.round(alt*100)/100.0+" m"});
			}
			//rows.push({code:"Acceler.",value : (etxt2 ? etxt2 : "-")});
			if (extraRows)
				for (var i in extraRows) if (extraRows[i].code != "ranking")
					rows.push(extraRows[i]);
			var pass = Math.round(((new Date()).getTime() / 1000 / 3))%(Math.ceil(rows.length/3));
			for (var i=pass*3;i<pass*3+3 && i < rows.length;i++)
			{
				var v = rows[i];
				html+="<tr><td class='lbl'>"+v.code+"</td><td class='value'>"+v.value+"</td></tr>";
			}
			html+="</table>";
			return html;
		}
		
		
    }
});
