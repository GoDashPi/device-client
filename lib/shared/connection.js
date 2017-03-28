'use strict';

const dns = require('dns');
const url = require('url');
const { log } = require('./logger');

const checkConnection = () =>
  new Promise((resolve, reject) => {
    const domain = url.parse(process.env.DASHPI_API).host;
    dns.lookup(domain, (error) => {
      if (error && error.code === 'ENOTFOUND') {
        log('connection error', error);
        return reject(error);
      }

      return resolve('connection ok');
    });
  });

module.exports = {
  checkConnection,
};
