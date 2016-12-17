var CONFIG = require('./Config');
//---------------------------------
var DEFPARTCOLOR = "rgba(0,0,0,0.15)";
var aliases={};
var aliasesR={};
/*$.ajax({
	type: "GET",
	url: "data/aliases.xml",
	dataType: "xml",
	success: function(xml) {
		var $xml = $(xml);
		var $title = $xml.find( "M2MDevice" ).each(function() {
			var devId=$(this).attr("m2mDeviceId");
			var imei=$(this).attr("imeiNumber");
			aliases[imei]=devId;
			aliasesR[devId]=imei;
		});
	}
});*/
function alias(imei) 
{ 
	if (aliasesR[imei])
		return aliasesR[imei];
	return imei;
}
//---------------------------------


var STYLES=
{
	//------------------------------------------------
	// style function for track
	//------------------------------------------------
		
	"_track": function(feature,resolution) 
	{
        return [
        ];
	},

	"tile": function(feature,resolution) 
	{
		var styles=[];
        styles.push(new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: "rgba(255,0,0,1)",
                width: 3
            }),
	        fill: new ol.style.Fill({
	        	color: "rgba(40,255,40,0.4)"
		    })
        }));

        styles.push(new ol.style.Style({
            text: new ol.style.Text({
	            font: 'bold 15px Lato-Regular',
	            fill: new ol.style.Fill({
	                color: 'rgba(255,255,255,1)'
	            }),
	            text: ""+Math.round(feature.minlon*10000)/10000+" "+Math.round(feature.minlat*10000)/10000,
	            offsetX:  0,
	            offsetY : 0+30
	        })
        }));

        styles.push(new ol.style.Style({
            text: new ol.style.Text({
	            font: 'bold 15px Lato-Regular',
	            fill: new ol.style.Fill({
	                color: 'rgba(255,255,255,1)'
	            }),
	            text: ""+Math.round(feature.maxlon*10000)/10000+" "+Math.round(feature.maxlat*10000)/10000,
	            offsetX:  0,
	            offsetY : 15+30
	        })
        }));

        
        return styles;
	},

	"test": function(feature,resolution) 
	{
		var styles=[];
        styles.push(new ol.style.Style({
            image: new ol.style.Circle({
                radius: 17,
                fill: new ol.style.Fill({
                    color: "rgba(255,255,255,0.5)"
                }),
                stroke: new ol.style.Stroke({
                    color: "rgba(255,255,255,1)",
                    width: 3
                })
            })
        }));
        return styles;
	},

	"test2": function(feature,resolution) 
	{
		var styles=[];
        styles.push(new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: "rgba(255,255,0,1)",
                width: 3
            }),
	        image: new ol.style.Circle({
	            radius: 7,
	            stroke: new ol.style.Stroke({
	            	//feature.color
	                color: "rgba(255,255,0,1)",
	                width: 3
	            }),
	            fill: new ol.style.Stroke({
	            	//feature.color
	                color: "rgba(255,255,0,0.7)",
	                width: 3
	            })
	        }),
	        text: new ol.style.Text({
	            font: 'bold 15px Lato-Regular',
	            fill: new ol.style.Fill({
	                color: 'rgba(255,255,0,1)'
	            }),
	            text: feature.getGeometry() instanceof ol.geom.Point ? (Math.round(feature.debugInfo.value*100*100.0)/100.0)+"%" : "",
	            offsetX:  0,
	            offsetY : 16
	        })
        }));
        return styles;
	},

	"test1": function(feature,resolution) 
	{
		var styles=[];
        styles.push(new ol.style.Style({
             stroke: new ol.style.Stroke({
                 color: "rgba(0,0,0,0.4)",
                 width: 3
             }),
	         fill: new ol.style.Fill({
	            color: "rgba(40,255,40,0.2)"
	         }),
        }));
        return styles;
	},
	"path" : new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: CONFIG.appearance.trackColorBike,
            width: 10
        })
    }),

	"track" : function(resolution) 
	{
		var feature=this;
		var styles=[];
		var track=feature.track;
		if (!track) {
			console.log("Rendering track feature without track object!");
			return styles;
		}
		
		var GUI = track.settings || {isShowSwim : true, isShowBike : true, isShowRun : true};
		var geomswim=track.geomSwim;
		var geombike=track.geomBike;
		var geomrun=track.geomRun;
		//-------------------------------------
		var ww=10.0;
		//-------------------------------------
        if (geomswim && GUI.isShowSwim) {
            styles.push(new ol.style.Style({
                    geometry: geomswim,
                    stroke: new ol.style.Stroke({
                        color: CONFIG.appearance.trackColorSwim,
                        width: ww
                    })
                })
            );
            var coords = geomswim.getCoordinates();
            STYLES._genDirection(geomswim, ww, resolution, CONFIG.appearance.trackColorSwim, styles);
            STYLES._genDistanceKm(ww, resolution, coords, track.distances, 0, coords.length, styles);
			// for now don't show this checkpoint
			//if (GUI.isShowSwim)
			//	STYLES._genCheckpoint(geomswim, CONFIG.appearance.trackColorSwim, styles);
        }
        if (geombike && GUI.isShowBike)
        {
            styles.push(new ol.style.Style({
                    geometry: geombike,
                    stroke: new ol.style.Stroke({
                        color: CONFIG.appearance.trackColorBike,
                        width: ww
                    })
                })
            );
            var coords = geombike.getCoordinates();
            STYLES._genDirection(geombike, ww, resolution, CONFIG.appearance.trackColorBike, styles);
            STYLES._genDistanceKm(ww, resolution, coords, track.distances, 0, coords.length, styles);

			// add checkpoint if this is not already added as a hotspot
			if (!track.isAddedHotSpotSwimBike) {
				if (CONFIG.appearance.isShowCheckpointImage)
					STYLES._genCheckpointImage(geombike, CONFIG.appearance.imageCheckpointSwimBike, styles);
				else if (CONFIG.appearance.isShowCheckpoint && GUI.isShowBike)
					STYLES._genCheckpoint(geombike, CONFIG.appearance.trackColorBike, styles);
			}
        }
		if (geomrun && GUI.isShowRun)
		{
			styles.push(new ol.style.Style({
                    geometry: geomrun,
                    stroke: new ol.style.Stroke({
                        color: CONFIG.appearance.trackColorRun,
                        width: ww
                    })
                })
            );
            var coords = geomrun.getCoordinates();
            STYLES._genDirection(geomrun, ww, resolution, CONFIG.appearance.trackColorRun, styles);
            STYLES._genDistanceKm(ww, resolution, coords, track.distances, 0, coords.length, styles);

			// add checkpoint if this is not already added as a hotspot
			if (!track.isAddedHotSpotBikeRun) {
				if (CONFIG.appearance.isShowCheckpointImage)
					STYLES._genCheckpointImage(geomrun, CONFIG.appearance.imageCheckpointBikeRun, styles);
				else if (CONFIG.appearance.isShowCheckpoint && GUI.isShowBike)
					STYLES._genCheckpoint(geomrun, CONFIG.appearance.trackColorRun, styles);
			}
        }

		// START-FINISH --------------------------
		function addStartFinish(coords,color,skipEnd,skipBegin) 
		{
			if (coords) {
				if (coords.length >= 2) 
				{
					if (!skipBegin) {
						var start = coords[0];
						var ge = new ol.geom.Point(start);
						styles.push(new ol.style.Style(
						{
							geometry: new ol.geom.Point(start),
							image: new ol.style.Icon({
								src: 'images/start.png',
								scale : 1,
								anchor: [0.5, 0.5],
								opacity : 1
							})
						}));
					}
					if (!skipEnd) {
						var end = coords[coords.length-1];
						var ge = new ol.geom.Point(end);
						styles.push(new ol.style.Style(
						{
							geometry: ge,
							image: new ol.style.Icon({
								src: 'images/finish.png',
								scale : 1,
								anchor: [0.5, 0.5],
								opacity : 1
							})
						}));
					}
				}
			}
		}
		if (UI.Config.appearance && UI.Config.appearance.isShowStartFinish) {
			var first = geomswim || geombike || geomrun;
			var last = geomrun || geombike || geomswim;
			if (first)
				addStartFinish(first.getCoordinates(),CONFIG.appearance.trackColorSwim,true,false);
			if (last)
				addStartFinish(last.getCoordinates(),CONFIG.appearance.trackColorRun,false,true);
		}
		return styles;
	},
	//--------------------------------------
	"elapsed" : function(feature,resolution) 
	{
		var arr=[];
		var elapsed = feature.elapsed;
		var icn = feature.getIcon(elapsed);
		if (icn) {
			var g = feature.getGeometry().getCoordinates();
			//var p = [g[0]+(icn.x || 0)*resolution,g[1]-(icn.y || 0)*resolution];
			var p = [g[0]+(icn.x || 0),g[1]-(icn.y || 0)];
			arr.push(new ol.style.Style({
				image : new ol.style.Icon({
					src : "/img/"+icn.image,
					scale : (icn.scale || 1),
					opacity : 0.27
				}),
				geometry: new ol.geom.Point(p)
			 }));
		   if (feature.name) 
		   {
	            arr.push(new ol.style.Style({
	                text: new ol.style.Text({
	                    font: 'bold 12px Helvetica',
	                    fill: new ol.style.Fill({
	                        color: 'black'
	                    }),
	                    stroke: new ol.style.Stroke({
	                      color: 'white',
	                      width: 4
	                    }),
	                    text: feature.name,
	                    offsetX: 0,
	                    offsetY: 0
	                })
	            }));
		   }
		} else {
			arr.push(new ol.style.Style({
				image : new ol.style.Icon(({
					src : "images/pixel.png",
					scale : 1.5/(resolution)
				}))
			 }));
		}
		return arr;
	},
	
	"participant" : function(feature,resolution) 
	{
		// SKIP DRAW (TODO OPTIMIZE)
		var part = feature.participant;
		if (!part.isFavorite)
			return [];
		var ctime = (new Date()).getTime();
		var speed = part.getSpeed();
		var etxt="";
		if (speed) {
			etxt=" "+parseFloat(Math.ceil(speed* 100) / 100).toFixed(2)+" m/s";
		}
		// TODO : SET PROPER Z INDEX!!!!
		var zIndex = Math.round(part.getElapsed()*1000000)*1000+part.id/10000.0;
		var styles=[];
		//-----------------------------------------------------------------------------------------------------------------------
		var isTime = true; //(ctime >= CONFIG.times.begin && ctime <= CONFIG.times.end);
		var isSOS = false; // part.min(ctime,"isSOS");
		var isDiscarded = false; //part.min(ctime,"isDiscarded");
		var isDirection = (speed && !isSOS && !isDiscarded && isTime);
		var animFrame = (ctime%3000)*Math.PI*2/3000.0;

        if (isTime) {
            styles.push(new ol.style.Style({
                zIndex: zIndex,
                image: new ol.style.Circle({
                    radius: 17,
                    fill: new ol.style.Fill({
                        color: isDiscarded || isSOS ? "rgba(192,0,0," + (Math.sin(animFrame) * 0.7 + 0.3)*part.opacity + ")" : "rgba(" + blendColorToArray(part.color|| DEFPARTCOLOR, 0.85*part.opacity).join(",") + ")"
                    }),
                    stroke: new ol.style.Stroke({
                        color: isDiscarded || isSOS ? "rgba(255,0,0," + (1.0 - (Math.sin(animFrame) * 0.7 + 0.3))*part.opacity + ")" : "rgba(255,255,255,"+part.opacity+")",
                        width: 3
                    })
                })/*,
                text: new ol.style.Text({
                    font: 'normal 13px Lato-Regular',
                    fill: new ol.style.Fill({
                        color: 'rgba(255,255,255,'+part.opacity+')'
                    }),
                    text: part.getInitials(),
                    offsetX: 0,
                    offsetY: 0
                })*/
            }));
        } else {
            styles.push(new ol.style.Style({
                zIndex: zIndex,
                image: new ol.style.Circle({
                    radius: 17,
                    fill: new ol.style.Fill({
                        color: "rgba(" + blendColorToArray(part.color|| DEFPARTCOLOR, 0.35*part.opacity).join(",") + ")"
                    }),
                    stroke: new ol.style.Stroke({
                        color: "rgba(255,255,255,"+part.opacity+")",
                        width: 3
                    })
                })/*,
                text: new ol.style.Text({
                    font: 'normal 13px Lato-Regular',
                    fill: new ol.style.Fill({
                        color: 'rgba(0,0,0,'+part.opacity+')'
                    }),
                    text: alias(part.getDeviceId()),
                    offsetX: 0,
                    offsetY: 20
                })*/
            }));
        }
        //--------------------------------------------------
        styles.push(new ol.style.Style({
            zIndex: zIndex,
            image: new ol.style.Circle({
                radius: 17,
                fill: new ol.style.Fill({
                    color: part.isDiscarded || part.isSOS ? "rgba(192,0,0," + (Math.sin(animFrame) * 0.7 + 0.3)*part.opacity + ")" : "rgba(" + blendColorToArray(part.color|| DEFPARTCOLOR, 0.85*part.opacity).join(",") + ")"
                }),
                stroke: new ol.style.Stroke({
                    color: part.isDiscarded || part.isSOS ? "rgba(255,0,0," + (1.0 - (Math.sin(animFrame) * 0.7 + 0.3))*part.opacity + ")" : "rgba(255,255,255,"+part.opacity+")",
                    width: 3
                })
            })/*,
            text: new ol.style.Text({
                font: 'normal 13px Lato-Regular',
                fill: new ol.style.Fill({
                    color: 'rgba(255,255,255,'+part.opacity+')'
                }),
                text: part.getInitials(),
                offsetX: 0,
                offsetY: 0
            })*/
        }));
        if (isDirection && part.getRotation() != null)
        {
            styles.push(new ol.style.Style({
                zIndex: zIndex,
                image: new ol.style.Icon(({
                    anchor: [-0.5,0.5],
                    anchorXUnits: 'fraction',
                    anchorYUnits: 'fraction',
                    opacity: part.opacity,
                    src : renderArrowBase64(48,48,part.color|| DEFPARTCOLOR),
					  scale : 0.55,
					  rotation : -part.getRotation()
				   }))
			}));
		}
		return styles;
	},

	"proxy" : function(feature,resolution) 
	{
		// SKIP DRAW (TODO OPTIMIZE)
		var proxy = feature.proxy;
		var styles=[];
		var r = (proxy.cnt*22)/200;
		if (r > 22)
			r=22;
		r+=17;
		console.log(proxy.cnt+" | "+r);
		//-----------------------------------------------------------------------------------------------------------------------
        styles.push(new ol.style.Style({
            image: new ol.style.Circle({
                radius: r,
                fill: new ol.style.Fill({
                    color: "rgba(255,0,0,"+proxy.opacity*0.35+")"
                }),
                stroke: new ol.style.Stroke({
                    color: "rgba(255,255,255,"+proxy.opacity+")",
                    width: 3
                })
            }),
            text: new ol.style.Text({
                font: 'normal 13px Lato-Regular',
                fill: new ol.style.Fill({
                    color: "rgba(255,255,255,"+proxy.opacity+")"
                }),
                text: proxy.cnt+"",
                offsetX: 0,
                offsetY: 0
            })
        }));
		return styles;
	},

	"cam" : function(feature, resolution) {
		var styles=[];

		var cam = feature.cam;

		styles.push(new ol.style.Style({
			image: new ol.style.Icon(({
				// TODO Rumen - it's better all images to be the same size, so the same scale
				scale : 0.040,
				src : CONFIG.appearance.imageCam.split(".svg").join((cam.seqId+1) + ".svg")
			}))
		}));

		return styles;
	},

    "hotspot" : function(feature, resolution) {
        var styles=[];

        var hotspot = feature.hotspot;

        styles.push(new ol.style.Style({
            image: new ol.style.Icon(({
                scale : hotspot.getType().scale || 1,
                src : hotspot.getType().image
            }))
        }));

        return styles;
    },

	//------------------------------------------------
	// Private methods
	//------------------------------------------------

	_trackSelected : new ol.style.Style({
		stroke: new ol.style.Stroke({
			color: '#FF5050',
			width: 4.5
		})
	}),

	_genCheckpoint : function(geometry, color, styles) {
		var start = geometry[0];
		var end = geometry[1];
		var dx = end[0] - start[0];
		var dy = end[1] - start[1];
		var rotation = Math.atan2(dy, dx);

		styles.push(new ol.style.Style({
			geometry: new ol.geom.Point(start),
			image: new ol.style.Icon({
				src: renderBoxBase64(16,16,color),
				scale : 1,
				anchor: [0.92, 0.5],
				rotateWithView: true,
				rotation: -rotation,
				opacity : 0.65
			})
		}));
	},

	_genCheckpointImage : function(geometry, image, styles) {
		var start = geometry[0];
		//var end = geometry[1];
		//var dx = end[0] - start[0];
		//var dy = end[1] - start[1];
		//var rotation = Math.atan2(dy, dx);

		styles.push(new ol.style.Style({
			geometry: new ol.geom.Point(start),
			image: new ol.style.Icon({
				src: image,
				//scale : 0.65,
				anchor: [0.5, 0.5],
				rotateWithView: true,
				//rotation: -rotation,
				opacity : 1
			})
		}));
	},

	_genDirection : function(pts, ww, resolution, color, styles) {
        if (CONFIG.appearance.directionIconBetween <= 0) {
            // this means no need to show the directions
            return;
        }

        var cnt = 0;
        var icn = renderDirectionBase64(16, 16, color);
        var res = 0.0;
        for (var i = 0; i < pts.length - 1; i++) {
            var start = pts[i + 1];
            var end = pts[i];
            var dx = end[0] - start[0];
            var dy = end[1] - start[1];
            var len = Math.sqrt(dx * dx + dy * dy) / resolution;
            res += len;
            if (i == 0 || res >= CONFIG.appearance.directionIconBetween) {
                res = 0;
                var rotation = Math.atan2(dy, dx);
                styles.push(new ol.style.Style({
                    geometry: new ol.geom.Point([(start[0] + end[0]) / 2, (start[1] + end[1]) / 2]),
                    image: new ol.style.Icon({
                        src: icn,
                        scale: ww / 12.0,
                        anchor: [0.5, 0.5],
                        rotateWithView: true,
                        rotation: -rotation + Math.PI, // add 180 degrees
                        opacity: 1
                    })
                }));
                cnt++;
            }
        }
    },

    _genDistanceKm : function(ww, resolution,
							  coords, distances, startDistIndex, endDistIndex,
							  styles) {
        // TODO Rumen - still not ready - for now static hotspots are used
        if (true) {return;}

        var hotspotsKm = [20, 40, 60, 80, 100, 120, 140, 160, 180];

        function addHotSpotKM(km, point) {
            //var dx = end[0] - start[0];
            //var dy = end[1] - start[1];
            //var rotation = Math.atan2(dy, dx);
            styles.push(new ol.style.Style({
                //geometry: new ol.geom.Point([(start[0]+end[0])/2,(start[1]+end[1])/2]),
                geometry: new ol.geom.Point([point[0], point[1]]),
                image: new ol.style.Icon({
                    src: "img/" + km + "km.svg",
                    scale: 1.5,
                    rotateWithView: true,
                    //rotation: -rotation + Math.PI/2, // add 180 degrees
                    opacity : 1
                })
            }));
        }

        for (var i = startDistIndex; i < endDistIndex; i++) {
            if (!hotspotsKm.length) {
				return;
			}

			var dist = distances[i];

			if (dist >= hotspotsKm[0]*1000) {
				// draw the first hotspot and any next if it's contained in the same "distance"
				var removeHotspotKm = 0;
				for (var k = 0, lenHotspotsKm = hotspotsKm.length; k < lenHotspotsKm; k++) {
					if (dist >= hotspotsKm[k]*1000) {
						addHotSpotKM(hotspotsKm[k], coords[i]);
						removeHotspotKm++;
					} else {
						break;
					}
				}
				// remove all the already drawn hotspots
				for (var j = 0; j <removeHotspotKm; j++) hotspotsKm.shift();
			}
        }
    }
};

for (var i in STYLES)
	exports[i]=STYLES[i];

//------------------------------------------------------------------------
var atlasManager = new ol.style.AtlasManager({
	  // we increase the initial size so that all symbols fit into
	  // a single atlas image
	  initialSize: 512
});

exports.getPathStyle = function(color,getTimeFnc) 
{
	var rgba = UI.parseColor(color).rgba;
	return function(resolution) 
	{
		var ctime = getTimeFnc();
		var ltime = ctime - UI.Config.path.durationInSeconds*1000;
		var styles=[];
		var t1 = this.t1;
		var t2 = this.t2;
		if (t1 < ltime && t2 < ltime)
			return [];
		if (t1 > ctime && t2 > ctime)
			return [];
		var p1 = this.p1;
		var p2 = this.p2;
		var opacity = (t2-ltime)/(ctime-ltime);
		var stl = this.tyle;
		var w = 5*opacity+0.1;
		var col = "rgba("+rgba[0]+","+rgba[1]+","+rgba[2]+","+rgba[3]*0.85+")";
			return [this.stl=new ol.style.Style({
			      stroke : new ol.style.Stroke({
			    	  color : col
			    	  ,width : w
			      })		
			})];
	};
};

exports.getParticipantStyle = function(code,color) 
{
	var img = new ol.style.Circle({
		opacity: 1,
		radius: 17,
		fill: new ol.style.Fill({
			color: color
		}),
		stroke: new ol.style.Stroke({
			color: "white",
		    width: 3
		})
		// by passing the atlas manager to the symbol,
		// the symbol will be added to an atlas
		//,atlasManager: atlasManager
	});
	var text =new ol.style.Text({
		font: 'normal 13px Lato-Regular',
        fill: new ol.style.Fill({
        	color: "white"
        }),
        text: code,
        offsetX: 0,
        offsetY: 0
	});
	var val = new ol.style.Style({
		image : img,
		text : text,
	});
	var aval = new ol.style.Style({
		image : new ol.style.Icon(({
	        anchor: [-0.5,0.5],
	        anchorXUnits: 'fraction',
	        anchorYUnits: 'fraction',
	        opacity: 1,
	        src : renderArrowBase64(48,48,color),
			scale : 0.55,
			rotation : 0
		}))
	});
	var fnc = function(resolution) 
	{
		var opc = this.opacity;
		var col = this.color;
		var r = 1;
		var tt = undefined;
		if (!this.isWatched)
			r = 0.85;
		if (opc <= 0)
			return [];
		if (this.rotation != undefined && this.speed > 0) 
		{
			var xr = this.rotation/180*Math.PI;
			if (aval.getImage().getOpacity() != opc)
				aval.getImage().setOpacity(opc);
			if (aval.getImage().getRotation() != xr)
				aval.getImage().setRotation(xr);
			tt=aval;
		}
		if (img.getScale() != r)
			img.setScale(r);		
		if (img.getOpacity() != opc) 
			img.setOpacity(opc);
		var color = "rgba(255,255,255,"+opc+")";
		if (color != text.getFill().getColor())
			text.getFill().setColor(color);
		if (text.getScale() != r)
			text.setScale(r);		
		var brcolor = "rgba(255,255,255,"+opc+")";
		if (brcolor != img.getStroke().getColor())
			img.getStroke().setColor(brcolor);		
		var zIndex = this.isWatched ? 1 : 0;
		if (val.getZIndex() != zIndex)
			val.setZIndex(zIndex);
			
		if (tt)
			return [val,tt];
		else
			return [val];
	}
	//symbols[key]=val;
	return fnc;
};
