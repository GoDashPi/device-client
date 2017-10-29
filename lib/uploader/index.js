'use strict';

/**
 * Uploader module
 * Listens file changes and uploads
 * chunks into S3 bucket
 */

const db = require('../database');
const { changeFileStatus } = require('../database');
const fs = require('fs-extra');
const fetch = require('node-fetch');
const Promise = require('bluebird');
const path = require('path');
const moment = require('moment');
const _ = require('lodash');

const config = require('../../config.json');

const { checkConnection } = require('../shared/connection');
const { log, logError } = require('../shared/logger');
const { fileStatus } = require('../shared/constants');

const {
  readFile,
  readDir,
  createItem,
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
      readFile(filename))
    .then((data) =>
      fetch(url, {
        method: 'PUT',
        headers: {
          'content-type': type,
          'content-length': data.length,
        },
        body: data,
      }).then((res) => {
        if (res.status >= 400) {
          throw new Error(`failed to upload [${400}]`);
        }
        return true;
      }))
    .then(() => {
      log('File uploaded', id);
      return changeFileStatus(fileStatus.UPLOADED, {
        where: { id },
      });
    })
    .then(() =>
      removeFileByPath(filename))
    .then(() =>
      ({ id }))
    .catch(logError);
};

const upload = (item) => {
  log('Upload', item);
  if (!fs.existsSync(item.path)) {
    logError('File not exists', item.path);
    return updateFileItemStatus({
      status: fileStatus.FILE_NOT_EXISTS,
      id: item.sessionId,
      filePath: item.path,
    });
  }

  return checkConnection()
    .then(() =>
      updateFileItemStatus({
        status: fileStatus.UPLOADING,
        id: item.sessionId,
        filePath: item.path,
      }))
    .then(() => {
      if (typeof item.fileCreatedAt === 'undefined') {
        return getCreatedTime(item.path)
          .then((fileCreatedAt) =>
            db.updateFiles({ fileCreatedAt }, { id: item.id }));
      }
      return null;
    })
    .then(() => db.getSessionById(item.sessionId))
    .then((session) => {
      if (typeof item.fileCreatedAt === 'undefined') {
        return Promise.reject('File creation time not defined.');
      }
      const time = moment(item.fileCreatedAt) - moment(session.recordingStartedAt);
      const payload = {
        key: `${session.session}/${item.filename}`,
        session: session.session,
        timestamp: item.fileCreatedAt.toISOString(),
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
        id: item.sessionId,
        filePath: error.path,
      });
    })
    .catch((error) => {
      logError('upload error', error);
      return updateFileItemStatus({
        status: fileStatus.READY_FOR_UPLOAD,
        id: item.sessionId,
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

const uploadSensorData = (items) => {
  const ids = items.map(({ id }) => id);
  const data = JSON.stringify(items.map((item) => JSON.parse(item.data)));
  const {
    fileCreatedAt,
    sessionId,
    type,
  } = _.first(items);
  log('ITEMS DATA', {
    fileCreatedAt,
    sessionId,
    type,
  });
  let filename;
  checkConnection()
    .then(() => updateSensorItemStatus({ status: fileStatus.UPLOADING, ids }))
    .then(() => db.getSessionById(sessionId))
    .then((session) => {
      filename = path.join(session.session, `${Date.now()}.${type}.json`);
      const time = moment(fileCreatedAt) - moment(session.recordingStartedAt);
      const payload = {
        key: filename,
        session: session.session,
        timestamp: fileCreatedAt,
        time,
      };
      log('-------------', payload);
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
      return updateSensorItemStatus({ status: fileStatus.UPLOADED, ids });
    })
    .catch((error) => {
      log('GPS data upload error', error);
      return updateSensorItemStatus({ status: fileStatus.READY_FOR_UPLOAD, ids });
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
          sessionId: _.first(item).sessionId })
          .then(uploadSensorData)
          .catch((error) => logError('GPS UPLOAD ERROR', error));
        counter = 0;
      }
    },
    err => logError('Error: %s', err),
    () => log('Completed'));
};

const getOrphanRecordingsFiles = () =>
  readDir(config.directories.recordings)
  .then((sessionDirs) => {
    const sessionDirPromises =
      sessionDirs.reduce((result, sessionDir) => {
        const uuidRegEx =
          /[a-f0-9]{8}-?[a-f0-9]{4}-?4[a-f0-9]{3}-?[89ab][a-f0-9]{3}-?[a-f0-9]{12}/g;
        if (sessionDir.match(uuidRegEx)) {
          const orphans =
            readDir(path.join(config.directories.recordings, sessionDir))
              .then(files => ({ session: sessionDir, files }));
          result.push(orphans);
        }
        return result;
      }, []);
    return Promise
      .all(sessionDirPromises)
      .then(orphans => orphans.filter(({ files }) => files.length > 0))
      .then((orphans) => {
        const orphansInsert =
          orphans.map(({ session, files }) =>
            files.map(file =>
              db.getSessionBySession(session)
                .then(({ id }) =>
                  createItem({
                    sessionId: id,
                    path: path.join(config.directories.recordings, id, file),
                  }))
              ));
        return _.flatten(orphansInsert);
      });
  });

module.exports = {
  run: ({ cameraStream, gpsStream }) => {
    log('Uploader run');
    if (process.env.DASHPI_ENV === 'device') {
      subscribeGPSStream(gpsStream);
    }
    subscribeCameraStream(cameraStream);
  },
  upload: (uploadStatuses) => {
    const statuses = uploadStatuses || [
      fileStatus.RECORDING,
      fileStatus.UPLOADING,
      fileStatus.READY_FOR_UPLOAD,
      fileStatus.FAILED_TO_UPLOAD,
    ];
    return getOrphanRecordingsFiles()
      .then(() =>
        db.getFilesByStatus({ statuses }))
      .then((rows) =>
        Promise.all(rows.map(upload)));
  },
};
