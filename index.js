'use strict';

const session = require('./lib/session');
const camera = require('./lib/camera');
const uploader = require('./lib/uploader');

const { log } = require('./lib/shared/logger');

// set environment

process.env.DASHPI_ENV = process.argv[2] || 'device';

log(`STARTING DASH PI [${process.env.DASHPI_ENV}]`);

uploader.init();

session.create()
  .then((item) => {
    log(item);
    return uploader.run(item)
     .then(() => camera.run(item));
  });
