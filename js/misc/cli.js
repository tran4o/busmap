//----------------------------
var args = [];
var options = {};
var t = process.argv.slice(2);
exports.originalArgv = process.argv.slice(); 
while (t.length) 
{
	var e = t.shift();
	if (e.startsWith("-")) 
	{
		switch (e.substring(1)) 
		{

		}
	} else {
		args.push(e);
	}
}
exports.options=options;
exports.args=args;
//----------------------------
