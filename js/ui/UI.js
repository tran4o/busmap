module.exports = {
	Config : require("./Config"),
	Gui : require("./Gui"),
	Participant : require("./Participant"),
	Point : require("./Point"),
	Styles : require("./Styles"),
	Track : require("./Track"),
	Utils : require("./Utils"),
	parseColor : require("parse-color")
};
if (typeof window != "undefined") {
	window.UI=module.exports;
}
