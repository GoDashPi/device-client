'use strict';

/**
 * Session module
 */

const db = require('../database');
const path = require('path');
const uuidV4 = require('uuid/v4');
const config = require('../../config.json');
const fs = require('fs-extra');
const Promise = require('bluebird');

const ensureDir = Promise.promisify(fs.ensureDir);

const create = () => {
  const id = uuidV4();
  const recordingPath = path.join(config.recordingsDirectory, id);

  return db.insertSession({ id })
    .then(() => ensureDir(recordingPath))
    .then(() => ({
      id,
      recordingPath,
    }));
};

module.exports = {
  create,
};
