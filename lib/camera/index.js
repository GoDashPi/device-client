'use strict';

/**
 * Camera module
 */

const { log } = require('../shared/logger');
const path = require('path');
const spawn = require('child_process').spawn;

const getRecordingProcess = (session) => {
  // move away from here
  if (!session.id) {
    throw new Error(`Invalid session [${JSON.stringify(session)}]`);
  }

  let recordingProcess;
  let command;
  let filename;
  let params = '';
  const initialParams = process.env.CAPTURE_PARAMS || '-v -cs 0 -t 0 -b 3000000 -sg 2000';

  if (process.env.DASHPI_ENV === 'device') {
    command = 'raspivid';
    filename = path.join(session.recordingPath, '%06d.h264');
    params = `${initialParams} -o`;
  } else if (process.env.DASHPI_ENV === 'development') {
    command = 'ffmpeg';
    filename = path.join(session.recordingPath, '%06d.mkv');
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

const run = ({ id, recordingPath }) => {
  const recordingProcess = getRecordingProcess({ id, recordingPath });

  recordingProcess.stdout.on('data', (data) => {
    log(`stdout: ${data}`);
  });

  recordingProcess.stderr.on('data', (data) => {
    log(`stderr: ${data}`);
  });

  recordingProcess.on('close', (code) => {
    log(`child process exited with code ${code}`);
  });
};

module.exports = {
  run,
};
