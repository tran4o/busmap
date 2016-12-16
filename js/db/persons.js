var fs = require("fs");
var path = require("path");
var mkdirp = require("mkdirp");
var log = require("../misc/log");
var inst = require("../conf/installation");
var driver = require("./driver");
var authd = require("../misc/auth");
var dlocation = require("../db/discreteLocation");
var maxPersons = 1000;
if (inst.json && inst.json.limits && inst.json.limits.memoryCache && inst.json.limits.memoryCache.maxPersons > 0) {
	maxPersons=inst.json.limits.memoryCache.maxPersons;
} else {
	log.warn("Installation does not specify limits.memoryCache.maxPersons. Using default "+maxPersons);
}
//---------------------------------------------------
var LRU = require("lru-cache");
var options = { max: maxPersons };
var cache = LRU(options);
var updateHandlers = {};
exports.registerUpdateHandler = function(key,handler) {
	updateHandlers[key]=handler;
};
exports.unregisterUpdateHandler = function(key) {
	delete updateHandlers[key];
};

exports.getPersonByCode = function(auth,code,onDone) {
	if (!auth || auth.userGroup != 1) {
		exports.getPersonByCode(authd.admin,code,function(res) {
			if (res < 0 || !res.id || !auth || res.username != auth.username || res.password != auth.password) {
				var t={};
				for (var e in res) if (e != "username" && e != "password" && e != "userGroup" && e != "birthDate") {
					t[e]=res[e];
				}
				onDone(t);
			} else {
				onDone(res);
			}
		});
		return;
	}
	getPersonByQuery(auth,"code=$1",[code],onDone);
};

exports.getPersonByUsername = function(auth,username,onDone) {
	if (!auth || auth.userGroup != 1) {
		onDone(-1);
		return;
	}
	getPersonByQuery(auth,"username=$1",[username],onDone);
};


// TODO CACHE 
exports.getPersonByIdWithEventDetails = function(auth,id,event,onDone) {
	exports.getPersonById(auth,id,function(pers) {
		if (!pers || pers < 0)
			return onDone(pers);
		pers = cloneObject(pers);
		var dbcon = driver.connect(function(err,pgclient,done) 
		{
			if (err) 
			{
				log.error("Error on connecting to postgresql  : "+err);
				if (done)
					done();
				onDone(-1);
				return;
			}
			var sql = "SELECT X.start_pos,X.start_group,X.json FROM tracking.event_participant AS X WHERE X.event=$1 AND X.participant=$2";
			pgclient.query(sql,
				[event,id], 					 
				function(err, result) {
				if (done)
					done();
			    if(err) 
			    {
			    	log.error('Error getting event participant start info in POSTGRE : ',err);
			    	onDone(-1);
			    	return;
			    }
			    if (!result || !result.rows || !result.rows.length)
			    	onDone({});
			    else {
			    	var rr = result.rows[0];
			    	pers.start_pos=rr.start_pos;
			    	pers.start_group=rr.start_group;
			    	if (rr.json) 
			    	{
				    	try {
					    	pers.json=JSON.parse(rr.json);
				    	} catch (e) {
				    	}
			    	}
			    	onDone(pers);
			    }
			});
		});
	});
};

function cloneObject(person) {
	var k = {};
	for (i in person) 
	{
		var v = person[i];
		if (v instanceof Date)
			v = new Date(v);
		k[i]=v;
	}
	return k;
};

exports.getPersonById = function(auth,id,onDone) {
	if (!auth || auth.userGroup != 1) {
		exports.getPersonById(authd.admin,id,function(res) {
			if (res < 0 || !res.id || !auth || res.username != auth.username || res.password != auth.password) {
				var t={};
				for (var e in res) if (e != "username" && e != "password" && e != "userGroup" && e != "birthDate") {
					t[e]=res[e];
				}
				onDone(t);
			} else {
				onDone(res);
			}
		});
		return;
	}
	var res = cache.get(id);
	if (res) {
		onDone(res);
	}
	else
		getPersonByQuery(auth,"id=$1",[id],onDone);
};

exports.updatePerson = function(auth,person,onDone) {
	if (!auth || !person.id) {
		onDone(-1);
		return;
	}
	if (auth.userGroup != 1) {
		exports.getPersonById(authd.admin,person.id,function(res) {
			if (res < 0 || !res.id || !auth || res.username != auth.username || res.password != auth.password) 
				onDone(-1);
			else {
				exports.updatePerson(authd.admin,person,onDone);
			}
		});
		return;
	}
	var dbcon = driver.connect(function(err,pgclient,done) 
	{
		if (err) 
		{
			log.error("Error on connecting to postgresql  : "+err);
			if (done)
				done();
			onDone(-1);
			return;
		}
		if (person.imei) {
			pgclient.query("UPDATE tracking.persons SET imei = NULL WHERE imei = $1",[person.imei],function(err, result) {
				if (err)
					log.error("Unable to set IMEI to null : "+err);
				if (done)
					done();
				doWork();
			});
		} else {
			doWork();
		}
		function doWork() 
		{
			var sql = "UPDATE tracking.persons SET code=$2,first_name=$3,last_name=$4,nationality=$5,club=$6,gender=$7,username=$8,password=$9,user_group=$10,birth_date=$11,imei=$12,type=$13,description=$14,color=$15,email=$16,email_template=$17";
			var args = [person.id,person.code,person.firstName,person.lastName,person.nationality,person.club,person.gender,person.username,
			            person.password,person.userGroup,person.birthDate,person.imei,person.type,person.description,person.color,person.email,person.emailTemplate];
			if (person.image && person.image.indexOf("data:") == 0) {
				sql+=",image=$18"
				args.push(person.image);
			} else if (!person.image || !person.image.length) {
				sql+=",image=$18"
				args.push(null);
			}
			sql+=" WHERE id = $1 RETURNING *";
			pgclient.query(sql,
				args,
				function(err, result) {
				  	if (done)
				  		done();
				    if(err) {
				    	log.error('Error updating person in POSTGRE : ',err);
				    	onDone(-1);
				    	return;
				    }
				    if (result.rows && result.rows.length == 1) {
				    	person = result.rows[0];
					    if (person.code)
					    	deleteImage(person.code);
					    if (person.image) {
					    	person.has_image=person.image.length;
					    	delete person.image;
					    }
				    	parsePerson(auth,person,function(r) {
							if (r && r.id) {
								for (var k in updateHandlers) {
									var h = updateHandlers[k];
									h(r);
								}
								cache.set(r.id,r);
							}
							if (r.imei) 
								exports.removeMissingPerson(authd.admin,r.imei,function() { onDone(r); });
							else
								onDone(r);
						});
				    } else
				    	onDone(0);
			});
		}
	});	
};

exports.createPerson = function(auth,person,onDone) {
	/*if (!auth || auth.userGroup != 1) {
		log.error("Creating person from not admin auth "+JSON.stringify(auth)+"!");
		onDone(-1);
		return;
	}*/
	if (!person.username || !person.password) {
		log.error("Can not create user with empty username or empty password");
		onDone(-1);
		return;
	}
	if (person.id) {
		log.error("Can not create person with existing id. Try updatePerson instead!");
		onDone(-1);
		return;
	}
	
	if (!person.code)
		person.code="PERS"+(new Date()).getTime();
	if (!person.gender)
		person.gender="m";
	
	var dbcon = driver.connect(function(err,pgclient,done) 
	{
		if (err) 
		{
			log.error("Error on connecting to postgresql  : "+err);
			if (done)
				done();
			onDone(-1);
			return;
		}
		
		// TODO REDESIGN OR REMOVE!!!
		if (!person.imei)
			doIt();
		else {
			pgclient.query("UPDATE tracking.persons SET imei = NULL WHERE imei = $1",[person.imei],function(err, result) {
				if (err)
					log.error("Unable to set IMEI to null : "+err);
				if (done)
					done();
				doIt();
			});
		}
		// REAL WORK
		function doIt()  
		{
			var args=[person.code,person.firstName,person.lastName,person.nationality,person.club,person.gender,person.username,person.password,person.userGroup,person.birthDate,person.description,person.imei,person.color,person.email,person.emailTemplate];		
			var e1="";
			var e2="";
			if (person.image && person.image.indexOf("data:") == 0) {
				e1=",image"
				e2=",$"+(args.length+1);
				args.push(person.image);
			}
			var sql;
			pgclient.query(sql="INSERT INTO tracking.persons (code,first_name,last_name,nationality,club,gender,username,password,user_group,birth_date,description,imei,color,email,email_template,default_location_visibility"+e1+") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,true"+e2+") RETURNING *",
				args, 					 
				function(err, result) {
				if (done)
					done();
			    if(err) {
			    	log.error('Error inserting into person in POSTGRE : ',err,sql);
			    	console.log(person);
			    	onDone(-1);
			    	return;
			    }
			    if (result.rows && result.rows.length == 1)
			    	parsePerson(auth,result.rows[0],function(res) {
			    		if (res && res.id)
			    			cache.set(res.id,res);
			    		if (res && res.imei) 
			    			exports.removeMissingPerson(authd.admin,res.imei,function() { onDone(res); });
						else
							onDone(res);

			    	});
			    else
			    	onDone(0);
			});			
		}

	});	
};

exports.deletePerson = function(auth,person,onDone) {
	if (!auth || auth.userGroup != 1) {
		log.error("Deleting person from not admin auth "+JSON.stringify(auth)+"!");
		onDone(-1);
		return;
	}
	if (!person.id) {
		onDone(0);
		return;
	}
	var dbcon = driver.connect(function(err,pgclient,done) 
	{
		if (err) 
		{
			log.error("Error on connecting to postgresql  : "+err);
			if (done)
				done();
			onDone(-1);
			return;
		}
		pgclient.query("DELETE FROM tracking.persons WHERE id=$1 RETURNING code",
			[person.id], 					 
			function(err, result) {
			  if (done)
				  done();
			    if(err) {
			      log.error('Error deleting person in POSTGRE : ',err);
				  onDone(-1);
			      return;
			    }
			    if (result && result.rows && result.rows.length == 1)
			    	deleteImage(result.rows.code);			    
				onDone(0);
		  });
	});	
};

function getPersonByQuery(auth,where,args,onDone) 
{
	var sql = "SELECT *,(image is NOT NULL AND length(image) > 0) AS has_image FROM tracking.persons WHERE "+where;
	var dbcon = driver.connect(function(err,pgclient,done) 
	{
		if (err) 
		{
			log.error("Error on connecting to postgresql  : "+err);
			if (done)
				done();
			onDone(-1);
			return;
		}
		pgclient.query(sql,args, 					 
			function(err, result) {
			if (done)
				done();
			    if(err) {
			      log.warn("Query : "+sql);
			      log.error('Error selecting person by query in POSTGRE : ',err);
				  onDone(-1);
			      return;
			    }
				if (result && result.rows && result.rows.length == 1) {
					parsePerson(auth,result.rows[0],function(r) {
						if (r && r.id) {
				    		cache.set(r.id,r);
						}
						onDone(r);
					});
				} else {
					onDone({});
				}
		  });
	});
}

exports.listPersonIds = function(auth,onDone) 
{
	exports.listPersonIdsOrderBy(auth,{orderBy:"id"},function(res) {
		if (!res || res <= 0)
			return res;
		var arr=[];
		for (var e of res)
			arr.push(e.id)
		onDone(arr);
	});
};

exports.listPersonIdsOrderBy = function(auth,data,onDone) 
{
	//------------------------------------
	var orderBy="id";
	if (!data.isCount && data.orderBy) 
		orderBy=data.orderBy;
	//------------------------------------
	var oby="";
	var isLower=false;
	if (orderBy.endsWith("ToLower")) {
		orderBy=orderBy.substring(0,orderBy.length-7);
		isLower=true;
	}

	switch (orderBy) 
	{
		case "id" :
			oby="X.id";
			break;
		case "firstName": 
			oby=isLower ? "LOWER(X.first_name),X.id" : "X.first_name,X.id";
			break;
		case "lastName": 
			oby=isLower ? "LOWER(X.last_name),X.id" : "X.last_name,X.id";
			break;
		case "nationality": 
		case "gender": 
		case "code": 
		case "club": 
		case "description":
			oby=isLower ? "LOWER(X."+orderBy+"),X.id" : "X."+orderBy+",X.id";
			break;
		case "age":
			oby="X.birth_date,X.id";
			break;
		case "startGroup":
			oby="J.start_group,X.id";
			break;
		case "startPos":
			oby="J.start_pos,X.id";
			break;
		case "type,startPos":
			oby="(CASE WHEN X.type = 'PRO' THEN 0 WHEN X.type = 'VIP' THEN 1 ELSE 2 END),J.start_pos,X.id";
			break;
		case "lastName,firstName,club":
			oby="LOWER(X.last_name),LOWER(x.first_name),LOWER(x.club),X.id";
			break;
		case "-id" :
			oby="X.id DESC";
			break;
		case "-firstName": 
			oby=isLower ? "LOWER(X.first_name) DESC,X.id DESC" : "X.first_name DESC,X.id DESC";
			break;
		case "-lastName": 
			oby=isLower ? "LOWER(X.last_name) DESC,X.id DESC" : "X.last_name DESC,X.id DESC";
			break;
		case "-nationality": 
		case "-gender": 
		case "-code": 
		case "-club": 
		case "-description":
			orderBy=orderBy.substring(1);
			oby=isLower ? "LOWER(X."+orderBy+") DESC,X.id DESC" : "X."+orderBy+" DESC,X.id DESC";
			break;
		case "-age":
			oby="X.birth_date DESC,X.id DESC";
			break;
		case "-startGroup":
			oby="J.start_group DESC,X.id DESC";
			break;
		case "-startPos":
			oby="J.start_pos DESC,X.id DESC";
			break;
		default :
			onDone(-1);
			return;
	}
	var where = "";
	var limit = "";
	var join = "";
	var select = "";
	var filterOnlyIfVisible = false;
	if (data.where) 
	{
		if (!(data.where instanceof Array)) 
			data.where=[data.where];
		for (var w of data.where) 
		{
			switch (w) 
			{
				case "onlyVisible" :
					filterOnlyIfVisible=true;
					break;
				case "club" : 
					if (where.length)
						where="("+where+") AND ";
					where+="LOWER(X.club) like '%"+data.clubFilter.toLowerCase().split("'").join("")+"%'";
					break;
				case "name" : 
					if (where.length)
						where="("+where+") AND ";
					where+="LOWER(X.first_name) like '%"+data.nameFilter.toLowerCase().split("'").join("").split("%").join("\\\\%").split("_").join("\\\\_")+"%' OR "+
						  "LOWER(X.last_name) like '%"+data.nameFilter.toLowerCase().split("'").join("").split("%").join("\\\\%").split("_").join("\\\\_")+"%'";
					break;
				case "nationality" : 
					if (where.length)
						where="("+where+") AND ";
					where+="LOWER(X.nationality) like '%"+data.nationalityFilter.toLowerCase().split("'").join("").split("%").join("\\\\%").split("_").join("\\\\_")+"%'";
					break;
				case "contains" : 
					var flt = data.filter;
					if (!flt || flt.trim() == "") {
						// ? 
					} else {
						if (flt.indexOf("'") >= 0) {
							onDone(-1);
							return;
						}	
						if (where.length)
							where="("+where+") AND ";
						flt=flt.split("_").join("\\\\_").split("%").join("\\\\%").toLowerCase();					
						if (data.clubFilter && data.clubFilter.trim() != "" && data.clubFilter.indexOf("'") < 0) {
							var club=data.clubFilter.toLowerCase();
							where+="(LOWER(X.first_name) like '%"+flt+"%' OR LOWER(X.last_name) like '%"+flt+"%') AND LOWER(X.club) = '"+club+"'";
						} else {
							where+="LOWER(X.first_name) like '%"+flt+"%' OR LOWER(X.last_name) like '%"+flt+"%'";
						}
					}
					break;
				case "not_invited" :
					if (!auth || (typeof auth.id != "number") || (typeof data.event != "number")) {
						onDone(-1);
						return;
					}					
					if (where.length)
						where="("+where+") AND ";
					select+=",J.start_pos AS start_pos,J.start_group AS start_group ";
					join+=" LEFT JOIN tracking.event_participant AS J ON (X.id = J.participant AND J.event = "+data.event+") ";
					where+=" J.id IS NULL AND X.id <> "+auth.id;
					break;
				case "invited" : 
					if (!auth || (typeof auth.id != "number") || (typeof data.event != "number")) {
						onDone(-1);
						return;
					}
					select+=",J.joined AS joined,J.start_pos AS start_pos,J.start_group AS start_group,gender,club,first_name,last_name,nationality,birth_date,type ";
					join+=" JOIN tracking.event_participant AS J ON (X.id = J.participant AND J.event = "+data.event+") ";
					if (typeof data.joined == "boolean") {
						if (where.length)
							where="("+where+") AND ";
						where+="J.joined = "+data.joined;
					}
					break;
				case "shared_locations" :
					// ALL PERSONS CURRENT USER SHARED LOCATION WITH!
					if (!auth || (typeof auth.id != "number")) {
						onDone(-1);
						return;
					}
					// HERE HERE HERE FILTER
					if (auth.userGroup != 1) 
					{
						if (!auth || (typeof auth.id != "number")) {
							onDone(-1);
							return;
						} 
						join+=" LEFT JOIN tracking.location_sharing AS S ON S.person = X.id AND S.share_to = "+auth.id;
						if (where.length)
							where="("+where+") AND ";
						where+=" (S.id IS NOT NULL OR X.id = "+auth.id+") ";
					}
					break;
				case "share_location_with_persons" :
					// ALL PERSONS CURRENT USER SHARED LOCATION WITH!
					if (!auth || (typeof auth.id != "number")) {
						onDone(-1);
						return;
					} 
					// remove "current user"
					join+=" JOIN tracking.location_sharing AS S ON S.share_to = X.id AND S.person = "+auth.id+" AND X.id <> "+auth.id;	
					break;
				default : 
					onDone(-1);
					return;
			}
		}
		//where = "WHERE id="+auth.id;
	}
	
	if (where.length)
		where=" WHERE ("+where+")";
	var sql;
	var sAlias = "X.imei,X.code,X.image,X.nationality,X.color,(substring(COALESCE(X.first_name,'?') FROM 1 FOR 1) || substring(COALESCE(X.last_name ,'?') FROM 1 FOR 1))";
	if (data.isCount) 
	{
		sql = "SELECT COUNT(X.id) AS id FROM tracking.persons AS X "+join+" "+where;
	} else {
			switch (data.visibility) 
			{
				case "location" : 
					if (auth && auth.id && (auth.id+"").indexOf("'") < 0) 
					{
						if (filterOnlyIfVisible) 
						{
							if (!where.length)
								where=" WHERE COALESCE(NOT Z.is_hidden,P.default_location_visibility) ";
							else 
								where+=" AND COALESCE(NOT Z.is_hidden,P.default_location_visibility) "
						}
						sql = "SELECT X.id,COALESCE(NOT Z.is_hidden,P.default_location_visibility) AS visibility,"+sAlias+" AS alias FROM tracking.persons AS X LEFT JOIN tracking.location_hidden AS Z ON (Z.for_person = "+auth.id+" AND Z.person = X.id) LEFT JOIN tracking.persons AS P ON (P.id = "+auth.id+") "+join+" "+where+" ORDER BY "+oby;
					}
					break;
			}
		if (!sql)
			sql = "SELECT X.id,true AS visibility,"+sAlias+" AS alias "+select+" FROM tracking.persons AS X "+join+" "+where+" ORDER BY "+oby;
		if (data.limit) 
		{
			 sql+=" LIMIT "+data.limit;
			 if (data.page)
				 sql+=" OFFSET "+data.page*data.limit;
		}
	}
	// TODO REMOVE ME
	console.log("JOIN : "+join);
	console.log("WHERE : "+where);
	console.log("SQL : "+sql);
	var dbcon = driver.connect(function(err,pgclient,done) 
	{
		if (err) 
		{
			log.error("Error on connecting to postgresql  : "+err);
			if (done)
				done();
			onDone(-1);
			return;
		}
		pgclient.query(sql,[], 					 
			function(err, result) {
			    if(err) {
			      log.error('Error listing persons in POSTGRE : '+err);
				  if (done)
					  done();
				  onDone(-1);
			      return;
			    }
				if (done)
					done();
				var res=[];
				if (result && result.rows) 
				{
					function oner() 
					{
						var e = result.rows.shift();
						if (!e) {
							onDone(res);
						}
						else {
							if (e.birth_date) 
							{
								var ageDifMs = Date.now() - e.birth_date;
							    var ageDate = new Date(ageDifMs); 
							    e.age=Math.floor(Math.abs(ageDate.getUTCFullYear() - 1970));
							}
							res.push(e);
							if (e.image) 
							{
								parsePersonImage(e,function(res) {
									e.image=res.image;
									oner();
								});
							} else {
								oner();
							}
						}
					}
					oner();
				} else {
					onDone(res);
				}
		  });
	});
};


//------------------------------------
exports.listClubs = function(auth,data,onDone) 
{
	var where = "";
	var limit = "";
	if (data.where) 
	{
		switch (data.where) 
		{
			case "contains" : 
				var flt = data.filter;
				if (!flt || flt.trim() == "") {
					where = "WHERE LENGTH(X.club) > 0"; 
				} else {
					if (flt.indexOf("'") >= 0) {
						onDone(-1);
						return;
					}	
					flt=flt.split("_").join("\\\\_").split("%").join("\\\\%").toLowerCase();					
					where="WHERE LENGTH(X.club) > 0 AND LOWER(X.club) like '%"+flt+"%'";
				}
				break;
			default : 
				onDone(-1);
				return;
		}
	}
	var sql;
	if (data.isCount) 
	{
		sql = "SELECT COUNT(Y.club) AS id FROM (SELECT X.club AS club FROM tracking.persons AS X "+where+" GROUP BY X.club) AS Y";
	} else {
		sql = "SELECT X.club AS club FROM tracking.persons AS X "+where+" GROUP BY X.club ORDER BY LOWER(x.club)";
		if (data.limit) 
		{
			 sql+=" LIMIT "+data.limit;
			 if (data.page)
				 sql+=" OFFSET "+data.page*data.limit;
		}
	}
	var dbcon = driver.connect(function(err,pgclient,done) 
	{
		if (err) 
		{
			log.error("Error on connecting to postgresql  : "+err);
			if (done)
				done();
			onDone(-1);
			return;
		}
		pgclient.query(sql,[], 					 
			function(err, result) {
			    if(err) {
			      log.error('Error listing persons in POSTGRE : '+err);
				  if (done)
					  done();
				  onDone(-1);
			      return;
			    }
				if (done)
					done();
				var res=[];
				if (result && result.rows) 
				{
					for (var e of result.rows)
						res.push(e.club);
				} 
				onDone(res);
		  });
	});
};

//-------------------------------------------------------
function parsePersonImage(r,onDone)
{
	if (!isImageExisting(r.code)) 
	{
		// GENERATE IMAGE			
		var sql = "SELECT image from tracking.persons WHERE id=$1";
		var dbcon = driver.connect(function(err,pgclient,done) 
		{
			if (err) 
			{
				log.error("Error on connecting to postgresql  : "+err);
				if (done)
					done();
				onDone(r);
				return;
			}
			pgclient.query(sql,[r.id], 					 
				function(err, result) {
				  if (done)
					  done();
				    if(err) {
				      log.error('Error getting image data by person id in POSTGRE : '+err);
					  onDone(r);
				      return;
				    }
					if (result && result.rows && result.rows.length == 1 && result.rows[0].image) 
					{
						saveImage(r.code,result.rows[0].image);	// SYNC
						r.image="/personImages/"+r.code+".png?t="+getImageTimestamp(r.code);
					} 
					onDone(r);
			  });
		});
		return;
	} else {
		r.image="/personImages/"+r.code+".png?t="+getImageTimestamp(r.code);
		onDone(r);
	}
}

exports.parsePerson=parsePerson;
function parsePerson(auth,r,onDone) 
{
	var res={imei:r.imei,code : r.code,id : r.id,firstName : r.first_name, lastName : r.last_name, nationality : r.nationality, club : r.club, gender : r.gender, username : r.username,password : r.password ,userGroup : r.user_group,imei:r.imei,description:r.description,email:r.email,emailTemplate:r.email_template,type:r.type,color:r.color };
	// be sure updates are saved in personsByImei
	var rr = {id:r.id,type:r.type,firstName:r.first_name,lastName:r.last_name,color:r.color,nationality:r.nationality};
	if (personsByImei && r.imei) 
		personsByImei[r.imei]=rr;
	if (personsById && r.id) 
		personsById[r.id]=rr;	
	if (r.birth_date) 
	{
		res.birthDate = new Date(r.birth_date);
		var ageDifMs = Date.now() - r.birth_date;
	    var ageDate = new Date(ageDifMs); 
	    res.age=Math.floor(Math.abs(ageDate.getUTCFullYear() - 1970));
	}
	//--------------------------------------------------
	if (r.has_image && r.code) 
	{
		parsePersonImage(r,function(img) {
			res.image=img.image;
			onDone(res);
		});
	}
	else 
		onDone(res);
}
//-------------------------------------------------------
var tmpDir = inst.installDir+"/tmp/person/";
mkdirp.sync(tmpDir);

function isImageExisting(code) {
	return fs.existsSync(tmpDir+"/"+code+".png");
}
function getImageTimestamp(code) {
	var m = fs.statSync(tmpDir+"/"+code+".png").mtime;
	if (!m || !m.getTime)
		return m;
	return m.getTime();
}

function deleteImage(code) {
	if (fs.existsSync(tmpDir+"/"+code+".png"))
		fs.unlinkSync(tmpDir+"/"+code+".png");
}

function saveImage(code,data) {
	var base64Data = data.replace(/^data:image\/png;base64,/, "");
	fs.writeFileSync(tmpDir+"/"+code+".png", base64Data, 'base64');
	return tmpDir+"/"+code+".png";
}

//----------------------------------------------------------------
// RAW API (integers)
//----------------------------------------------------------------
exports.setLocationVisibility = function(auth,data,onDone) {
	if (!auth || (typeof auth.id != "number")) {
		log.error("Creating set location visibility without authorization "+JSON.stringify(auth)+"!");
		onDone(-1);
		return;
	}
	if (!data) {
		onDone(-1);
		return;
	}
	dlocation.clearAll(auth,null,function() {
		var dbcon = driver.connect(function(err,pgclient,done) 
		{
			if (err) 
			{
				log.error("Error on connecting to postgresql  : "+err);
				if (done)
					done();
				onDone(-1);
				return;
			}
			if (!data.person) 
			{
				// ALL ALL ALL
				var where="";
				var join="";
				if (data.where) for (var w of data.where) 
				{
					switch (w) 
					{
						case "club" : 
							if (where.length)
								where="("+where+") AND ";
							where+="LOWER(X.club) like '%"+data.clubFilter.toLowerCase().split("'").join("")+"%'";
							break;
						case "name" : 
							if (where.length)
								where="("+where+") AND ";
							where+="LOWER(X.first_name) like '%"+data.nameFilter.toLowerCase().split("'").join("").split("%").join("\\\\%").split("_").join("\\\\_")+"%' OR "+
								  "LOWER(X.last_name) like '%"+data.nameFilter.toLowerCase().split("'").join("").split("%").join("\\\\%").split("_").join("\\\\_")+"%'";
							break;
						case "nationality" : 
							if (where.length)
								where="("+where+") AND ";
							where+="LOWER(X.nationality) like '%"+data.nationalityFilter.toLowerCase().split("'").join("").split("%").join("\\\\%").split("_").join("\\\\_")+"%'";
							break;
						default : 
							onDone(-1);
							return;
					}
				}
				//where = "WHERE id="+auth.id;
				if (where.length) {
					// NOT possible to change current defaults because of filter
					// for every record set visibility if different from default
					var sql = "SELECT X.id FROM tracking.persons AS X LEFT JOIN tracking.location_hidden AS Z ON (Z.for_person = $2 AND Z.person = X.id) LEFT JOIN tracking.persons AS P ON (P.id = $2) WHERE $1 <> COALESCE(NOT Z.is_hidden,P.default_location_visibility) AND "+where;
					pgclient.query(sql,[data.visibility,auth.id],function(err,result) {
						if (done)
							done();
						if (err) {
							log.error("Error quering persons for set location visibility : "+err);
							onDone(-1);
							return;
						}
						if (!result || !result.rows.length)
							onDone(0);
						else {
							function oneRes() {
								var r = result.rows.shift();
								if (!r) 
									onDone(0);
								else
									exports.setLocationVisibility(auth,{person : r.id,visibility:data.visibility},oneRes);
							}
							oneRes();
						}
					});
				}
				else // NO FILTER !!
				pgclient.query("UPDATE tracking.location_hidden SET is_hidden = $2 WHERE for_person = $1",
					[auth.id,!data.visibility], 					 
					function(err, result) {
					if (done)
						done();
				    if(err) 
				    {
				    	log.error('Error updaing tracking.location_hidden in POSTGRE : ',err);
				    	onDone(-1);
				    	return;
				    }
					pgclient.query("UPDATE tracking.persons SET default_location_visibility = $2 WHERE id = $1",
							[auth.id,data.visibility], 					 
							function(err, result) {
							if (done)
								done();
						    if(err) {
						    	log.error('Error updating person default_location_visibility in POSTGRE : ',err);
						    	onDone(-1);
						    	return;
						    }
						    onDone(0);
					});
			    });
				return;
			}
			var sql;
			pgclient.query("SELECT person FROM tracking.location_hidden WHERE for_person = $1 AND person = $2",
				[auth.id,data.person], 					 
				function(err, result) {
				if (done)
					done();
			    if(err) {
			    	log.error('Error selecting from location_hidden in POSTGRE : ',err);
			    	onDone(-1);
			    	return;
			    }
			    if (result.rows && result.rows.length == 1) {
					pgclient.query("UPDATE tracking.location_hidden SET is_hidden = $3 WHERE for_person = $1 AND person = $2",
						[auth.id,data.person,!data.visibility], 					 
						function(err, result) {
						if (done)
							done();
					    if(err) {
					    	log.error('Error removing location_hidden record in POSTGRE : ',err);
					    	onDone(-1);
					    	return;
					    }
					    onDone(0);
				    });
			    } else {
					pgclient.query("INSERT INTO tracking.location_hidden(for_person,person,is_hidden) VALUES($1,$2,$3)",
						[auth.id,data.person,!data.visibility], 					 
						function(err, result) {
						if (done)
							done();
					    if(err) {
					    	log.error('Error inserting into location_hidden in POSTGRE : ',err);
					    	onDone(-1);
					    	return;
					    }
					    onDone(0);
				    });
			    }
			});
		});	
	});
};

//doRemove -> DELETE 
exports.shareLocation = function(auth,share,onDone) {
	if (!auth || (typeof auth.id != "number")) {
		log.error("Creating share location without authorization "+JSON.stringify(auth)+"!");
		onDone(-1);
		return;
	}

	if (!share.share_to) {
		log.error("Can not share location with empty share_to!");
		onDone(-1);
		return;
	}
	
	var dbcon = driver.connect(function(err,pgclient,done) 
	{
		if (err) 
		{
			log.error("Error on connecting to postgresql  : "+err);
			if (done)
				done();
			onDone(-1);
			return;
		}
		if (share.doRemove) {
			pgclient.query("DELETE FROM tracking.location_sharing WHERE person = $1 AND share_to = $2",
				[auth.id,share.share_to], 					 
				function(err, result) {
				if (done)
					done();
			    if(err) 
			    {
			    	log.error('Error deleting from location_sharing in POSTGRE : ',err);
			    	onDone(-1);
			    	return;
			    }
			    onDone(0);
			});
			return;
		}
		//---------------------------------------------------------------------------------------	
		pgclient.query("SELECT person FROM tracking.location_sharing WHERE person = $1 AND share_to = $2",
			[auth.id,share.share_to], 					 
			function(err, result) {
			if (done)
				done();
		    if(err) {
		    	log.error('Error selecting location_sharing in POSTGRE : ',err);
		    	onDone(-1);
		    	return;
		    }
		    if (result.rows && result.rows.length == 1)
		    	onDone(1);
		    else {
				pgclient.query("INSERT INTO tracking.location_sharing (person,share_to) VALUES($1,$2)",
						[auth.id,share.share_to], 					 
						function(err, result) {
						if (done)
							done();
					    if(err) {
					    	log.error('Error inserting into location_sharing in POSTGRE : ',err);
					    	onDone(-1);
					    	return;
					    }
					    onDone(0);
				    });
		    }
		});
	});	
};

exports.getInvitations = function(auth,onDone) 
{
	if (typeof auth.id != "number") {
		onDone(-1);
		return;
	}
	var dbcon = driver.connect(function(err,pgclient,done) 
	{
		if (err) 
		{
			log.error("Error on connecting to postgresql  : "+err);
			if (done)
				done();
			onDone(-1);
			return;
		}
		var sql = "SELECT X.event,X.invitation,X.start_pos,X.start_group,E.owner,COUNT(Y.id) AS total_invited,COUNT(Z.id) AS total_joined FROM tracking.event_participant AS X JOIN tracking.events AS E ON (E.id = X.event) LEFT JOIN tracking.event_participant AS Y ON (Y.event = X.event) LEFT JOIN tracking.event_participant AS Z ON (Z.event = X.event AND Y.joined) WHERE NOT X.joined AND X.participant = $1 GROUP BY X.event,X.invitation,X.start_pos,E.owner,X.start_group";
		pgclient.query(sql,
			[auth.id], 					 
			function(err, result) {
			if (done)
				done();
		    if(err) 
		    {
		    	log.error('Error getting invitations in POSTGRE : ',err);
		    	onDone(-1);
		    	return;
		    }
		    if (!result || !result.rows)
		    	onDone([]);
		    else 
		    	onDone(result.rows);
		});
	});
};

exports.acceptInvitation = function(auth,data,onDone) 
{
	if (typeof data.event != "number" || typeof auth.id != "number") {
		onDone(-1);
		return;
	}
	if (!data) {
		onDone(-1);
		return;
	}
	var dbcon = driver.connect(function(err,pgclient,done) 
	{
		if (err) 
		{
			log.error("Error on connecting to postgresql  : "+err);
			if (done)
				done();
			onDone(-1);
			return;
		}
		pgclient.query("UPDATE tracking.event_participant SET joined = true WHERE event = $1 AND participant = $2",
			[data.event,auth.id], 					 
			function(err, result) {
			if (done)
				done();
		    if(err) 
		    {
		    	log.error('Error updating event_participant in POSTGRE : ',err);
		    	onDone(-1);
		    	return;
		    }
		    onDone(0);
		});
	});
};	

exports.removeMissingPerson = function(auth,imei,onDone) {
	if (!auth || auth.userGroup != 1) {
		onDone(-1);
		return;
	}
	var dbcon = driver.connect(function(err,pgclient,done) 
	{
		if (err) 
		{
			log.error("Error on connecting to postgresql  : "+err);
			if (done)
				done();
			onDone(-1);
			return;
		}
		pgclient.query("DELETE FROM tracking.missing_person WHERE imei=$1",
			[imei], 					 
			function(err, result) {
			if (done)
				done();
		    if(err) 
		    {
		    	log.error('Error deleting from event_participant in POSTGRE : ',err);
		    	onDone(-1);
		    	return;
		    }
		    onDone(0);
		});
	});
};

exports.listMissingPersons = function(auth,onDone) 
{
	if (!auth || auth.userGroup != 1) {
		onDone(-1);
		return;
	}
	var dbcon = driver.connect(function(err,pgclient,done) 
	{
		if (err) 
		{
			log.error("Error on connecting to postgresql  : "+err);
			if (done)
				done();
			onDone(-1);
			return;
		}
		pgclient.query("SELECT * FROM tracking.missing_person ORDER BY last_t DESC",
			[], 					 
			function(err, result) {
			if (done)
				done();
		    if(err) 
		    {
		    	log.error('Error deleting from event_participant in POSTGRE : ',err);
		    	onDone(-1);
		    	return;
		    }
		    if (result && result.rows)
		    	onDone(result.rows);
		    else
		    	onDone([]);
		});
	});
};	

//------------------------------------------------
exports.getPersonPath = function(auth,data,onDone) 
{
	if (!auth || !auth.id)
		return onDone(-1);
	
	var defVisSelect = "(SELECT default_location_visibility FROM tracking.persons where id = $1)";
	var where=" WHERE (NOT TZ.is_hidden OR (TZ.is_hidden IS NULL AND "+defVisSelect+"))";
	if (auth.userGroup != 1) 
		where+=" AND (TX.id = $1 OR TS.id IS NOT NULL) ";
	var join=" LEFT JOIN tracking.location_hidden AS TZ ON (TZ.for_person = $1 AND TZ.person = TX.id) "; 
	join+=" LEFT JOIN tracking.location_sharing AS TS on TS.person = TX.id AND TS.share_to = $1 ";
	var psql = "SELECT TX.id FROM tracking.persons AS TX "+join+" "+where;
	var sql= "WITH P AS ("+psql+")\n" 
	sql+="SELECT RV.grp,ENCODE(ST_AsTWKB(ST_SIMPLIFY(ST_MAKELINE(RV.pos),$5))),'base64') AS path FROM tracking.position AS RV JOIN P ON P.id = $2 WHERE RV.person = $2 AND RV.t >= $3 AND RV.t <= $4 GROUP BY RV.grp ORDER BY RV.grp";
	var args=[auth.id,data.person,data.beginTime,data.endTime,data.tolerance];
	function lsql() 
	{
		var s=sql;
		for (var i=0;i<args.length;i++) {
			var val = args[i];
			var k="$"+(i+1);
			s=s.split(k).join(val);
		}
	}
	var dbcon = driver.connect(function(err,pgclient,done) 
	{
		if (err) 
		{
			log.error("Error on connecting to postgresql  : "+err);
			if (done)
				done();
			onDone();
			return;
		}
		pgclient.query(sql,
			args, 					 
			function(err, result) {
			if (done)
				done();
		    if(err) 
		    {
		    	log.error('Error loading person path in POSTGRE : ',err);
		    	lsql();
		    	onDone();
		    	return;
		    }
		    if (result && result.rows)
		    	onDone(result.rows);
		    else
		    	onDone([]);
		});
	});
};
//------------------------------------------------
var personsByImei; 
var personsById; 
exports.basicLoadPersons=function(onDone) 
{
	var dbcon = driver.connect(function(err,pgclient,done) 
	{
		if (err) 
		{
			log.error("Error on connecting to postgresql  : "+err);
			if (done)
				done();
			onDone();
			return;
		}
		var sql = "SELECT id,first_name,last_name,nationality,color,imei FROM tracking.persons";
		pgclient.query(sql,
			[], 					 
			function(err, result) {
			if (done)
				done();
		    if(err) 
		    {
		    	log.error('Error loading pesons by imei in POSTGRE : ',err);
		    	personsByImei={};
		    	personsById={};
		    	onDone();
		    	return;
		    }
	    	personsByImei={};
	    	personsById={};
		    if (result && result.rows)
		    {
		    	for (var i=0;i<result.rows.length;i++) {
		    		var r = result.rows[i];
		    		personsById[r.id]={firstName:r.first_name,lastName:r.last_name,color:r.color,nationality:r.nationality,id:r.id};
		    		if (r.imei)
		    			personsByImei[r.imei]=personsById[r.id];
		    	}
		    }
			onDone();
		});
	});
};
exports.getPersonBasicByImei = function(imei) {
	return personsByImei[imei];
};
exports.getPersonBasicById = function(id) {
	var k = personsById[id];
	return k;
};
