'use strict';

const db = require('../database');
const fs = require('fs-extra');
const Promise = require('bluebird');
const path = require('path');
const { fileStatus } = require('../shared/constants');
const moment = require('moment');

const { log, logError } = require('../shared/logger');

const readFile = Promise.promisify(fs.readFile);
const removeFile = Promise.promisify(fs.remove);
const readDir = Promise.promisify(fs.readdir);
const stat = Promise.promisify(fs.stat);
const move = Promise.promisify(fs.move);
const writeJson = Promise.promisify(fs.writeJson);

const updateSessionRecordingStart = (statusItem) =>
  db.getSessionById(statusItem.session)
    .then((session) => {
      if (session.record_start === null) {
        return db.updateSession(
          { recordingStart: statusItem.created },
          `WHERE session="${statusItem.session}"`)
          .then(() => statusItem);
      }
      return statusItem;
    });

const getCreatedTime = chunkPath =>
  stat(chunkPath)
    .then((stats) =>
      // note mac doesn't support ms in create time
       moment(stats.birthtime).utc().format('YYYY-MM-DD HH:mm:ss.SSS'));

const getFileType = (filePath) => {
  let fileType = '';
  switch (path.extname(filePath)) {
    case '.json':
      fileType = 'application/json';
      break;
    default:
      fileType = 'video/mp4';
      break;
  }

  return fileType;
};

const createItem = (item) => {
  log('Create item', item);
  return getCreatedTime(item.path)
    .then((created) => {
      const type = getFileType(item.path);
      const filename = path.basename(item.path);
      const statusItem =
        Object.assign({ status: fileStatus.RECORDING, created, type, filename }, item);
      return db.insertIntoFiles(statusItem)
        .then(() => statusItem);
    })
    .then(updateSessionRecordingStart)
    .catch(logError);
};

const updateItemStatus = ({ status, session, filePath }) =>
  db.updateFiles(
    { status },
    `WHERE session='${session}' AND path='${filePath}'`)
    .then(() => db.getRowByFile({ path: filePath }))
    .catch(logError);

const removeFileByPath = (filePath) =>
  removeFile(filePath)
    .then(() => db.changeStatus({
      status: fileStatus.DELETED,
      condition: `WHERE path="${filePath}"`,
    }))
    .catch(logError);

module.exports = {
  createItem,
  updateItemStatus,
  getFileType,
  getCreatedTime,
  removeFileByPath,
  readFile,
  removeFile,
  readDir,
  stat,
  move,
  writeJson,
};
