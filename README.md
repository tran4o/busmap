# BusMap


## prerequisites

* posgresql 9.5+
* postgis 2.3+ 
* node 6.x+

## building

```bash
npm build
```

## installing (devel) 

```bash
npm link	# or  sudo npm link
```

## BIN

	js/cmd/bm.js <command> 	// general cli interface

### available commands :

1) ```js/cmd/bm.js db create```
2) ```js/cmd/bm.js db drop```
3) ```js/cmd/bm.js cleanup```	 (clears db (json) cache (location/data)

# Running the instance 

_(used 3 differend tmux sessions)_

Start collecting mqtt data and store it in the db:
1) gps
 
To be removed watchifier for building browserified js 
2) build

the http server 
3) http

# Overnight maintainance

add this to cron:

```cron
1 0 * * * cd ~/busmap; /usr/bin/node js/cmd/clone.js 
```
and set ~/busmap to respective location of this service

# Project structure

* js/bin/** 			bin and cli scripts
* js/srv/**			server components. IMPORTANT IS http.js > all transfer happens here
* js/api/busmap.js	- RMI api for middleware and clients (NODEJS / WEB)


# Root of admin interface 
_(will be moved?) packed?_

/www/admin/home/script 				-> downloaded binaries, patched sometimes (TODO ?!) 			
/www/admin/home/pos.js 				-> basic widget for displaying pos / play event widget
 
