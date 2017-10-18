'use strict';

const session = require('./lib/session');
const camera = require('./lib/camera');

const gps = require('./lib/gps');
const uploader = require('./lib/uploader');

const { log } = require('./lib/shared/logger');

// set environment

process.env.DASHPI_ENV = process.env.DASHPI_ENV || 'device';

log(`STARTING DASH PI [${process.env.DASHPI_ENV}]`);
log(`API_KEY [${process.env.API_KEY}]`);

if (process.env.UPLOAD_ONLY) {
  log('UPLOAD AND CLEANUP ONLY');
  uploader.upload().then(log);
}

if (!process.env.UPLOAD_ONLY) {
  session.create()
    .then((item) => {
      log(item);
      const gpsStream = gps.run(item);
      const cameraStream = camera.run(item);
      return uploader.run({
        cameraStream,
        gpsStream,
      });
    });
}
