'use strict';

/**
 * Session module
 */

const db = require('../database');
const path = require('path');
const uuidV4 = require('uuid/v4');
const config = require('../../config.json');

const create = () => {
  const id = uuidV4();
  const recordingPath = path.join(config.recordingsDirectory, id);

  return db.insertSession({ id }).then(() => ({
    id,
    recordingPath,
  }));
};

module.exports = {
  create,
};
