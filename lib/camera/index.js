'use strict';

/**
 * Camera module
 */

const { log, logError } = require('../shared/logger');
const path = require('path');
const spawn = require('child_process').spawn;
const chokidar = require('chokidar');
const Rx = require('rxjs/Rx');
const { fileStatus } = require('../shared/constants');

let processes = [];

const {
  createItem,
  updateItemStatus,
} = require('../shared/file-utils');

const getRecordingProcess = ({ session, directories }) => {
  // move away from here
  if (!session) {
    throw new Error(`Invalid session [${JSON.stringify({ session, directories })}]`);
  }

  let recordingProcess;
  let command;
  let filename;
  let params = '';
  const initialParams = process.env.CAPTURE_PARAMS || '-v -cs 0 -t 0 -b 3000000 -sg 2000';

  if (process.env.DASHPI_ENV === 'device') {
    command = 'raspivid';
    filename = path.join(directories.recordings, '%06d.h264');
    params = `${initialParams} -o`;
  } else if (process.env.DASHPI_ENV === 'development') {
    command = 'ffmpeg';
    filename = path.join(directories.recordings, '%06d.mkv');
    params = `${initialParams}`;
  } else {
    throw new Error(`Invalid environment [${process.env.DASHPI_ENV}]`);
  }

  process.on('exit', (code) => {
    recordingProcess.kill();
    log(`About to exit with code: ${code}`);
  });

  recordingProcess =
    spawn(command, (`${params} ${filename}`).split(' '));

  return recordingProcess;
};

const run = ({ session, directories }) =>
  Rx.Observable.create((observer) => {
    log('Camera run', session);
    const recordingProcess = getRecordingProcess({ session, directories });
    processes.push(recordingProcess);
    let chunkPath;
    recordingProcess.stdout.on('data', (data) => {
      log(`stdout: ${data}`);
    });

    recordingProcess.stderr.on('data', (data) => {
      log(`stderr: ${data}`);
    });

    recordingProcess.on('close', (code) => {
      log(`child process exited with code ${code}`);
    });

    const watcher = chokidar.watch(directories.recordings, {
      ignored: /[\\]\./,
      persistent: true,
      // awaitWriteFinish: true, @todo check if this is better than current chunk on add
    });

    watcher
      .on('add', (currentFilePath) => {
        log('Add', session, currentFilePath);
        createItem({ session, path: currentFilePath })
          .then(state => observer.next(state))
          .catch(logError);

        if (typeof chunkPath !== 'undefined' && chunkPath !== currentFilePath) {
          log('previous chunk is ready for upload', chunkPath);
          updateItemStatus({
            status: fileStatus.READY_FOR_UPLOAD,
            session,
            filePath: currentFilePath,
          })
            .then(state => observer.next(state))
            .catch(logError);
        }
        chunkPath = currentFilePath;
      })
      // .on('change', (currentFilePath, stats) => {
      //   log('Change', session, currentFilePath, stats);
      //   updateItemStatus({
      //     status: fileStatus.READY_FOR_UPLOAD,
      //     session,
      //     filePath: currentFilePath,
      //   })
      //     .then(state => observer.next(state))
      //     .catch(logError);
      // })
      .on('ready', () =>
        log('Camera filewatcher ready'));
  });

const stop = () => {
  processes
    .forEach(process => {
      log('kill', process.pid);
      process.kill();
    });
  processes = [];
};

module.exports = {
  run,
  stop,
};
