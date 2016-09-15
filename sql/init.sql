CREATE SCHEMA tracking;
CREATE TABLE tracking.events (id serial primary key);
ALTER TABLE tracking.events
    	ADD COLUMN code VARCHAR(100) NOT NULL,
    	ADD COLUMN name VARCHAR(100),

        ADD COLUMN bike_start DOUBLE PRECISION DEFAULT 0,
        ADD COLUMN run_start DOUBLE PRECISION DEFAULT 0,

        ADD COLUMN start_elapsed DOUBLE PRECISION,
        ADD COLUMN start_lon DOUBLE PRECISION,
        ADD COLUMN start_lat DOUBLE PRECISION,

        ADD COLUMN bike_start_elapsed DOUBLE PRECISION,			--NEW
        ADD COLUMN run_start_elapsed DOUBLE PRECISION,			--NEW
		ADD COLUMN track_length DOUBLE PRECISION,				--NEW
	
        ADD COLUMN swim_count INTEGER DEFAULT 1,
        ADD COLUMN bike_count INTEGER DEFAULT 1,
        ADD COLUMN run_count INTEGER DEFAULT 1,
        
     	ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false, 
        ADD COLUMN begin_time BIGINT,				-- SKIP TIMEZONE COMPLICATIONS, EASY TO PORT TO SQLITE
        ADD COLUMN end_time BIGINT,
		ADD COLUMN pois JSON,
		ADD COLUMN track TEXT;
    	
CREATE UNIQUE INDEX code_idx_events ON tracking.events (code);

CREATE TABLE tracking.persons (id serial primary key);
ALTER TABLE tracking.persons
    	ADD COLUMN code VARCHAR(100) NOT NULL,
    	ADD COLUMN imei VARCHAR(20),
    	ADD COLUMN first_name VARCHAR(100),
    	ADD COLUMN last_name VARCHAR(100),
    	ADD COLUMN nationality VARCHAR(10),							-- COUNTRY CODE
    	ADD COLUMN club VARCHAR(100),
    	ADD COLUMN username VARCHAR(100),
    	ADD COLUMN password VARCHAR(100),
    	ADD COLUMN user_group BIGINT, 								-- HARDCODED : 1 : ADMIN
    	ADD COLUMN type VARCHAR(10),								-- CODE 
    	ADD COLUMN description VARCHAR(4000),						-- DESCRIPTION
    	ADD COLUMN email VARCHAR(4000),
    	ADD COLUMN email_template TEXT,						
    	ADD COLUMN birth_date BIGINT,									
    	ADD COLUMN image TEXT,										-- Base64 encoded image
    	ADD COLUMN color VARCHAR(40),								-- CSS style vaue
    	ADD COLUMN default_location_visibility BOOLEAN NOT NULL DEFAULT false, -- NOT direct visible in the api
    	ADD COLUMN gender CHAR(1) NOT NULL DEFAULT 'm';

CREATE UNIQUE INDEX imei_idx_persons ON tracking.persons (imei);
CREATE UNIQUE INDEX code_idx_persons ON tracking.persons (code);
CREATE UNIQUE INDEX username_idx_persons ON tracking.persons (username);

ALTER TABLE tracking.events
        ADD COLUMN owner BIGINT REFERENCES tracking.persons ON DELETE CASCADE;
    	
CREATE TABLE tracking.location_sharing (id serial primary key);
ALTER TABLE tracking.location_sharing 
        ADD COLUMN person BIGINT NOT NULL REFERENCES tracking.persons ON DELETE CASCADE,
        ADD COLUMN share_to BIGINT NOT NULL REFERENCES tracking.persons ON DELETE CASCADE;
ALTER TABLE tracking.location_sharing ADD CONSTRAINT location_sharing_unique UNIQUE (share_to,person);

CREATE TABLE tracking.location_hidden (id serial primary key);
ALTER TABLE tracking.location_hidden
        ADD COLUMN for_person BIGINT NOT NULL REFERENCES tracking.persons ON DELETE CASCADE,
        ADD COLUMN person BIGINT NOT NULL REFERENCES tracking.persons ON DELETE CASCADE,
        ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tracking.location_hidden ADD CONSTRAINT location_hidden_unique UNIQUE (for_person, person);
CREATE UNIQUE INDEX location_hidden_unique_2 ON tracking.location_hidden (for_person, is_hidden, person);

CREATE TABLE tracking.event_participant_hidden (id serial primary key);
ALTER TABLE tracking.event_participant_hidden
        ADD COLUMN event BIGINT NOT NULL REFERENCES tracking.events ON DELETE CASCADE,
        ADD COLUMN for_person BIGINT NOT NULL REFERENCES tracking.persons ON DELETE CASCADE,
        ADD COLUMN person BIGINT NOT NULL REFERENCES tracking.persons ON DELETE CASCADE,
        ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tracking.event_participant_hidden ADD CONSTRAINT event_participant_hidden_unique UNIQUE (event,for_person,person);
CREATE UNIQUE INDEX event_participant_hidden_unique_2 ON tracking.event_participant_hidden(event,for_person,is_hidden,person);

--------------------------------
-- NEW INTERPOLATED POSITION 
------------------------------

CREATE TABLE tracking.event_participant (id serial primary key);
ALTER TABLE tracking.event_participant
        ADD COLUMN event BIGINT NOT NULL REFERENCES tracking.events ON DELETE CASCADE,
        ADD COLUMN participant BIGINT NOT NULL REFERENCES tracking.persons ON DELETE CASCADE,
        ADD COLUMN start_pos BIGINT NOT NULL DEFAULT 1,
        ADD COLUMN start_group VARCHAR(60),
        ADD COLUMN start_time BIGINT,
        ADD COLUMN end_time BIGINT,
        ADD COLUMN invitation VARCHAR(4000),
        ADD COLUMN json JSON,
        ADD COLUMN joined BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tracking.event_participant ADD CONSTRAINT event_participant_unique UNIQUE (event,participant);
CREATE INDEX event_participant_event_person ON tracking.event_participant (participant,event);
CREATE INDEX event_participant_event ON tracking.event_participant (event);
CREATE UNIQUE INDEX event_participant_unique_2 ON tracking.event_participant(joined,event,participant);


CREATE TABLE tracking.event_favorite (id serial primary key);
ALTER TABLE tracking.event_favorite
        ADD COLUMN event BIGINT NOT NULL REFERENCES tracking.events ON DELETE CASCADE,
        ADD COLUMN person BIGINT NOT NULL REFERENCES tracking.persons ON DELETE CASCADE,
        ADD COLUMN favorite BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tracking.event_favorite ADD CONSTRAINT event_person_unique_fav UNIQUE (event,person);



CREATE TABLE tracking.position (id serial primary key);
ALTER TABLE tracking.position
        ADD COLUMN t INT8 NOT NULL,
        ADD COLUMN geom_t GEOMETRY(Point),
		ADD COLUMN person BIGINT NOT NULL REFERENCES tracking.persons ON DELETE CASCADE,
        ADD COLUMN event BIGINT REFERENCES tracking.events ON DELETE CASCADE,
        ADD COLUMN lon DOUBLE PRECISION,
        ADD COLUMN lat DOUBLE PRECISION,
		ADD COLUMN pos GEOMETRY(POINT),
        ADD COLUMN packet_type INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN location_sensor char(1),
        ADD COLUMN sats BIGINT NOT NULL DEFAULT 0,
        ADD COLUMN hdop DOUBLE PRECISION NOT NULL DEFAULT 0,
        ADD COLUMN direction DOUBLE PRECISION,
        ADD COLUMN speed_in_kmh DOUBLE PRECISION NOT NULL DEFAULT 0,
        ADD COLUMN speed_in_kmh_average DOUBLE PRECISION NOT NULL DEFAULT 0,
        ADD COLUMN alt DOUBLE PRECISION NOT NULL DEFAULT 0,
        ADD COLUMN gps_valid BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN gsm_signal DOUBLE PRECISION NOT NULL DEFAULT 0,
        ADD COLUMN ecall_active BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN batt_volt DOUBLE PRECISION  NOT NULL DEFAULT 0,
        ADD COLUMN batt_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
        ADD COLUMN charger_active BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN is_race BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN uptime_system DOUBLE PRECISION,
        ADD COLUMN number_of_steps INTEGER NOT NULL,
        ADD COLUMN puls_rate DOUBLE PRECISION,
        ADD COLUMN temperature DOUBLE PRECISION,
		ADD COLUMN transmission_intervall_rate DOUBLE PRECISION,      
        ADD COLUMN grp BIGINT NOT NULL DEFAULT 0;

CREATE INDEX person_idx ON tracking.position (person);

CREATE INDEX t_idx ON tracking.position (t);
CREATE UNIQUE INDEX t_person_idx ON tracking.position (person,t);
CREATE INDEX tracking_spatial_tracked_pos_t ON tracking.position USING GIST (geom_t,pos);
DELETE FROM pg_statistic WHERE starelid IN (SELECT oid FROM pg_class WHERE relname ='position') AND staattnum IN (SELECT attnum FROM pg_attribute WHERE attrelid IN (SELECT oid FROM pg_class WHERE relname ='position') AND attname IN ('geom_t'));
DELETE FROM pg_statistic WHERE starelid IN (SELECT oid FROM pg_class WHERE relname ='position') AND staattnum IN (SELECT attnum FROM pg_attribute WHERE attrelid IN (SELECT oid FROM pg_class WHERE relname ='position') AND attname IN ('pos'));
ALTER TABLE tracking.position ALTER COLUMN pos SET STATISTICS 0;
ALTER TABLE tracking.position ALTER COLUMN geom_t SET STATISTICS 0;

CREATE TABLE tracking.discrete_position (id serial primary key);
ALTER TABLE tracking.discrete_position
        ADD COLUMN chunk BIGINT NOT NULL,								-- KEY
        ADD COLUMN level INTEGER NOT NULL,								-- KEY 
        ADD COLUMN event BIGINT REFERENCES tracking.events ON DELETE CASCADE,	-- NOT NULL IF ONE ONLY
		ADD COLUMN person BIGINT NOT NULL REFERENCES tracking.persons ON DELETE CASCADE,   -- NOT NULL IF ONE ONLY
		ADD COLUMN data JSON;											-- MAP index is number min 0 max blockSize-1
CREATE UNIQUE INDEX chunk_person_level_idx ON tracking.discrete_position (chunk,person,level);


CREATE TABLE tracking.discrete_location (id serial primary key);
ALTER TABLE tracking.discrete_location
        ADD COLUMN page BIGINT NOT NULL,								-- KEY
        ADD COLUMN x INTEGER NOT NULL,									-- KEY 
        ADD COLUMN y INTEGER NOT NULL,									-- KEY 
        ADD COLUMN level BIGINT NOT NULL,									-- KEY
		ADD COLUMN person BIGINT NOT NULL REFERENCES tracking.persons ON DELETE CASCADE,   
		ADD COLUMN data JSON;			
										
CREATE UNIQUE INDEX x_y_page_person_level_idx ON tracking.discrete_location (person,page,level,x,y);
CREATE INDEX discrete_location_idx_2 ON tracking.discrete_location (person);
CREATE INDEX discrete_location_idx_3 ON tracking.discrete_location (person,page);


CREATE TABLE tracking.discrete_event (id serial primary key);
ALTER TABLE tracking.discrete_event
        ADD COLUMN page BIGINT NOT NULL,								
        ADD COLUMN x INTEGER NOT NULL,									 
        ADD COLUMN y INTEGER NOT NULL,									 
        ADD COLUMN level BIGINT NOT NULL,													
		ADD COLUMN person BIGINT NOT NULL REFERENCES tracking.persons ON DELETE CASCADE,    
		ADD COLUMN event BIGINT NOT NULL REFERENCES tracking.events ON DELETE CASCADE,     
		ADD COLUMN data JSON;			
										
CREATE UNIQUE INDEX discrete_event_idx_1 ON tracking.discrete_event (person,event,page,level,x,y);
CREATE INDEX discrete_event_idx_2 ON tracking.discrete_event (person,event);
CREATE INDEX discrete_event_idx_3 ON tracking.discrete_event (person,page,event);
CREATE INDEX discrete_event_idx_4 ON tracking.discrete_event (event);

CREATE TABLE tracking.missing_person (id serial primary key);
ALTER TABLE tracking.missing_person
        ADD COLUMN imei VARCHAR(20) NOT NULL,							-- KEY
        ADD COLUMN last_t BIGINT NOT NULL,							-- KEY
		ADD COLUMN lon DOUBLE PRECISION,
        ADD COLUMN lat DOUBLE PRECISION;
     	
CREATE UNIQUE INDEX imei ON tracking.missing_person(imei);        




CREATE TABLE tracking.event_elapsed (id serial primary key);
ALTER TABLE tracking.event_elapsed
        ADD COLUMN geom_event GEOMETRY(Point) NOT NULL,
		ADD COLUMN pos GEOMETRY(POINT) NOT NULL,
        ADD COLUMN elapsed DOUBLE PRECISION NOT NULL;
        
CREATE INDEX tracking_spatial_tevent_elapsed_pos_event ON tracking.event_elapsed USING GIST (geom_event,pos);
DELETE FROM pg_statistic WHERE starelid IN (SELECT oid FROM pg_class WHERE relname ='event_elapsed') AND staattnum IN (SELECT attnum FROM pg_attribute WHERE attrelid IN (SELECT oid FROM pg_class WHERE relname ='event_elapsed') AND attname IN ('geom_event'));
DELETE FROM pg_statistic WHERE starelid IN (SELECT oid FROM pg_class WHERE relname ='event_elapsed') AND staattnum IN (SELECT attnum FROM pg_attribute WHERE attrelid IN (SELECT oid FROM pg_class WHERE relname ='event_elapsed') AND attname IN ('pos'));
ALTER TABLE tracking.event_elapsed ALTER COLUMN pos SET STATISTICS 0;
ALTER TABLE tracking.event_elapsed ALTER COLUMN geom_event SET STATISTICS 0;

CREATE TABLE tracking.position_soft (id serial primary key);
ALTER TABLE tracking.position_soft
        ADD COLUMN i INT8 NOT NULL,
        ADD COLUMN geom_i GEOMETRY(Point),
		ADD COLUMN person BIGINT NOT NULL REFERENCES tracking.persons ON DELETE CASCADE,
        ADD COLUMN event BIGINT REFERENCES tracking.events ON DELETE CASCADE,
        ADD COLUMN elapsed DOUBLE PRECISION,
        ADD COLUMN alt DOUBLE PRECISION DEFAULT 0,
		ADD COLUMN pos GEOMETRY(POINT),
		ADD COLUMN tpos GEOMETRY(POINT),
        ADD COLUMN hdop DOUBLE PRECISION NOT NULL DEFAULT 0,
        ADD COLUMN avail DOUBLE PRECISION NOT NULL DEFAULT 0,				
        ADD COLUMN speed_in_kmh DOUBLE PRECISION NOT NULL DEFAULT 0,
        ADD COLUMN speed_in_kmh_average DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE INDEX s_person_idx ON tracking.position_soft (person);
CREATE INDEX s_tracking_person_event_i_elapsed ON tracking.position_soft (event,person,i,elapsed);
CREATE INDEX s_i_idx ON tracking.position_soft (i);
CREATE UNIQUE INDEX s_i_person_idx ON tracking.position_soft (person,i);
CREATE INDEX s_tracking_spatial_tracked_pos_i ON tracking.position_soft USING GIST (geom_i,pos);
CREATE INDEX s_tracking_spatial_tracked_tpos_i ON tracking.position_soft USING GIST (geom_i,tpos);

DELETE FROM pg_statistic WHERE starelid IN (SELECT oid FROM pg_class WHERE relname ='position_soft') AND staattnum IN (SELECT attnum FROM pg_attribute WHERE attrelid IN (SELECT oid FROM pg_class WHERE relname ='position_soft') AND attname IN ('geom_i'));
DELETE FROM pg_statistic WHERE starelid IN (SELECT oid FROM pg_class WHERE relname ='position_soft') AND staattnum IN (SELECT attnum FROM pg_attribute WHERE attrelid IN (SELECT oid FROM pg_class WHERE relname ='position_soft') AND attname IN ('pos'));
DELETE FROM pg_statistic WHERE starelid IN (SELECT oid FROM pg_class WHERE relname ='position_soft') AND staattnum IN (SELECT attnum FROM pg_attribute WHERE attrelid IN (SELECT oid FROM pg_class WHERE relname ='position_soft') AND attname IN ('tpos'));
ALTER TABLE tracking.position_soft ALTER COLUMN pos SET STATISTICS 0;
ALTER TABLE tracking.position_soft ALTER COLUMN tpos SET STATISTICS 0;
ALTER TABLE tracking.position_soft ALTER COLUMN geom_i SET STATISTICS 0;

-------------------------------------------------------------------------------
-- Initial admin account
-------------------------------------------------------------------------------

INSERT INTO tracking.persons (code,first_name,last_name,nationality,club,gender,username,password,user_group) VALUES('admin','Dev','Root','GER','Administrators','m','admin','admin',1);
