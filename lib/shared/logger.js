'use strict';

const log4js = require('log4js');

const level = 'DEBUG';

if (process.env.DASHPI_ENV === 'device') {
  // level = 'ERROR';
  log4js.configure('./logger.json');
}

const logger = log4js.getLogger();
logger.setLevel(level);

const log = (...data) => {
  logger.debug(data);
};

const logError = (...data) => {
  logger.error(data);
};

module.exports = {
  log,
  logError,
};
