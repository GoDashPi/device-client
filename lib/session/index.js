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
const _ = require('lodash');

const ensureDir = Promise.promisify(fs.ensureDir);

const createDirectories = (id) =>
  Promise.all(_.map(config.directories, (directory, key) =>
    ensureDir(path.join(directory, id))
      .then((createdDirectory) => ({ key, createdDirectory, directory }))))
    .then(directories =>
      directories.reduce((result, { key, directory }) => {
        const sessionDirectory = {};
        sessionDirectory[key] = path.join(directory, id);
        Object.assign(result, sessionDirectory);
        return result;
      }, {}));

const create = () => {
  const id = uuidV4();
  return db.insertSession({ id })
    .then(() => createDirectories(id))
    .then((directories) => ({
      session: id,
      directories,
    }));
};

module.exports = {
  create,
};
