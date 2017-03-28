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

const recordingsPath = 'recordings';

const { checkConnection } = require('../shared/connection');

const { log, logError } = require('../shared/logger');

const readFile = Promise.promisify(fs.readFile);
const removeFile = Promise.promisify(fs.remove);
const readdir = Promise.promisify(fs.readdir);

const createItem = (item) => {
  const statusItem = Object.assign({ status: db.status.RECORDING }, item);
  return db.insertItem(statusItem).then(() => {
    db.changeStatus({
      status: db.status.READY_FOR_UPLOAD,
      condition: `WHERE NOT path="${statusItem.path}"
        AND (session="${statusItem.id}" AND status=${db.status.RECORDING})`,
    });
  });
};

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
            .then(() =>
              removeFile(filename)
                .catch(logError))
            .then(() => ({ id }))
        ));
};

const upload = (row) => {
  log('upload', row);
  if (!fs.existsSync(row.path)) {
    logError('file not exists', row.path);
    return db.changeStatus({
      status: db.status.FILE_NOT_EXISTS,
      condition: `WHERE id=${row.id}`,
    });
  }

  return checkConnection()
    .then(() =>
      db.changeStatus({
        status: db.status.UPLOADING,
        condition: `WHERE id=${row.id}`,
      }).then(() => {
        const key = encodeURIComponent(row.path.replace('recordings/', ''));
        log('get url for ', key);
        return fetch(`${process.env.DASHPI_API}/upload-url/${key}`)
          .then(response => response.json())
          .then(({ url }) => ({ url, id: row.id, filename: row.path }));
      }).then(uploadFile)
        .then(({ id, error }) => {
          log('file uploaded', id, error);
          return db.changeStatus({
            status: db.status.UPLOADED,
            condition: `WHERE id=${id}`,
          });
        })
        .catch((error) => {
          logError('file upload failed', error);
          return db.changeStatus({
            status: db.status.FAILED_TO_UPLOAD,
            condition: `WHERE path="${error.path}"`,
          });
        }))
    .catch(() => db.changeStatus({
      status: db.status.READY_FOR_UPLOAD,
      condition: `WHERE id=${row.id}`,
    }));
};

const uploadItems = (session) => {
  const { status } = db;
  db.getFilesByStatus({
    session,
    statuses: [
      status.READY_FOR_UPLOAD,
      status.FAILED_TO_UPLOAD,
    ],
  }).then((rows) =>
    rows.forEach(upload));
};

const uploadOrphans = () =>
  db.getFilesByStatus({
    statuses: [
      db.status.RECORDING,
      db.status.UPLOADING,
      db.status.READY_FOR_UPLOAD,
      db.status.FAILED_TO_UPLOAD,
    ] })
    .then((rows) =>
      Promise.all(rows.map(upload)));

const getF = () =>
  readdir(recordingsPath)
    .then((sessionDirs) => {
      const sessionDirPromises =
        sessionDirs.reduce((result, sessionDir) => {
          const uuidRegEx =
            /[a-f0-9]{8}-?[a-f0-9]{4}-?4[a-f0-9]{3}-?[89ab][a-f0-9]{3}-?[a-f0-9]{12}/g;
          if (sessionDir.match(uuidRegEx)) {
            const orphans =
              readdir(path.join(recordingsPath, sessionDir))
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
                db.insertItem({
                  id,
                  path: path.join(recordingsPath, id, file),
                  status: db.status.READY_FOR_UPLOAD,
                })));
          return Promise
            .all(orphansInsert);
        });
    });

const cleanup = () =>
  db.getFilesByStatus({
    statuses: [
      db.status.UPLOADED,
    ] })
    .then((rows) => {
      const removePromises =
        rows.map(row =>
          removeFile(row.path)
            .catch(logError));
      return Promise.all(removePromises)
        .catch(logError);
    })
    .then(() => {
      return readdir(recordingsPath)
        .then((files) =>
          files.reduce((result, file) => {
            const filePath = path.join(recordingsPath, file);
            if (fs.statSync(filePath).isDirectory()) {
              if (fs.readdirSync(filePath).length === 0) {
                result.push(filePath);
              }
            }
            return result;
          }, []))
        .then((directories) => {
          const removePromises =
            directories.map(p =>
              removeFile(p)
                .catch(logError));
          return Promise.all(removePromises)
            .catch(logError);
        });
    })
    .catch(logError);

const run = ({ id, recordingsPath }) =>
  new Promise((resolve) => {
    fs.ensureDir(recordingsPath, (error) => {
      if (!error) {
        const watcher = chokidar.watch(recordingsPath, {
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
  getF()
    .then(uploadOrphans)
    .then(cleanup)
    .catch(cleanup);

module.exports = {
  init,
  run,
};
