'use strict';

/**
 * Session module
 */

const db = require('../database');
const path = require('path');
const uuidV4 = require('uuid/v4');

const create = () => {
  const id = uuidV4();
  const recordingsPath = path.join('recordings', id);

  return db.insertSession({ id, recordingsPath }).then(() => ({
    id,
    recordingsPath,
  }));
};

module.exports = {
  create,
};
