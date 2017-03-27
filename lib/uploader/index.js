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

const { log } = require('../shared/logger');

const readFile = Promise.promisify(fs.readFile);

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
  return readFile(filename)
    .then(data => ({ data }))
    .then(({ data }) =>
      fetch(url, {
        method: 'PUT',
        headers: {
          'content-type': 'video/mp4',
          'content-length': data.length,
        },
        body: data,
      }).then(() => ({ id })));
};

const upload = (row) => {
  log('upload', row);
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
    .then(({ id }) => {
      log('file uploaded', id);
      return db.changeStatus({
        status: db.status.UPLOADED,
        condition: `WHERE id=${id}`,
      });
    });
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
      db.status.READY_FOR_UPLOAD,
      db.status.FAILED_TO_UPLOAD,
    ] })
    .then((rows) =>
      rows.forEach(upload));

const run = ({ id, recordingsPath }) =>
  new Promise((resolve) => {
    log(id, recordingsPath);
    fs.ensureDir(recordingsPath, (error) => {
      if (!error) {
        const watcher = chokidar.watch(recordingsPath, {
          ignored: /[\\]\./,
          persistent: true,
        });
        watcher
          .on('add', (path) => {
            createItem({ id, path })
              .then(() => uploadItems(id));
          })
          .on('ready', () => {
            log('Uploader ready');
            resolve('ok');
          });
      }
    });
  });

const init = () => {
  uploadOrphans();
};

module.exports = {
  init,
  run,
};
