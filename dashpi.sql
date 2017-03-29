--
-- File generated with SQLiteStudio v3.1.1 on Wed Mar 29 13:07:48 2017
--
-- Text encoding used: UTF-8
--
PRAGMA foreign_keys = off;
BEGIN TRANSACTION;

-- Table: files
DROP TABLE IF EXISTS files;

CREATE TABLE files (
    id      INTEGER       PRIMARY KEY AUTOINCREMENT
                          NOT NULL,
    session VARCHAR (64)  NOT NULL
                          REFERENCES sessions (session),
    path    VARCHAR (128) NOT NULL
                          UNIQUE ON CONFLICT ROLLBACK,
    status  INTEGER       NOT NULL,
    created DATETIME      NOT NULL
                          DEFAULT (CURRENT_TIMESTAMP) 
);


-- Table: sessions
DROP TABLE IF EXISTS sessions;

CREATE TABLE sessions (
    id      INTEGER      PRIMARY KEY AUTOINCREMENT
                         UNIQUE
                         NOT NULL,
    session VARCHAR (64) NOT NULL,
    created DATETIME     CONSTRAINT [CURRENT_TIMESTAMP] DEFAULT (CURRENT_TIMESTAMP) 
                         NOT NULL
);


COMMIT TRANSACTION;
PRAGMA foreign_keys = on;
