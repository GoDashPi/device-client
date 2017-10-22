'use strict';

const session = require('./lib/session');
const camera = require('./lib/camera');

const gps = require('./lib/gps');
const uploader = require('./lib/uploader');

const controller = require('./lib/controller');

const { log } = require('./lib/shared/logger');
const { fileStatus } = require('./lib/shared/constants');

// set environment

process.env.DASHPI_ENV = process.env.DASHPI_ENV || 'device';

log(`STARTING DASH PI [${process.env.DASHPI_ENV}]`);
log(`API_KEY [${process.env.API_KEY}]`);

const start = () =>
  session.create()
    .then((item) => {
      log('session', item);
      return uploader.run({
        cameraStream: camera.run(item),
        gpsStream: gps.run(item),
      });
    });

const upload = () =>
  uploader.upload()
    .then((status) => log('uploaded', status));

controller.run().subscribe(cmd => {
  log('exec', cmd);
  switch (cmd) {
    case 'start': {
      start();
      break;
    }
    case 'stop': {
      camera.stop();
      gps.stop();
      setTimeout(() => upload([
        fileStatus.RECORDING,
        fileStatus.READY_FOR_UPLOAD,
        fileStatus.FAILED_TO_UPLOAD,
      ]),
      500);
      break;
    }
    case 'upload': {
      upload();
      break;
    }
    default: {
      log('invalid control', cmd);
      break;
    }
  }
});
