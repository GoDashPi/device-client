'use strict';

const serialport = require('serialport');
const GPS = require('gps');
const Rx = require('rxjs/Rx');
const _ = require('lodash');
const { log } = require('../shared/logger');

const gps = new GPS();
const options = {
  baudrate: 9600,
  parser: serialport.parsers.readline('\n'),
  autoOpen: false,
};

const port = new serialport.SerialPort('/dev/ttyS0', options);
// const gpsData = Rx.Observable.fromEvent(gps, 'data');

port.on('data', data => gps.update(data));

const run = (session) =>
  Rx.Observable.create((observer) => {
    log('run gps', session);
    port.open();
    let state = {};
    gps.on('data', () => {
      if (typeof gps.state === 'object' && !_.isEqual(gps.state, state) && state.lastFix) {
        state = _.clone(gps.state);
        observer.next(gps.state);
      }
    });
  });

module.exports = {
  run,
};
