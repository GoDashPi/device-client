'use strict';

const serialport = require('serialport');
const GPS = require('gps');
const _ = require('lodash');
const fs = require('fs-extra');
const path = require('path');
const Promise = require('bluebird');
const { log, logError } = require('../shared/logger');

const writeJson = Promise.promisify(fs.writeJson);

const run = ({ recordingPath }) => {
  log('RUN GPS');
  const gps = new GPS();
  const options = {
    baudrate: 9600,
    parser: serialport.parsers.readline('\n'),
    autoOpen: true,
  };

  const port = new serialport.SerialPort('/dev/ttyS0', options);
  port.on('data', data => gps.update(data));

  let state = {};
  const fileContent = []; // @todo save to db then create file from that data
  gps.on('data', () => {
    if (typeof gps.state === 'object' && !_.isEqual(gps.state, state)) {
      state = _.clone(gps.state);
      if (state.lastFix) {
        fileContent.push(state);
        if (fileContent.length > 10) {
          const fileContentToSave = _.clone(fileContent);
          const filename = path.join(recordingPath, `${state.lastFix}.gps.json`);
          writeJson(filename, fileContentToSave)
            .then(data => log(data))
            .catch(error => logError(error));
          fileContent.splice(0, fileContent.length);
        }
      }
    }
  });
};

module.exports = {
  run,
};
