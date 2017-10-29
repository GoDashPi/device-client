'use strict';

const serialport = require('serialport');
const GPS = require('gps');
const Rx = require('rxjs/Rx');
const _ = require('lodash');
const { log, logError } = require('../shared/logger');
const { createItem } = require('../shared/sensor-utils');
const moment = require('moment');

const gps = new GPS();
const options = {
  baudrate: 9600,
  parser: serialport.parsers.readline('\n'),
  autoOpen: false,
};

let enabled = false;

const port = new serialport.SerialPort('/dev/ttyS0', options);
// const gpsData = Rx.Observable.fromEvent(gps, 'data');

port.on('data', data => gps.update(data));

const run = ({ id, session }) =>
  Rx.Observable.create((observer) => {
    enabled = true;
    log('Run gps', id, session, port);
    try {
      port.open();
    } catch (exception) {
      log(exception);
    }
    let state = {};
    gps.on('data', () => {
      if (typeof gps.state === 'object' && !_.isEqual(gps.state, state)) { // && state.lastFix
        state = _.clone(gps.state);
        if (enabled) {
          createItem({
            sessionId: id,
            data: state,
            type: 'gps',
            fileCreatedAt: moment(state.lastFix).utc().format('YYYY-MM-DD HH:mm:ss.SSS'),
          })
            .then((savedState) =>
              observer.next(savedState))
            .catch(logError);
        }
      }
    });
  });

const stop = () => {
  enabled = false;
};

module.exports = {
  run,
  stop,
};
