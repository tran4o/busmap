function rain(context,weather) 
{	
	var particleArray = [];
	var maxParticleCount = 1000;
	var wind = weather.wind;
	var intensity;
	var windSpeed;
	var isSnow; 

	function setData(weather) {
		isSnow=!weather.rain;
		intensity = weather.snow || weather.rain || 0;
		windSpeed = weather.wind || 0;
	}
	setData(weather);
	
	function addParticle() {
		if (Math.random() <= intensity) {
		    if (particleArray.length < maxParticleCount)
			    particleArray[particleArray.length] = new Particle();
		}
	}

	function Particle() {
	    this.x = Math.round(Math.random() * context.canvas.width);
	    this.y = Math.round(Math.random() * context.canvas.height)-context.canvas.height-16;
	    this.drift = windSpeed*3.2+3;//4;
	    this.speed = Math.random()*5*intensity/2.5+3*windSpeed;
	    if (this.speed < 15)
	    	this.speed=15;
	    var rand = Math.random();
	    if (!isSnow)
	    	this.rainDrop = rand < 0.33 ? $("#raindrop1").get(0) : rand < 0.66 ? $("#raindrop2").get(0) : $("#raindrop3").get(0);
	    else 
	    	this.rainDrop = rand < 0.33 ? $("#snowflake1").get(0) : rand < 0.66 ? $("#snowflake2").get(0) : $("#snowflake3").get(0);
	    
	    	this.speed*=4-Math.round(rand*3);
	}

	function update() 
	{
		var np=[];
	    for (var i = 0; i < particleArray.length; i++) {
	        if (particleArray[i].y < context.canvas.height) {
	            particleArray[i].y += particleArray[i].speed*(isSnow ? 0.2 : 1);
	            if (particleArray[i].y < context.canvas.height) // more or delete?
	            {
		            particleArray[i].x += particleArray[i].drift*(Math.random()*0.3+1)*(isSnow ? 0.2 : 1);
		            if (particleArray[i].x < context.canvas.width)
		            	np.push(particleArray[i]);
	            }
	        }
	    }
	    particleArray=np;
	}

	function paint() 
	{
		var cc=isSnow ? 4 : 8;
		for (var i=0;i<cc;i++)
			addParticle();
		if (particleArray.length) 
		{
			update();
		    for (var i = 0; i < particleArray.length; i++) {
				context.save();
				context.translate(particleArray[i].x, particleArray[i].y);
				context.translate(-particleArray[i].rainDrop.actualWidth/2, -particleArray[i].rainDrop.actualHeight/2);
				context.rotate((20-windSpeed*2.5)*Math.PI/180);
				context.translate(particleArray[i].rainDrop.actualWidth/2, particleArray[i].rainDrop.actualHeight/2); 
		        context.drawImage(particleArray[i].rainDrop,0,0);
			    context.restore();
		    }
		}
	}	
	
	var t = new (function() {
		this.paint=paint;
		this.update=update;
		this.Particle=Particle;
		this.addParticle=addParticle;
		this.setData=setData;
	})();	
	return t;
}
