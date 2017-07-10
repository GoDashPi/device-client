'use strict';

/**
 * Uploader module
 * Listens file changes and uploads
 * chunks into S3 bucket
 */

const db = require('../database');
const fs = require('fs-extra');
const fetch = require('node-fetch');
const Promise = require('bluebird');
const path = require('path');
const moment = require('moment');

const { checkConnection } = require('../shared/connection');
const { log, logError } = require('../shared/logger');
const { fileStatus } = require('../shared/constants');

const {
  readFile,
  removeFileByPath,
  updateItemStatus: updateFileItemStatus,
  getCreatedTime,
} = require('../shared/file-utils');

const {
  updateItemStatus: updateSensorItemStatus,
} = require('../shared/sensor-utils');

const uploadFile = ({ url, id, filename, type }) => {
  log(url, filename);
  return checkConnection()
    .then(() =>
      readFile(filename)
        .then(data => ({ data }))
        .then(({ data }) =>
          fetch(url, {
            method: 'PUT',
            headers: {
              'content-type': type,
              'content-length': data.length,
            },
            body: data,
          })
            .then(() => {
              log('File uploaded', id);
              return db.changeStatus({
                status: fileStatus.UPLOADED,
                condition: `WHERE id=${id}`,
              });
            })
            .then(() =>
              removeFileByPath(filename))
            .then(() =>
              ({ id }))
            .catch(logError)
        ));
};

const upload = (item) => {
  log('Upload', item);
  if (!fs.existsSync(item.path)) {
    logError('File not exists', item.path);
    return updateFileItemStatus({
      status: fileStatus.FILE_NOT_EXISTS,
      session: item.session,
      filePath: item.path,
    });
  }

  return checkConnection()
    .then(() =>
      updateFileItemStatus({
        status: fileStatus.UPLOADING,
        session: item.session,
        filePath: item.path,
      }))
    .then(() => {
      if (item.created === 'undefined') {
        return getCreatedTime(item.path)
          .then((created) =>
            db.updateFiles({ created }, `WHERE id=${item.id}`));
      }
      return null;
    })
    .then(() => db.getSessionById(item.session))
    .then((session) => {
      if (item.created === 'undefined') {
        return Promise.reject('File creation time not defined.');
      }
      const time = moment(item.created) - moment(session.record_start);
      const payload = {
        key: `${item.session}/${item.filename}`,
        session: item.session,
        timestamp: item.created,
        time,
      };
      const params = {
        method: 'POST',
        headers: {
          'x-api-key': process.env.API_KEY,
        },
        body: JSON.stringify(payload),
      };
      return fetch(`${process.env.DASHPI_API}/register-chunk`, params)
        .then((response) => {
          if (response.status === 200) {
            return response.json();
          }
          throw new Error(`Register failed ${response.status} ${response.statusText}`);
        })
        .then(({ url }) => ({ url, id: item.id, filename: item.path, type: item.type }));
    })
    .then(uploadFile)
    .catch((error) => {
      logError('File upload failed', error);
      return updateFileItemStatus({
        status: fileStatus.FAILED_TO_UPLOAD,
        session: item.session,
        filePath: error.path,
      });
    })
    .catch((error) => {
      logError('upload error', error);
      return updateFileItemStatus({
        status: fileStatus.READY_FOR_UPLOAD,
        session: item.session,
        filePath: item.path,
      });
    });
};

const subscribeCameraStream = (cameraStream) => {
  cameraStream.subscribe(
    (item) => {
      log('Uploader', item);
      if (item.status === fileStatus.READY_FOR_UPLOAD) {
        upload(item);
      }
    },
    err => logError('Error: %s', err),
    () => log('Completed'));
};

const uploadGPSData = (items) => {
  log('gps items', items.length);
  const condition = items.map(({ id }) => `id=${id}`);
  const data = JSON.stringify(items.map((item) => JSON.parse(item.data)));
  const created = items[0].created;
  const filename = path.join(items[0].session, `${Date.now()}.gps.json`);
  checkConnection()
    .then(() => db.changeSensorStatus({
      status: fileStatus.UPLOADING,
      condition: `WHERE ${condition.join(' OR ')}`,
    }))
    .then(() => db.getSessionById(items[0].session))
    .then((session) => {
      const time = moment(created) - moment(session.record_start);
      const payload = {
        key: filename,
        session: items[0].session,
        timestamp: created,
        time,
      };
      const params = {
        method: 'POST',
        headers: {
          'x-api-key': process.env.API_KEY,
        },
        body: JSON.stringify(payload),
      };
      return fetch(`${process.env.DASHPI_API}/register-chunk`, params)
        .then((response) => {
          if (response.status === 200) {
            return response.json();
          }
          throw new Error(`Register failed ${response.status} ${response.statusText}`);
        });
    })
    .then(({ url }) =>
      fetch(url, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'content-length': data.length,
        },
        body: data,
      }))
    .then(() => {
      log('File uploaded', filename);
      return db.changeSensorStatus({
        status: fileStatus.UPLOADED,
        condition: `WHERE ${condition.join(' OR ')}`,
      });
    })
    .catch((error) => {
      log('GPS data upload error', error);
      return db.changeSensorStatus({
        status: fileStatus.READY_FOR_UPLOAD,
        condition: `WHERE ${condition.join(' OR ')}`,
      });
    });
};

const subscribeGPSStream = (gpsStream) => {
  let counter = 0;
  gpsStream.subscribe(
    item => {
      counter++;
      if (counter >= 10) {
        db.getSensorDataByTypeAndStatus({
          type: 'gps',
          status: fileStatus.READY_FOR_UPLOAD,
          session: item.session })
          .then(uploadGPSData)
          .catch((error) => logError('GPS UPLOAD ERROR', error));
        counter = 0;
      }
    },
    err => logError('Error: %s', err),
    () => log('Completed'));
};

module.exports = {
  run: ({ cameraStream, gpsStream }) => {
    if (process.env.DASHPI_ENV === 'device') {
      subscribeGPSStream(gpsStream);
    }
    subscribeCameraStream(cameraStream);
  },
};
