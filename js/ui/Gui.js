var Utils=require('./Utils');
var STYLES=require('./Styles');
var CONFIG = require("./Config");
require('joose');
require('./Track');
Class("Gui", 
{
    //--------------------------------------
	// ALL COORDINATES ARE IN WORLD MERCATOR
    //--------------------------------------
    has: 
	{
    	isEventMode : {
    		is : "rw",
    		init : false
    	},
    	target : {
    		is : "rw",
    		init : "map"
    	},
    	isDebug : {
    		is : "rw",
    		init : !Utils.mobileAndTabletCheck() && CONFIG.appearance.debug
    	},
		isWidget : {
			init : false
		},
		isDebugShowPosition : {
			// if set to true it will add an absolute element showing the coordinates above the mouse location
			init : false
		},
		receiverOnMapClick : {
			is : "rw",
			init : []
		},
        width : {
            is:   "rw",
            init: 750
        },
        height: {
            is:   "rw",
            init: 500
        },
		track : {
			is:   "rw"
		},
		elementId : {
			is : "rw",
			init : "map"
		},
		initialPos : {	
			is : "rw",
			init : null
		},
		initialZoom : {	
			is : "rw",
			init : 10
		},
		isSkipExtent : {
			is : "rw",
			init : false
		},
		bingMapKey : {
			is : "rw",
			init : 'Aijt3AsWOME3hPEE_HqRlUKdcBKqe8dGRZH_v-L3H_FF64svXMbkr1T6u_WASoet'
		},
		//-------------------
		map : {
			is : "rw",
			init : null
		},
		trackLayer : {
			is : "rw",
			init : null
		},
        hotspotsLayer : {
			is : "rw",
			init : null
		},
        camsLayer : {
			is : "rw",
			init : null
		},
		participantsLayer : {
			is : "rw",
			init : null
		},
		proxiesLayer : {
			is : "rw",
			init : null
		},
		debugLayerGPS : {
			is : "rw",
			init : null
		},	
		testLayer : {
			is : "rw",
			init : null
		},	
		testLayer1 : {
			is : "rw",
			init : null
		},	
		testLayer2 : {
			is : "rw",
			init : null
		},	
		testTilesLayer : {
			is : "rw",
			init : null
		},	
		selectedParticipant1 : {
			is : "rw",
			init : null
		},
		selectedParticipant2 : {
			is : "rw",
			init : null
		},
		popup1 : {
			is : "rw",
			init : null
		},
		popup2 : {
			is : "rw",
			init : null
		},
		isShowSwim : {
			is : "rw",
			init : true
		},
		isShowBike : {
			is : "rw",
			init : true
		},
		isShowRun : {
			is : "rw",
			init : true
		},
		selectNum : {
			is : "rw",
			init : 1
		},
		displayMode : {			
			is : "rw",
			init : "nearest"			//nearest,linear,tracking
		}
    },
    //--------------------------------------
	methods: 
	{
        init : function ()  
		{
			// if in widget mode then disable debug
			if (this.isWidget) {
				this.isDebug = false;
			}

			var defPos = CONFIG.location.defaultCenter;
			if (this.initialPos) {
				defPos = this.initialPos;
			}
			//---------------------------------------------
			var extent = this.isSkipExtent ? null : this.track.getRoute() && this.track.getRoute().length > 1 ? this.track.getExtent() : null;
			this.trackLayer = new ol.layer.Vector({
			  source: new ol.source.Vector()
			});
			this.hotspotsLayer = new ol.layer.Vector({
			  source: new ol.source.Vector(),
			  style : STYLES["hotspot"]
			});
			this.proxiesLayer = new ol.layer.Vector({
				source: new ol.source.Vector()
			});
			this.camsLayer = new ol.layer.Vector({
				source: new ol.source.Vector(),
				style : STYLES["cam"]
			});
			this.elapsedLayer = new ol.layer.Vector({
				  source: new ol.source.Vector(),
				  style : STYLES["elapsed"]
			});
			if (this.isDebug) 
			{
				this.testLayer = new ol.layer.Vector({
					  source: new ol.source.Vector(),
					  style : STYLES["test"]
				});
				this.testLayer1 = new ol.layer.Vector({
					  source: new ol.source.Vector(),
					  style : STYLES["test1"]
				});
				this.testLayer2 = new ol.layer.Vector({
					  source: new ol.source.Vector(),
				  	style : STYLES["test2"]
				});
			}
			this.testTilesLayer = new ol.layer.Vector({
				  source: new ol.source.Vector(),
			  	style : STYLES["tile"]
			});
			//--------------------------------------------------------------
			var ints = [];
			this.popup1 = new ol.Overlay.Popup({ani:false,panMapIfOutOfView : false});
			this.popup2 = new ol.Overlay.Popup({ani:false,panMapIfOutOfView : false});
			this.popup2.setOffset([0,148]);
			var ts;
			this.tileLayer = new ol.layer.Tile({
	        	source: ( ts = new ol.source.OSM()),
	        	visible: false
	        });
			
			
			/*var proj = new ol.proj.Projection({
		        code: 'EPSG:3857',
		        units: 'm',
		        extent: [2744859.2781254444, 5106894.651222586, 2753936.1752343094, 5119267.895176248]
		    });*/
			
			this.staticImageLayer = new ol.layer.Image({
			    source: new ol.source.ImageStatic({
			      url: 'img/background.svg',
			      imageSize: [1295, 950],
			      imageExtent: [2744859.2781254444, 5106894.651222586, 2753936.1752343094, 5119267.895176248]
			      //,projection : proj
			    })
			  });
			
			
			var canvas;
            var ctx;
            var lsize;
			function renderProxiesToCanvas() 			
			{
				var size = map.getSize();
	        	//var text=map.getView().calculateExtent(map.getSize());
				if (!canvas || !lsize || lsize[0] != size[0] || lsize[1] != size[1]) 
				{
					canvas = document.createElement('canvas');
		            canvas.setAttribute('width', size[0]);
		            canvas.setAttribute('height', size[1]);
					ctx = canvas.getContext('2d');
					lsize=size;
				} 
				var canvasWidth = size[0];
				var canvasHeight = size[1];
				ctx.clearRect(0, 0, canvasWidth, canvasHeight);
				var ft = proxiesLayer.getSource().getFeatures();
	        	var img=document.getElementById("proxy-image");
	        	for (var i=0;i<ft.length;i++) 
	        	{
	        		var f = ft[i];
	        		var g = f.getGeometry();
	        		if (g && f.r && f.opacity) 
	        		{
	        			var gc = g.getCoordinates();
		        		var p1 = map.getPixelFromCoordinate(gc);
		        		var p2 = map.getPixelFromCoordinate([gc[0]+f.r,gc[1]]);
		        		var r = 1.05*Math.sqrt((p1[0]-p2[0])*(p1[0]-p2[0]),(p1[1]-p2[1])*(p1[1]-p2[1]))*f.opacity;
		        		ctx.drawImage(img,p1[0]-r,p1[1]-r,r*2,r*2);
	        		}
	        	}
	        	for (var i=0;i<ft.length;i++) 
	        	{
	        		var f = ft[i];
	        		var g = f.getGeometry();
	        		if (g && f.r && f.opacity) 
	        		{
	        			var gc = g.getCoordinates();
		        		var p1 = map.getPixelFromCoordinate(gc);
		        		var p2 = map.getPixelFromCoordinate([gc[0]+f.r,gc[1]]);
		        		var r = Math.sqrt((p1[0]-p2[0])*(p1[0]-p2[0]),(p1[1]-p2[1])*(p1[1]-p2[1]))*f.opacity;
		        		ctx.translate(-p1[0]-r,-p1[1]-r);
		        		//ctx.rotate(rot);
		        		ctx.scale(r*2,r*2);
		        		ctx.translate(-0.5,-0.5);
		        		ctx.drawImage(img,0,0,1,1);
		        		ctx.setTransform(1, 0, 0, 1, 0, 0);	//RESET MATRIX
		        	}
	        	}
	        	return canvas;
			}
			var that=this;
			var usedZ={};
			this.tileLayer.on('postcompose', function(event) {
				var ctx=event.context;
				var ft = proxiesLayer.getSource().getFeatures();
        		var coef = ctx.canvas.width/map.getSize()[0];
        		ctx.scale(coef,coef);
        		usedZ={};
				if (ft.length) 
				{
					var img = renderProxiesToCanvas();
					ctx.globalAlpha = 0.25;
					ctx.drawImage(img,0,0,map.getSize()[0],map.getSize()[1]);
					ctx.globalAlpha = 1;
					var ft = proxiesLayer.getSource().getFeatures();
		        	for (var i=0;i<ft.length;i++) 
		        	{
		        		var f = ft[i];
		        		var g = f.getGeometry();
		        		if (g && f.r && f.opacity > 0.01) 
		        		{
		        			var gc = g.getCoordinates();
			        		var p1 = map.getPixelFromCoordinate(gc);
			        		//ctx.font = "11px Arial";
			        		ctx.font = "15px Arial";
			        		ctx.fillStyle = "rgba(255,255,255,"+f.opacity+")";
			        		ctx.textAlign = "center";
			        		ctx.fillText(""+f.cnt,p1[0],(p1[1]+4));
			        		//ctx.fillText(f.key,p1[0],(p1[1]+4));
			        		ctx.setTransform(1, 0, 0, 1, 0, 0);	//RESET MATRIX
			        		ctx.scale(coef,coef);
			        		usedZ[f.z]=1;
		        		}
		        	}
				}
        		ctx.setTransform(1, 0, 0, 1, 0, 0);	//RESET MATRIX
			});
			var sortedParticipants=[];
			this.trackLayer.on("postcompose",function(event) {
				/* TODO WRITE IN CONFIG 2 seconds animation crrbus info */
				var animFrame = Math.floor(((new Date()).getTime()/2000))%2;

				var ctx=event.context;
        		var coef = ctx.canvas.width/map.getSize()[0];
				ctx.scale(coef,coef);
				/* NEW REWRITE */
				if (typeof crrBus == "undefined" && that.pathByPerson && that.personColor) 
	        	{
		        	var ctime = that.getCrrTime();
		    		var ltime = ctime - UI.Config.path.durationInSeconds*1000;
		    		ctime = (ctime - UI.Config.location.timeOrigin)/(1000*UI.Config.location.step);
		    		ltime = (ltime - UI.Config.location.timeOrigin)/(1000*UI.Config.location.step);		    		
		    		for (var p in that.pathByPerson) if (that.personColor[p]) 
		    		{
		    			if (that.isForceParticipantHidden && that.isForceParticipantHidden(p)) 
		    				continue;
		    			var pd = that.pathByPerson[p];
		    			var k1;
			    		for (var i in pd) 
			        	{
			    			var k1=pd[i];
			    			var k2=pd[i-0+1];
			    			if (!k2) 
			    				continue;
			    			var t1 = k1[2];
			    			var t2 = k2[2];
			    			if (t1 < ltime && t2 < ltime)
			    				continue;
			    			if (t1 > ctime && t2 > ctime)
			    				continue;
			    			var p1 = ol.proj.transform([k1[6],k1[7]],'EPSG:4326','EPSG:3857');
			    			var p2 = ol.proj.transform([k2[6],k2[7]],'EPSG:4326','EPSG:3857');
			    			if (t2 > ctime) {			    				
				    			var lon = p1[0]+(p2[0]-p1[0])*(ctime-t1)/(t2-t1);
								var lat = p1[1]+(p2[1]-p1[1])*(ctime-t1)/(t2-t1);
								p2=[lon,lat];
							}
			    			var opacity = (t2-ltime)/(ctime-ltime);
			    			var w = 4*opacity+0.1;
			    			var f1 = map.getPixelFromCoordinate(p1);
			    			var f2 = map.getPixelFromCoordinate(p2);
			    			ctx.beginPath();
			    			ctx.moveTo(f1[0],f1[1]);
			    			ctx.lineTo(f2[0],f2[1]);
							ctx.globalAlpha = 0.85*opacity;
			    			ctx.strokeStyle=that.personColor[p];
			    			ctx.lineWidth=w;
			    			ctx.stroke();
			        	}
		    		}
					ctx.globalAlpha = 1;
	        	}
				if (!that.participantsCache) {
	        		ctx.setTransform(1, 0, 0, 1, 0, 0);	//RESET MATRIX
					return;
				}
        		ctx.setTransform(1, 0, 0, 1, 0, 0);	//RESET MATRIX
				ctx.scale(coef,coef);
				var arr=[];
			    for (var i in that.participantsCache) 
			    {
	    			if (that.isForceParticipantHidden && that.isForceParticipantHidden(i))
	    				continue;
					arr.push(that.participantsCache[i]);
				}
			    // UFFFF
			    var cbus = typeof crrBus != "undefined" ? crrBus : undefined;
				arr.sort(function(a,b) {
					//console.log(cbus+" | A : ",a);
					//console.log(cbus+" | B : ",b);
					var a1=(a.id == cbus ? 1:0);
					var a2=(a.id == cbus ? 1:0);
					if (a1 < a2)
						return 
					if (a1 > a2)
						return;
					a1=(a.isWatched?0:1);
					a2=(b.isWatched?0:1);
					if (a1 < a2)
						return 
					if (a1 > a2)
						return;
					if (a.elapsed < b.elapsed)
						return -1;
					if (a.elapsed > b.elapsed)
						return 1;
					return a.id - b.id;
				});
				sortedParticipants=arr;
				
				var ds = ((new Date()).getTime()*Math.PI*2/2000);
				var opacity = (Math.pow((Math.sin(ds)+1)/2,1.05))*0.8+0.2;
				
				var urad=[];
				var resolution = event.frameState.viewState.resolution;
				//var z = that.tileGrid.getZForResolution(resolution);
				for (var i=0;i<arr.length;i++) {
					var part = arr[i];
					var opc = part.opacity;
					if (part.avail != undefined)
						opc*=part.avail;
					var r = 1;
					if (!part.isWatched)
						r*=0.85;
					var col = part.color;
					if (part.id == cbus) {
						r*=2;
						col="rgba(255, 64, 64,0.75)";
					}
					var tt = undefined;
					if (opc <= 0.01)
						continue;
        			var gc = part.geometry;
					if (!gc)
						continue;
					// v2.0 > fast lookup based on proxy key
					var mo=0;
					c=0;
					for (var k in usedZ) {
						var keys = that.getTileKeyFromPosition(gc[0],gc[1],k);
		        		var v1 = that.proxiesCache[keys[0]];
		        		var v2 = that.proxiesCache[keys[1]];
		        		if (v1) {
		        			if (v1.opacity > mo) {
		        				mo=v1.opacity;
		        			}
		        		} 
		        		if (v2) {
		        			if (v2.opacity > mo) {
		        				mo=v2.opacity;
		        			}
		        		}
						c++;
					}
	        		opc*=(1-mo);
	        		if (that.isEventMode && !(part.elapsed > 0))
	        			opc*=0.78
	        		if (opc <= 0.01)
						continue;
	        		ctx.globalAlpha=opc;
					var p1 = map.getPixelFromCoordinate(gc);
	        		ctx.translate(p1[0],p1[1]);
	        		ctx.scale(r,r);
	        		ctx.beginPath();
	        		ctx.arc(0, 0, 17, 0, 2 * Math.PI, false);
	        	    ctx.fillStyle = col;
	        	    ctx.fill();
	        	    ctx.lineWidth = 3;
	        		ctx.strokeStyle = "rgba(255,255,255,0.75)";
	        	    ctx.stroke();

	        		ctx.textAlign = "center";
	        		ctx.fillStyle = "#ffffff";
	        		ctx.strokeStyle = "#ffffff";
	        		
	        		console.log("CBUS : "+cbus+" == "+part.id);
	        		if (part.id == cbus && part.wbest) 
	        		{
	        		    ctx.font = "normal 10.5px Lato-Regular";
	        			if (animFrame) {
			        		ctx.fillText(part.wbest[0],0,5);
	        			} else {
			        		ctx.fillText(part.wbest[1],0,5);
	        			}
	        		} else {
		        	    ctx.font = "normal 13.5px Lato-Regular";
		        		ctx.fillText(part.code,0,5);
	        		}
	        		/*if (part.elapsed) {
		        		ctx.fillStyle = "black";
	        			ctx.fillText(Math.round(part.elapsed*1000)/1000,0,-15+2);
	        		}*/
	        		 
	        		/* MIN SPEED 3 km/h TODO ADD CONFIG */
					if (part.rotation != undefined && part.speedExact >= CONFIG.constraints.stopSpeedLimitKmh /*km/h*/ && part.isWatched && part.avail > 0.5 ) 
					{
						// opc,rotation = xr 
						if (typeof hackRotation == "undefined") {
							ctx.rotate(-part.rotation+Math.PI/2);
						} else {
			        		ctx.rotate(hackRotation(part.rotation));
						}
		        		ctx.scale(32,32);
		        		ctx.drawImage(Utils.renderArrow(32,32,col),0.55,-0.5,1,1);
		        		ctx.scale(1/32,1/32);
					}

					// TODO ADD SOME CONFIG OPTION
					if (part.avail <= 0.6) 
					{	 
						/*var sop = 5*(part.avail-0.5)/0.3;
						if (sop > 1)
							sop=1;*/
						sop=1;
						if (sop > 0) {
							var to = (ds/3%1);
							var tr = 30*to+10;
			        		ctx.beginPath();
			        		ctx.arc(0, 0, tr, 0, 2 * Math.PI, false);
			        	    ctx.strokeStyle = col;
			        	    ctx.lineWidth = 0.5+(5.5*to);
			        	    ctx.globalAlpha=sop*(1-to);
			        	    ctx.stroke();
			        		ctx.globalAlpha=opc;
						}
					}
	        	    
					
	        		ctx.setTransform(1, 0, 0, 1, 0, 0);	//RESET MATRIX
					ctx.scale(coef,coef);
					
					if (!cbus && part.isWatched && part.glon && part.glat) 
					{
						// TRACKING INFO ---					
		        		// PRECACHE
						var axk = part.elapsed > 0 ? 1 : 0;
		        		if (urad[axk] == undefined) {
							var crad;
		        			if (part.elapsed > 0) 
		        			{
		        				crad = CONFIG.location.basicTrackingGPSToleranceMeters;
		        				var hdop = part.hdop;
		        				if (hdop > CONFIG.location.maxHDOP)
		        					hdop=CONFIG.location.maxHDOP;
				        		if (part.hdop != undefined)
				        			crad+=UI.Config.location.HDOPMultipliedGPSToleranceMeters*part.hdop;
				        	
				        		if (crad > UI.Config.location.upperLimitSumTrackingGPSTolerances)
				        			crad = UI.Config.location.upperLimitSumTrackingGPSTolerances;
		        			} else {
		        				crad=CONFIG.location.startTrigerDistanceMeters;
		        			}
			        		var drad = crad / ol.proj.METERS_PER_UNIT.degrees / resolution;
			        		var a1 = ol.proj.transformExtent([gc[0],gc[1],gc[0]+1,gc[1]],'EPSG:3857','EPSG:4326');
			        		urad[axk] = drad/Math.sqrt((a1[2]-a1[0])*(a1[2]-a1[0])+(a1[3]-a1[1])*(a1[3]-a1[1])); //????
 		        		}
		        		ctx.globalAlpha=opc;	
		        	    ctx.strokeStyle=col;
		        	    ctx.fillStyle=col;
		        	    ctx.lineWidth = 2*opacity+0.1;

		        		gc = ol.proj.transform([part.glon,part.glat],'EPSG:4326','EPSG:3857');
						p1 = map.getPixelFromCoordinate(gc);

						if (!part.elapsed) {
			        		ctx.beginPath();
			        		ctx.arc(p1[0], p1[1], urad[axk], 0, (Math.PI*2), false);
			        	    ctx.stroke();
						} else {
			        		ctx.beginPath();
			        		ctx.arc(p1[0], p1[1], urad[axk], ds % (Math.PI*2), ds % (Math.PI*2)+2 * Math.PI/4, false);
			        	    ctx.stroke();
			        		var nds = ds+Math.PI;
			        		ctx.beginPath();
			        		ctx.arc(p1[0], p1[1], urad[axk], nds % (Math.PI*2), nds % (Math.PI*2)+2 * Math.PI/4, false);
			        	    ctx.stroke();
			        	    ctx.globalAlpha=opc*0.6;
			        		ctx.beginPath();
			        	    ctx.arc(p1[0], p1[1], 5, 0, Math.PI*2, false);
			        	    ctx.fill();
			        	    ctx.globalAlpha=opc;
			        	    ctx.lineWidth = 1.5;
			        	    ctx.strokeStyle="#ffffff";
			        	    ctx.stroke();
						}
						//---------------------------------------------
		        		/*ctx.globalAlpha=opc*0.7;	
						if (part.tlon1 && part.tlat1) 
						{
							gc = ol.proj.transform([part.tlon1,part.tlat1],'EPSG:4326','EPSG:3857');
							p1 = map.getPixelFromCoordinate(gc);
			        		ctx.beginPath();
			        		ctx.arc(p1[0], p1[1], 10, 0, (Math.PI*2), false);
			        	    ctx.fillStyle="#00FF00"
			        	    ctx.fill();
			        	    ctx.lineWidth = 3;
			        	    ctx.strokeStyle=part.color;
			        	    ctx.stroke();
			        		ctx.font = "bold 13px Lato-Regular";
			        		ctx.fillStyle = "black";
			        		ctx.textAlign = "right";
			        		ctx.globalAlpha=1;	
			        		ctx.fillText(Math.round((part.telapsed1)*1000)/1000,p1[0],p1[1]+2-15);
			        		ctx.globalAlpha=opc*0.7;
			        		if (!part.tlon2 || !part.tlat2) {
			        			debugger;
			        		}
						}
						if (part.tlon2 && part.tlat2) 
						{
							gc = ol.proj.transform([part.tlon2,part.tlat2],'EPSG:4326','EPSG:3857');
							p1 = map.getPixelFromCoordinate(gc);
			        		ctx.beginPath();
			        		ctx.arc(p1[0], p1[1], 10, 0, (Math.PI*2), false);
			        		ctx.fillStyle="#FF0000"
				        	ctx.fill();
			        	    ctx.lineWidth = 3;
			        	    ctx.strokeStyle=part.color;
			        	    ctx.stroke();
			        		ctx.font = "bold 13px Lato-Regular";
			        		ctx.fillStyle = "black";
			        		ctx.textAlign = "left";
			        		ctx.globalAlpha=1;	
			        		ctx.fillText(Math.round((part.telapsed2)*1000)/1000,p1[0],p1[1]+2);
						}*/
					}
				}
        		ctx.setTransform(1, 0, 0, 1, 0, 0);	//RESET MATRIX
	        	ctx.globalAlpha=1;
			});
			
			var proxiesLayer=this.proxiesLayer;
			var map;		
			this.map = new ol.Map({
			  /*interactions: ol.interaction.defaults().extend(
			  [
			  ]),*/
			  renderer : "canvas",
			  target: this.target,
			  layers: [
			        this.tileLayer,
			        this.staticImageLayer,
					this.trackLayer,
					this.elapsedLayer
			  ],
			  controls: this.isWidget ? [] : ol.control.defaults(),
			  view: new ol.View({
				center: ol.proj.transform(defPos, 'EPSG:4326', 'EPSG:3857'),
				zoom: this.initialZoom,
				minZoom: 5,
				maxZoom: CONFIG.appearance.debug ? 20 : 19,
				extent : extent ? extent : undefined
			  })
			});
			map=this.map;
			this.map.tileSource=ts;
			for (var i=0;i<ints.length;i++)
				this.map.addInteraction(ints[i]);
			this.map.addOverlay(this.popup2);
			this.map.addOverlay(this.popup1);
			if (this.isDebug) { 
				this.map.addLayer(this.debugLayerGPS);
				this.map.addLayer(this.testLayer);
				this.map.addLayer(this.testLayer1);
				this.map.addLayer(this.testLayer2);
			}
			if (this.track) { 
				this.track.init();
				this.addTrackFeature();
			}
			//----------------------------------------------------
			if (!this.isWidget) 
			{
				this.map.on('click', function (event) 
				{
					var selectedParticipants = [];
					var selectedHotspot = null;
					for (var i=0;i<sortedParticipants.length;i++)  
					{
						var pt = sortedParticipants[i];
						if (pt.geometry) {
			    			var f1 = map.getPixelFromCoordinate(pt.geometry);
			    			if ((f1[0]-event.pixel[0])*(f1[0]-event.pixel[0])+(f1[1]-event.pixel[1])*(f1[1]-event.pixel[1]) <= 19*19) {
								selectedParticipants.push(pt);
			    			}
						}
					}
					// first if there are selected participants then show their popups
					// and only if there are not use the selected hotspot if there's any
					if (selectedParticipants.length) 
					{
						this.setSelectedFromCandidates(selectedParticipants)
					} else {
						this.setSelectedParticipant1(null);
						this.setSelectedParticipant2(null);
						this.toPan=null;
						if (selectedHotspot) {
							selectedHotspot.hotspot.onClick();
						}
					}
					if (this.onMapClick) 
						this.onMapClick();
					this.refreshHTML();
				}, this);
			}
			//-----------------------------------------------------
			// if this is ON then it will show the coordinates position under the mouse location
			if (this.isDebugShowPosition) {
				$("#"+this.target).append('<p id="debugShowPosition">EPSG:3857 <span id="mouse3857"></span> &nbsp; EPSG:4326 <span id="mouse4326"></span>');
				this.map.on('pointermove', function(event) {
					var coord3857 = event.coordinate;
					var coord4326 = ol.proj.transform(coord3857, 'EPSG:3857', 'EPSG:4326');
					$('#mouse3857').text(ol.coordinate.toStringXY(coord3857, 2));
					$('#mouse4326').text(ol.coordinate.toStringXY(coord4326, 15));
				});
			}

        },
        
		loadParticipantFromFeature : function(fpart,onLoad) {
			LR.person.byId(fpart.id,function(pdata) {
				/// !!!! LOAD FROM DB !!!!!
				var part = new Participant({id:pdata.id,deviceId:pdata.deviceId,code:(pdata.firstName || "?")+((" "+pdata.lastName) || "")});
				part.getCrrTime=this.getCrrTime;
				part.alias=pdata.alias;
		        part.setIsFavorite(true);
		        //part.setPos(pos);
	            part.setColor(pdata.color);
	            //part.setAgeGroup(pdata.ageGroup);
	            part.setAge(pdata.age);
	            part.setCountry(pdata.nationality);
	            //part.setStartPos(pdata.startPos);
	            part.setGender(pdata.gender ? pdata.gender.toUpperCase() : '?');
	            part.setIcon(pdata.image);
	            part.setImage(pdata.image);
	            part.feature=fpart;
	            onLoad(part);
			});
		},

        setSelectedFromCandidates : function(selectedParticipants) {
			if (this.selectedParticipant1 == null) {
				var feat = this.getSelectedParticipantFromArrayCyclic(selectedParticipants);
				if (feat) 
					this.loadParticipantFromFeature(feat,this.setSelectedParticipant1.bind(this));
				else
					this.setSelectedParticipant1(null);
				this.selectNum = 0;
			} else if (this.selectedParticipant2 == null) {
				var feat = this.getSelectedParticipantFromArrayCyclic(selectedParticipants);
				if (feat)
					this.loadParticipantFromFeature(feat,this.setSelectedParticipant2.bind(this));
				else
					this.setSelectedParticipant2(null);
				this.selectNum = 1;
			} else {
				this.selectNum = (this.selectNum + 1) % 2;
				if (this.selectNum == 0) {
					var feat = this.getSelectedParticipantFromArrayCyclic(selectedParticipants);
					if (feat)
						this.loadParticipantFromFeature(feat,this.setSelectedParticipant1.bind(this));
					else
						this.setSelectedParticipant1(null);
				} else {
					var feat = this.getSelectedParticipantFromArrayCyclic(selectedParticipants);
					if (feat)
						this.loadParticipantFromFeature(feat,this.setSelectedParticipant2.bind(this));
					else
						this.setSelectedParticipant2(null);
				}
			}
        },
        
        addTrackFeature : function() {
        	this.track.init();
        	if (this.track.feature) {
        		this.trackLayer.getSource().addFeature(this.track.feature);
        	}
        },
        zoomToTrack : function() {
            this.map.getView().fit(this.trackLayer.getSource().getExtent(),this.map.getSize());
        },
        
        getSelectedParticipantFromArrayCyclic : function(features) {
    		var arr = [];
    		var tmap = {};
    		var crrPos = 0;
			var pos=null;
			
    		for (var i=0;i<features.length;i++) 
    		{
    			var feature = features[i];
    			var id = feature.id;
    			arr.push(id);
    			tmap[id]=true;
				if (id == this.vr_lastselected) {
					pos=i;
				}
    		}
    		var same = this.vr_oldbestarr && pos != null; 
    		if (same) 
    		{
    			// all from the old contained in the new
    			for (var i=0;i<this.vr_oldbestarr.length;i++) 
    			{
    				if (!tmap[this.vr_oldbestarr[i]]) {
    					same=false;
    					break;
    				}
    			}
    		}
    		if (!same) {
    			this.vr_oldbestarr=arr;
    			this.vr_lastselected=arr[0];
    			return features[0];
    		} else {
    			this.vr_lastselected = pos > 0 ? arr[pos-1] : arr[arr.length-1];    			
        		var resultFeature;
    			for (var i=0;i<features.length;i++) 
        		{
        			var feature = features[i];
        			var id = feature.id;
        			if (id == this.vr_lastselected) {
        				resultFeature=feature;
        				break;
        			}
        		}
                return resultFeature;
    		}
        },
        
		showError : function(msg,onCloseCallback)
		{
			alert("ERROR : "+msg);
			if (onCloseCallback) 
				onCloseCallback();
		},
		
		refreshHTML : function()
		{
			var ctime = new Date();
			var timeSwitch = Math.round((new Date()).getTime()/(1000*5));
			var toPan = [];
			//-------------------------------------------------------
			if (!this.selectedParticipant1 && !this.selectedParticipant2)
				return;
			function dummy() { return "-"; }
			var getGraphValue = this.getGraphValue;
			var getPartDetails = this.getPartDetails || dummy; 
			var that=this;
			function getExtraInfo(id) 
			{
				var extraInfo = [];
				var vv={};
				if (getGraphValue) 
				{
					if (!that.isEventMode) {
						vv.bat=getGraphValue(id,"battPerc");
						vv.charger=getGraphValue(id,"charger") > 0;
						if (vv.bat != undefined)
							extraInfo.push({code:"Battery",value : Math.round(vv.bat*100)/100 + (vv.charger ? "%+":"%") });
						else
							extraInfo.push({code:"Battery",value:"-"});
					} else {
						var grp = getPartDetails(id,"start_group");
						var n = "Group/BIB";
						if (!grp || !grp.length) {
							grp="";
							n="BIB";
						} else 
							grp=grp+"/";
						extraInfo.push({code:n,value:grp+getPartDetails(id,"start_pos")});
						//--------------------------------------------------------------------
						// GET RANKING DATA
						//--------------------------------------------------------------------
						var ovrRank = getGraphValue(id,"ovrrank");
						var genRank = getGraphValue(id,"grprank");
						var grpRank = getGraphValue(id,"genrank");
						var arr=[];
						if (ovrRank) arr.push("# "+Math.floor(ovrRank)+" OVR");
						if (grpRank) arr.push("# "+Math.floor(grpRank)+" GRP");
						if (genRank) arr.push("# "+Math.floor(genRank)+" GEN");
						if (arr.length)
							extraInfo.push({code:"ranking",value:arr});
					}
					if (!that.isEventMode) {
						vv.signal=getGraphValue(id,"gsmSignal");
						if (vv.signal != undefined)
							extraInfo.push({code:"Signal",value:Math.round(vv.signal*100)/100+"%"});
						else
							extraInfo.push({code:"Signal",value:"-"});
						vv.uptimeSys=getGraphValue(id,"uptimeSys")
						if (vv.uptimeSys != undefined)
							extraInfo.push({code:"Uptime",value: Math.round(vv.uptimeSys/60*100)/100+" min."});
						else
							extraInfo.push({code:"Uptime",value: "-"});
					} else {
						function fg(c) {
							switch (c) {
								case "m": return "Male";
								case "f": return "Female";
								return c;
							}
						}
						extraInfo.push({code:"Type",value:getPartDetails(id,"age")+" "+fg(getPartDetails(id,"gender"))+" "+getPartDetails(id,"type")});
						//extraInfo.push({code:"Club",value:getPartDetails(id,"club")});						
					}				
				
					vv.ecall=getGraphValue(id,"ecall");
					if (vv.ecall != undefined)
						extraInfo.push({code:"E-Call",value:vv.ecall ? "yes" : "no"});
					else
						extraInfo.push({code:"E-Call",value:"-"});

				}
				return extraInfo;
			}
			infoCollected.call(this);
			var doAttachClick=false;			
			function infoCollected()
			{
				if (this.selectedParticipant1) 
				{
					var ctime = this.selectedParticipant1.__ctime;
					var spos = this.selectedParticipant1.feature.geometry;
					if (!this.popup1.is_shown) {
					    this.popup1.show(spos, this.popup1.lastHTML=this.getPopupHTML(this.selectedParticipant1,ctime,getExtraInfo(this.selectedParticipant1.id)));
					    this.popup1.is_shown=1;
					    doAttachClick=true;
					} else {
						if (!this.popup1.getPosition() || this.popup1.getPosition()[0] != spos[0] || this.popup1.getPosition()[1] != spos[1])
						    this.popup1.setPosition(spos);
						if (!this.lastPopupReferesh1 || (new Date()).getTime() - this.lastPopupReferesh1 > 2000) 
						{
							this.lastPopupReferesh1=(new Date()).getTime();
						    var rr = this.getPopupHTML(this.selectedParticipant1,ctime,getExtraInfo(this.selectedParticipant1.id));
						    if (rr != this.popup1.lastHTML) {
						    	this.popup1.lastHTML=rr;
							    this.popup1.content.innerHTML=rr; 
							    doAttachClick=true;
						    }					
						}
						if (this.selectedParticipant1Pan) {
							spos = ol.proj.transform(this.selectedParticipant1Pan,'EPSG:4326','EPSG:3857');
						}
						toPan.push([this.popup1,spos,this.selectedParticipant1.elapsed || 0]);
					}
				}
				if (this.selectedParticipant2) 
				{
					var ctime = this.selectedParticipant2.__ctime;
					var spos = this.selectedParticipant2.feature.geometry;
					if (!this.popup2.is_shown) {
					    this.popup2.show(spos, this.popup2.lastHTML=this.getPopupHTML(this.selectedParticipant2,ctime,getExtraInfo(this.selectedParticipant2.id)));
					    this.popup2.is_shown=1;
					    doAttachClick=true;
					} else {
						if (!this.popup2.getPosition() || this.popup2.getPosition()[0] != spos[0] || this.popup2.getPosition()[1] != spos[1])
						    this.popup2.setPosition(spos);
						if (!this.lastPopupReferesh2 || (new Date()).getTime() - this.lastPopupReferesh2 > 2000) 
						{
							this.lastPopupReferesh2=(new Date()).getTime();
						    var rr = this.getPopupHTML(this.selectedParticipant2,ctime,getExtraInfo(this.selectedParticipant2.id));
						    if (rr != this.popup2.lastHTML) {
						    	this.popup2.lastHTML=rr;
							    this.popup2.content.innerHTML=rr; 
							    doAttachClick=true;
						    }					
						}
						if (this.selectedParticipant2Pan)
							spos = ol.proj.transform(this.selectedParticipant2Pan,'EPSG:4326','EPSG:3857');
						toPan.push([this.popup2,spos,this.selectedParticipant2.elapsed || 0]);
					}
				}
				//-----------------------
				if (!this.blockPanv && toPan.length) 
				{
				}					/*toPan.sort(function(a,b) {
						return b[2]-a[2];	// order by elasped
					});*/
					var minlon;
					var minlat;
					var maxlon;
					var maxlat;
					for (var i=0;i<toPan.length;i++) {
						var p = toPan[i];
						var g = p[1];
						if (g) 
						{
							if (!minlon || minlon > g[0])
								minlon=g[0];
							if (!minlat || minlat > g[1])
								minlat=g[1];
							if (!maxlon || maxlon < g[0])
								maxlon=g[0];
							if (!maxlat || maxlat < g[1])
								maxlat=g[1];
						}
					}
					if (minlon && minlat && maxlon && maxlat)
						this.toPan=[minlon,minlat,maxlon,maxlat];
					else
						delete this.toPan;
					
				if (doAttachClick) 
				{
					var arr = $(".part-flt-"+this.seq);
					for (var i=0;i<arr.length;i++) 
					{
						var e = arr[i];
						if (!$(e).data("fav-click-attached")) 
						{
							$(e).data("fav-click-attached","1");
							var pid = $(e).data("pid"); 
							var that=this;
							$(e).click(function() {
								var pid = $(this).data("pid"); 
								if (that.onWatchClicked)
									that.onWatchClicked(pid);
							});
						}
					}
				}
			}
		},

		setSelectedParticipant1ZIndex : function(zIndex) {
			if (!this.popup1 || !this.popup1.getElement())
				return;
			this.popup1.getElement().style.zIndex=zIndex;
		},
		setSelectedParticipant2ZIndex : function(zIndex) {
			if (!this.popup2 || !this.popup2.getElement())
				return;
			this.popup2.getElement().style.zIndex=zIndex;
		},
		setSelectedParticipant1 : function(part,center) {
			this.selectedParticipant1Pan=null;
			if (this.selectedParticipant2 && part && this.selectedParticipant2.id == part.id)
				return;
			if (!this.selectedParticipant1 && !part)
				return;
			this.selectedParticipant1=part;
			if (!part) {
				this.popup1.hide();
				delete this.popup1.is_shown;
			} else {
				this.popup2.getElement().style.zIndex=0;
				this.popup1.getElement().style.zIndex=1;
				this.lastPopupReferesh1=0;
			} 
			if (this.onSelectionChanged)
				this.onSelectionChanged();
		},

		setSelectedParticipant2 : function(part,center) {
			this.selectedParticipant2Pan=null;
			if (this.selectedParticipant1 && part &&  this.selectedParticipant1.id == part.id)
				return;
			if (!this.selectedParticipant2 && !part)
				return;
			this.selectedParticipant2=part;
			if (!part) {
				this.popup2.hide();
				delete this.popup2.is_shown;
			} else {
				this.popup1.getElement().style.zIndex=0;
				this.popup2.getElement().style.zIndex=1;
				this.lastPopupReferesh2=0;
				/*if (center && GUI.map && part.feature) {
					var x = (part.feature.getGeometry().getExtent()[0]+part.feature.getGeometry().getExtent()[2])/2;
					var y = (part.feature.getGeometry().getExtent()[1]+part.feature.getGeometry().getExtent()[3])/2;
					GUI.map.getView().setCenter([x,y]);
				}*/
			} 
			if (this.onSelectionChanged)
				this.onSelectionChanged();
		},
		
		invalidatePopups : function() {
			this.lastPopupReferesh1=0;
			this.lastPopupReferesh2=0;
		},

		setSelectedParticipant : function(part) {
			if (!this.popup1.is_shown)  {
				this.setSelectedParticipant1(part, true);
			} else if (!this.popup2.is_shown) {
				this.setSelectedParticipant2(part, true);
			} else {
				this.setSelectedParticipant1(part, true);
			}
		},

		doDebugAnimation : function() 
		{
			var ctime = (new Date()).getTime();
			var todel=[];
			var rr = this.debugLayerGPS.getSource().getFeatures();
			for (var i=0;i<rr.length;i++)
			{
				var f = rr[i];
				if (ctime - f.timeCreated - CONFIG.math.displayDelay*1000 > CONFIG.timeouts.gpsLocationDebugShow*1000)
					todel.push(f);
				else
					f.changed();
			}
			if (todel.length) 
			{
				for (var i=0;i<todel.length;i++)
					this.debugLayerGPS.getSource().removeFeature(todel[i]);
			}
			//-------------------------------------------------------------
		},
		
		redraw : function() {
			this.getTrack().getFeature().changed();
		},
		
		getPopupHTML : function(part,ctime,extraInfo) {
			var html=[];
			var bgcolor = "background-color:"+(part.getColor() || "rgba(0,0,0,0.35)")+";";
			
			if (!this.seq)
				this.seq=(new Date()).getTime();
			
			html.push("<div data-pid='"+part.id+"' class='part-flt-"+this.seq+" participant-map-popup' style=''>");
			
			var src = part.getGender() == "M" ? "src='images/missing-male.png'" : "src='images/missing-female.png'";
			if (part.getImage()) {
				src="src='"+part.getImage()+"'";
			}
			if (this.getGraphValue)
				part.altitude=this.getGraphValue(part.id,"alt");
			html.push("<div class='part-code'  style='"+bgcolor+"'>"+(part.rank ? "<b style='font-weight:800'>"+part.rank+"</b> | " : "")+escapeHTML(part.getCode())+"</div>");
			html.push("<div class='part-image'><img "+src+" class='part-icon' style=''/>");
			if (part && part.getCountry()) {
				html.push('<div class="part-flat" style="position:absolute;width:32px;height:32px;top:-4px;left:3px;">');
				html.push('<span class="f32" country="'+part.getCountry().toLowerCase()+'" size="32"><span class="flag '+part.getCountry().toLowerCase()+'"></span></span>');
				html.push('</div>');
			}
			html.push("</div>")
			if (this.getIsWatched && this.getIsWatched(part.id))
				html.push("<img src='images/graph-on.png' style='' class='part-graph-icon' />");
			else
				html.push("<img src='images/graph-off.png' style='' class='part-graph-icon' />");
			//--------------------------------------------------------------------------
			html.push("<div class='info-data'>");
			var extraRows = [];
			html.push(part.getPopupHTML(this.isEventMode ? this.track : null,extraInfo));
			html.push("</div>");
			//--------------------------------------------------------------------------
			html.push("</div>");
			return html.join("");
			
		}
    }
});