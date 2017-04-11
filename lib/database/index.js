'use strict';

/**
 * Database module
 */

const sqlite3 = require('sqlite3').verbose();
const { logError } = require('../shared/logger');

const db = new sqlite3.Database('dashpi.db');

const insertItem = ({ id, path, status, created }) => new Promise((resolve, reject) => {
  db.run(`INSERT INTO files (session, path, status, created) 
           VALUES ('${id}', '${path}', '${status}', '${created}')`,
    (error) => {
      if (error) {
        logError(error);
        return reject(error);
      }
      return resolve('ok');
    });
});

const updateItem = (params, condition) => new Promise((resolve, reject) => {
  const updates = Object.keys(params).map((key) => `${key}='${params[key]}'`);
  const sql = `UPDATE files SET ${updates.join(', ')} ${condition}`;
  db.run(sql,
    (error) => {
      if (error) {
        logError(error);
        return reject(error);
      }
      return resolve('ok');
    });
});

const insertItemIfPathNotExists = ({ id, path, status }) => new Promise((resolve, reject) => {
  const query =
    `INSERT INTO files (session, path, status)    
      VALUES ('${id}', '${path}', '${status}')
        ON DUPLICATE KEY UPDATE path=path;`;

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

const getSessionById = (session) => new Promise((resolve, reject) => {
  const query = `SELECT * FROM sessions WHERE session="${session}"`;
  db.get(query, (error, data) => {
    if (error) {
      logError(error);
      return reject(error);
    }
    return resolve(data);
  });
});

const updateSession = ({ recordingStart }, condition) => new Promise((resolve, reject) => {
  // make more generic
  db.run(`UPDATE sessions SET record_start="${recordingStart}" ${condition}`, (error) => {
    if (error) {
      logError(error);
      return reject(error);
    }
    return resolve('ok');
  });
});

module.exports = {
  insertSession,
  insertItem,
  updateItem,
  changeStatus,
  getFilesByStatus,
  getSessions,
  getSessionById,
  updateSession,
  getRowByFile,
  insertItemIfPathNotExists,
};
