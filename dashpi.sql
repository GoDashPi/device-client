--
-- File generated with SQLiteStudio v3.1.1 on Tue Apr 11 09:06:08 2017
--
-- Text encoding used: UTF-8
--
PRAGMA foreign_keys = off;
BEGIN TRANSACTION;

-- Table: files
DROP TABLE IF EXISTS files;

CREATE TABLE files (
    id      INTEGER       PRIMARY KEY AUTOINCREMENT
                          NOT NULL
                          UNIQUE,
    session VARCHAR (64)  NOT NULL
                          REFERENCES sessions (session),
    path    VARCHAR (128) NOT NULL,
    status  INTEGER       NOT NULL,
    created DATETIME      NOT NULL
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
