#!/usr/bin/env bash
sqlite3 dashpi.db 'SELECT * from sessions'
sqlite3 dashpi.db 'SELECT * from files'
sqlite3 dashpi.db 'SELECT * from sensordata'
