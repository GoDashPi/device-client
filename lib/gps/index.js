'use strict';

const serialport = require('serialport');
const GPS = require('gps');
const _ = require('lodash');
const fs = require('fs-extra');
const path = require('path');
const { log } = require('../shared/logger');

const gps = new GPS();
const options = {
  baudrate: 9600,
  parser: serialport.parsers.readline('\n'),
  autoOpen: false,
};

const run = ({ recordingPath }) => {
  const port = new serialport.SerialPort('/dev/ttyS0', options);
  port.on('data', data => gps.update(data));

  let state = {};
  gps.on('data', () => {
    if (typeof gps.state === 'object' && !_.isEqual(gps.state, state)) {
      state = _.clone(gps.state);
      const filename = path.join(recordingPath, `${state.lastFix}.gps.json`);
      log(state);
      fs.writeJson(filename, state, log);
    }
  });
};

module.exports = {
  run,
};
