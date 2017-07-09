--
-- File generated with SQLiteStudio v3.1.1 on Sun Jul 9 18:44:17 2017
--
-- Text encoding used: UTF-8
--
PRAGMA foreign_keys = off;
BEGIN TRANSACTION;

-- Table: files
DROP TABLE IF EXISTS files;

CREATE TABLE files (
    id       INTEGER       PRIMARY KEY AUTOINCREMENT
                           NOT NULL
                           UNIQUE,
    session  VARCHAR (64)  NOT NULL
                           REFERENCES sessions (session),
    filename VARCHAR (64)  NOT NULL,
    type     VARCHAR (16)  NOT NULL,
    path     VARCHAR (128) NOT NULL
                           UNIQUE ON CONFLICT IGNORE,
    status   INTEGER       NOT NULL,
    created  DATETIME      NOT NULL
);


-- Table: sensordata
DROP TABLE IF EXISTS sensordata;

CREATE TABLE sensordata (
    id      INTEGER      PRIMARY KEY AUTOINCREMENT
                         UNIQUE
                         NOT NULL,
    session VARCHAR (64) REFERENCES sessions (session) 
                         NOT NULL,
    data    TEXT         NOT NULL,
    type    VARCHAR (16) NOT NULL,
    status  INTEGER      NOT NULL,
    created DATETIME     NOT NULL
);


-- Table: sessions
DROP TABLE IF EXISTS sessions;

CREATE TABLE sessions (
    id           INTEGER      PRIMARY KEY AUTOINCREMENT
                              UNIQUE
                              NOT NULL,
    session      VARCHAR (64) NOT NULL,
    created      DATETIME     CONSTRAINT [CURRENT_TIMESTAMP] DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW') ) 
                              NOT NULL,
    record_start DATETIME
);


COMMIT TRANSACTION;
PRAGMA foreign_keys = on;
