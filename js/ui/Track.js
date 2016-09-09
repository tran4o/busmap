require('joose');
require('./Participant');

var CONFIG = require('./Config');
var WGS84SPHERE = require('./Utils').WGS84SPHERE;

Class("Track", 
{	
    //--------------------------------------
	// ALL COORDINATES ARE IN WORLD MERCATOR
    //--------------------------------------
    has: 
	{
        route : {
            is:   "rw"
        },
		// in EPSG 3857
		feature : {
			is : "rw",
			init : null		
		},
		swimCount : {
			is : "rw",
			init : 1
		},
		bikeCount : {
			is : "rw",
			init : 1
		},
		runCount : {
			is : "rw",
			init : 1
		},
    },
    //--------------------------------------
	methods: 
	{		
		init : function() 
		{
			if (!this.route)
				return;
			// 1) calculate total route length in KM 
			this.updateFeature();
			if (this.route && this.route.length) 
			{
				this.coords=[];
				this.distances=[];
				var res=0.0;
				for (var i=0;i<this.route.length;i++) 
				{
					if (this.route[i] && this.route[i].length >= 2) 
					{
						var coef=1;
						if (i == 0)
							coef=this.swimCount;
						else if (i == 1)
							coef=this.bikeCount;
						else if (i == 2)
							coef=this.runCount;				
						for (var count=0;count<coef;count++) {
							this.coords.push(this.route[i][0]);
							this.distances.push(res);
							for (var j=1;j<this.route[i].length;j++) 
							{
								var a = this.route[i][j-1];
								var b = this.route[i][j];
								var d = WGS84SPHERE.haversineDistance(a,b);
								res+=d;
								this.coords.push(b);
								this.distances.push(res);
							}
						}
					}
				}
				this.distancesElapsed=[];
				if (res > 0)
				for (var i=0;i<this.distances.length;i++) 
					this.distancesElapsed[i]=this.distances[i]/res;
			}
		},

		setRoute : function(val) {
			this.route=val;
			delete this._lentmp1;
			delete this._lentmp2;
			delete this.bikeStart;
			delete this.runStart;
		},
		
		getBoundingBox : function() {
			var minx=null,miny=null,maxx=null,maxy=null;
			for (var t=0;t<this.route.length;t++) if (this.route[t])
			for (var i=0;i<this.route[t].length;i++)
			{
				var p=this.route[t][i];
				if (minx == null || p[0] < minx) minx=p[0];
				if (maxx == null || p[0] > maxx) maxx=p[0];
				if (miny == null || p[1] < miny) miny=p[1];
				if (maxy == null || p[1] > maxy) maxy=p[1];
			}
			return [minx,miny,maxx,maxy];
		},
		
		getTrackLength : function(part) {
			if (part == undefined && this._lentmp1)
				return this._lentmp1;
			if (!this.route || !this.route.length)
				return 1;
			var res=0.0;
			this.bikeStart=0;
			this.runStart=0;
			for (var t=0;t<3;t++) if (part == undefined || t == part)
			{
				var coef=1;
				if (t == 0)
					coef=this.swimCount;
				else if (t == 1)
					coef=this.bikeCount;
				else if (t == 2)
					coef=this.runCount;

				if (t == 1) {
					this.bikeStart=res;
					this.runStart=res;
 				} else {
 					if (t == 2)
 						this.runStart=res;
 				}
				
				if (this.route[t]) {
					var cc = this.route[t];
					for (var i=0;i<cc.length-1;i++) 
					{
						var a = cc[i];
						var b = cc[i+1];
						var d = WGS84SPHERE.haversineDistance(a,b);
						res+=d*coef;
					}
				}
			}
			if (part == undefined)
				this._lentmp1=res;
			return res;
		},

		getCenter : function() {
			if (!this.route || !this.route.length)
				return UI.Config.defaultCenter;
			var bb = this.getBoundingBox();
			return [(bb[0]+bb[2])/2.0,(bb[1]+bb[3])/2.0];
		},
		
		getTrackPart : function(elapsed) {
			var len = this.getTrackLength();
			var em = (elapsed%1.0)*len;
			if (em >= this.runStart) 
				return 2;
			if (em >= this.bikeStart) 
				return 1;
			return 0;
		},
	
		getExtent : function()  
		{
			if (!this.getFeature())
				this.updateFeature();
			return this.getFeature().getGeometry().getExtent();
		},


		updateFeature : function() 
		{
			//----------------- ---------------------------------------------
			if (typeof window != "undefined" && this.route && this.route.length) 
			{
				this.geomSwim=null;
				this.geomBike=null;
				this.geomRun=null;
        		var minlon,minlat,maxlon,maxlat;
				for (var t=0;t<3;t++) if (this.route[t]) {
					var pp = this.route[t];
					var arr=[];
					for (var i=0;i<pp.length;i++) {
						var p = ol.proj.transform(pp[i],'EPSG:4326', 'EPSG:3857');
	    				if (minlon == undefined || p[0] < minlon) minlon=p[0];
	    				if (minlat == undefined || p[1] < minlat) minlat=p[1];
	    				if (maxlon == undefined || p[0] > maxlon) maxlon=p[0];
	    				if (maxlat == undefined || p[1] > maxlat) maxlat=p[1];
						arr.push(p);
					}
					if (t == 0) {
						this.geomSwim=new ol.geom.LineString(arr);
					} else if (t == 1) {
						this.geomBike=new ol.geom.LineString(arr);
					} else {
						this.geomRun=new ol.geom.LineString(arr);
					}
				}
    			var tarr=[[minlon,minlat],[maxlon,minlat],[maxlon,maxlat],[minlon,maxlat]];
				this.feature = new ol.Feature(new ol.geom.LineString(tarr));
				this.feature.track=this;
				this.feature.setStyle(UI.Styles.track);
			} else {
				delete this.feature;
			}
		},


		onMapClick : function(event) 
		{
			if (this.debugParticipant) 
			{
				this.debugParticipant.onDebugClick(event);
			}
		},
		//-----------------------------------------------------------------
		getPositionAndRotationFromElapsed : function(elapsed) {
					var rr=null;
			var cc = this.coords;	// PROJECTED ROUTE
			var ll = this.distancesElapsed.length-1;
			var si = 0;
			while (si < ll && si+500 < ll && this.distancesElapsed[si+500] < elapsed ) {
				si+=500;
			}
			while (si < ll && si+250 < ll && this.distancesElapsed[si+250] < elapsed ) {
				si+=250;
			}
			while (si < ll && si+125 < ll && this.distancesElapsed[si+125] < elapsed ) {
				si+=125;
			}
			while (si < ll && si+50 < ll && this.distancesElapsed[si+50] < elapsed ) {
				si+=50;
			}
			for (var i=si;i<ll;i++) 
			{
				if (this.distancesElapsed[i] < elapsed && this.distancesElapsed[i+1] >= elapsed) 
				{
					var ac=this.distancesElapsed[i+1]-this.distancesElapsed[i];
					if (ac == 0)
						ac=1;
					elapsed-=this.distancesElapsed[i];
					var a = cc[i];
					var c = cc[i+1];
					var dx = c[0] - a[0];
					var dy = c[1] - a[1];
					rr=[a[0]+(c[0]-a[0])*elapsed/ac,a[1]+(c[1]-a[1])*elapsed/ac,Math.atan2(dy, dx)];
					break;
				}
			}
			return rr;
		}


    }
});