# BusMap

1) building

npm build

2) installing (devel) 
npm link			/ sudo npm link

3) BIN

	lr <command> 	// general cli interface

available commands :

1) lr db create
2) lr db drop

3) lr cleanup	 (clears db (json) cache (location/data)


Running the instance 
-------------------
(used 3 differend tmux sessions)

Start collecting mqtt data and store it in the db
1) gps			
 
To be removed watchifier for building browserified js 
2) build

the http server 
3) http



Basic JS structure
------------------
js/bin/** 			bin and cli scripts
js/srv/**			server components. IMPORTANT IS http.js > all transfer happens here

js/api/busmap.js	- RMI api for middleware and clients (NODEJS / WEB)


Root of admin interface (will be moved?) packed?
---------------------------------------------
/www/admin/home/script 				-> downloaded binaries, patched sometimes (TODO ?!) 			
/www/admin/home/pos.js 				-> basic widget for displaying pos / play event widget
 