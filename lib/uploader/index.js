'use strict';

/**
 * Uploader module
 * Listens file changes and uploads
 * chunks into S3 bucket
 */

const chokidar = require('chokidar');
const db = require('../database');
const fs = require('fs-extra');
const fetch = require('node-fetch');
const Promise = require('bluebird');
const path = require('path');
const config = require('../../config.json');
const { fileStatus } = require('../shared/constants');
const moment = require('moment');

const { checkConnection } = require('../shared/connection');

const { log, logError } = require('../shared/logger');

const readFile = Promise.promisify(fs.readFile);
const removeFile = Promise.promisify(fs.remove);
const readDir = Promise.promisify(fs.readdir);
const stat = Promise.promisify(fs.stat);

const updateSessionRecordingStart = (statusItem) =>
  db.getSessionById(statusItem.id)
    .then((session) => {
      if (session.record_start === null) {
        return db.updateSession(
          { recordingStart: statusItem.created },
          `WHERE session="${statusItem.id}"`)
          .then(() => statusItem);
      }
      return statusItem;
    });

const getCreatedTime = chunkPath =>
  stat(chunkPath)
    .then((stats) => {
      log('created', chunkPath, stats.birthtime);
      // note mac doesn't support ms in create time
      return moment(stats.birthtime).utc().format('YYYY-MM-DD HH:mm:ss.SSS');
    });

const getFileType = (filePath) => {
  switch (path(filePath).extname) {
    case '.json':
      return 'application/json';
    default:
      return 'video/mp4';
  }
};

const createItem = (item) =>
  getCreatedTime(item.path)
    .then((created) => {
      const type = getFileType(item.path);
      const statusItem =
        Object.assign({ status: fileStatus.RECORDING, created, type }, item);
      return db.insertIntoFiles(statusItem)
        .then(() => statusItem);
    })
    .then(updateSessionRecordingStart)
    .then((statusItem) => {
      db.changeStatus({
        status: fileStatus.READY_FOR_UPLOAD,
        condition: `WHERE NOT path="${statusItem.path}"
          AND (session="${statusItem.id}" AND status=${fileStatus.RECORDING})`,
      });
    });

const removeFileByPath = (filePath) =>
  removeFile(filePath)
    .then(() => db.changeStatus({
      status: fileStatus.DELETED,
      condition: `WHERE path="${filePath}"`,
    }))
    .catch(logError);

const uploadFile = ({ url, id, filename }) => {
  log(url, filename);
  return checkConnection()
    .then(() =>
      readFile(filename)
        .then(data => ({ data }))
        .then(({ data }) =>
          fetch(url, {
            method: 'PUT',
            headers: {
              'content-type': 'video/mp4',
              'content-length': data.length,
            },
            body: data,
          })
            .then(() => {
              log('file uploaded', id);
              return db.changeStatus({
                status: fileStatus.UPLOADED,
                condition: `WHERE id=${id}`,
              });
            })
            .then(() =>
              removeFileByPath(filename))
            .then(() =>
              ({ id }))
        ));
};

const upload = (row) => {
  log('upload', row);
  if (!fs.existsSync(row.path)) {
    logError('file not exists', row.path);
    return db.changeStatus({
      status: fileStatus.FILE_NOT_EXISTS,
      condition: `WHERE id=${row.id}`,
    });
  }

  return checkConnection()
    .then(() =>
      db.changeStatus({
        status: fileStatus.UPLOADING,

        condition: `WHERE id=${row.id}`,
      })
        .then(() => {
          if (row.created === 'undefined') {
            return getCreatedTime(row.path)
              .then((created) =>
                db.updateFiles({ created }, `WHERE id=${row.id}`));
          }
          return null;
        })
        .then(() => db.getSessionById(row.session))
        .then((session) => {
          if (row.created === 'undefined') {
            return Promise.reject('File creation time not defined.');
          }
          const time = moment(row.created) - moment(session.record_start);
          const payload = {
            key: row.path.replace(`${config.recordingsDirectory}/`, ''),
            session: row.session,
            timestamp: row.created,
            time,
          };
          const params = { method: 'POST', body: JSON.stringify(payload) };
          return fetch(`${process.env.DASHPI_API}/register-chunk`, params)
            .then(response => response.json())
            .then(({ url }) => ({ url, id: row.id, filename: row.path }));
        })
        .then(uploadFile)
        .catch((error) => {
          logError('file upload failed', error);
          return db.changeStatus({
            status: fileStatus.FAILED_TO_UPLOAD,
            condition: `WHERE path="${error.path}"`,
          });
        }))
    .catch(() => db.changeStatus({
      status: fileStatus.READY_FOR_UPLOAD,
      condition: `WHERE id=${row.id}`,
    }));
};

const uploadItems = (session) => {
  db.getFilesByStatus({
    session,
    statuses: [
      fileStatus.READY_FOR_UPLOAD,
      fileStatus.FAILED_TO_UPLOAD,
    ],
  }).then((rows) =>
    rows.forEach(upload));
};

const uploadOrphans = () =>
  db.getFilesByStatus({
    statuses: [
      fileStatus.RECORDING,
      fileStatus.UPLOADING,
      fileStatus.READY_FOR_UPLOAD,
      fileStatus.FAILED_TO_UPLOAD,
    ] })
    .then((rows) =>
      Promise.all(rows.map(upload)));

const getOrphanFiles = () =>
  readDir(config.recordingsDirectory)
    .then((sessionDirs) => {
      const sessionDirPromises =
        sessionDirs.reduce((result, sessionDir) => {
          const uuidRegEx =
            /[a-f0-9]{8}-?[a-f0-9]{4}-?4[a-f0-9]{3}-?[89ab][a-f0-9]{3}-?[a-f0-9]{12}/g;
          if (sessionDir.match(uuidRegEx)) {
            const orphans =
              readDir(path.join(config.recordingsDirectory, sessionDir))
                .then(files => ({ id: sessionDir, files }));
            result.push(orphans);
          }
          return result;
        }, []);
      return Promise
        .all(sessionDirPromises)
        .then((orphans) => {
          const orphansInsert =
            orphans.map(({ id, files }) =>
              files.map(file =>
                db.insertIntoFiles({
                  id,
                  path: path.join(config.recordingsDirectory, id, file),
                  status: fileStatus.READY_FOR_UPLOAD,
                })));
          return Promise
            .all(orphansInsert);
        });
    });

const cleanup = () =>
  db.getFilesByStatus({
    statuses: [
      fileStatus.UPLOADED,
    ] })
    .then((rows) => {
      const removePromises =
        rows.map(row => removeFileByPath(row.path));
      return Promise.all(removePromises)
        .catch(logError);
    })
    .then(() =>
      readDir(config.recordingsDirectory)
        .then((files) =>
          files.reduce((result, file) => {
            const filePath = path.join(config.recordingsDirectory, file);
            if (fs.statSync(filePath).isDirectory()) {
              if (fs.readdirSync(filePath).length === 0) {
                result.push(filePath);
              }
            }
            return result;
          }, []))
        .then((directories) => {
          const removePromises =
            directories.map(p => removeFileByPath(p));
          return Promise.all(removePromises)
            .catch(logError);
        }))
    .catch(logError);

const run = ({ id, recordingPath }) =>
  new Promise((resolve) => {
    fs.ensureDir(recordingPath, (error) => {
      if (!error) {
        const watcher = chokidar.watch(recordingPath, {
          ignored: /[\\]\./,
          persistent: true,
        });
        watcher
          .on('add', (p) => {
            createItem({ id, path: p })
              .then(() => uploadItems(id));
          })
          .on('ready', () => {
            log('Uploader ready');
            resolve('ok');
          });
      }
    });
  });

const init = () =>
  getOrphanFiles()
    .then(uploadOrphans)
    .then(cleanup)
    .catch(cleanup);

module.exports = {
  init,
  run,
};
