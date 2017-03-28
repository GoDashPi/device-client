'use strict';

/**
 * Database module
 */

const sqlite3 = require('sqlite3').verbose();
const { logError } = require('../shared/logger');

const db = new sqlite3.Database('dashpi.db');

const insertItem = ({ id, path, status }) => new Promise((resolve, reject) => {
  db.run(`INSERT INTO files (session, path, status) VALUES ('${id}', '${path}', '${status}')`,
    (error) => {
      if (error) {
        logError(error);
        return reject(error);
      }
      return resolve('ok');
    });
});

const insertItemIfPathNotExists = ({ id, path, status }) =>  new Promise((resolve, reject) => {
  const query =
    `INSERT INTO files (session, path, status) VALUES ('${id}', '${path}', '${status}') ON DUPLICATE KEY UPDATE path=path;`;

  db.run(query, (error) => {
    if (error) {
      logError(error);
      return reject(error);
    }
    return resolve('ok');
  });
});

const insertSession = ({ id }) => new Promise((resolve, reject) => {
  db.run(`INSERT INTO sessions (session) VALUES ('${id}')`, (error) => {
    if (error) {
      logError(error);
      return reject(error);
    }
    return resolve('ok');
  });
});

const changeStatus = ({ status, condition }) => new Promise((resolve, reject) => {
  db.run(`UPDATE files SET status=${status} ${condition}`, (error) => {
    if (error) {
      logError(error);
      return reject(error);
    }
    return resolve('ok');
  });
});

const getFilesByStatus = ({ session, statuses }) => new Promise((resolve, reject) => {
  const statusConditions = statuses.map(status => `status=${status}`);
  const sessionCondition = session ? `session="${session}" AND` : '';
  const query = `SELECT * FROM files WHERE ${sessionCondition} (${statusConditions.join(' OR ')})`;
  db.all(query, (error, data) => {
    if (error) {
      logError(error);
      return reject(error);
    }
    return resolve(data);
  });
});

const getRowByFile = ({ path }) => new Promise((resolve, reject) => {
  const query = `SELECT * FROM files WHERE path="${path}"`;
  db.get(query, (error, data) => {
    if (error) {
      logError(error);
      return reject(error);
    }
    return resolve(data);
  });
});

const getSessions = () => new Promise((resolve, reject) => {
  const query = 'SELECT * FROM sessions';
  db.all(query, (error, data) => {
    if (error) {
      logError(error);
      return reject(error);
    }
    return resolve(data);
  });
});

module.exports = {
  insertSession,
  insertItem,
  changeStatus,
  getFilesByStatus,
  getSessions,
  getRowByFile,
  insertItemIfPathNotExists,
  status: {
    RECORDING: 0,
    READY_FOR_UPLOAD: 1,
    UPLOADING: 2,
    UPLOADED: 3,
    FAILED_TO_UPLOAD: 10,
    FILE_NOT_EXISTS: 11,
  },
};
