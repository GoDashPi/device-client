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

// const moveReadyFiles = ({ currentFilePath, directories }) => {
//   readDir(directories.recordings)
//     .then((files) => {
//       log('move', directories.recordings, files);
//       Promise.all(files.reduce((result, file) => {
//         if (file !== path.basename(currentFilePath)) {
//           result.push(
//             move(path.join(directories.recordings, file), path.join(directories.upload, file))
//           );
//         }
//         return result;
//       }, []));
//     });
// };

const run = ({ session, directories }) =>
  Rx.Observable.create((observer) => {
    const recordingProcess = getRecordingProcess({ session, directories });
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
    });

    watcher
      .on('add', (currentFilePath) => {
        log('Add', session, currentFilePath);
        createItem({ session, path: currentFilePath })
          .then(state => observer.next(state))
          .catch(logError);
      })
      .on('change', (currentFilePath) => {
        log('Change', session, currentFilePath);
        updateItemStatus({
          status: fileStatus.READY_FOR_UPLOAD,
          session,
          filePath: currentFilePath,
        })
          .then(state => observer.next(state))
          .catch(logError);
      })
      .on('ready', () =>
        log('Camera filewatcher ready'));
  });

module.exports = {
  run,
};
