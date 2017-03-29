const fileStatus = {
  RECORDING: 0,
  READY_FOR_UPLOAD: 1,
  UPLOADING: 2,
  UPLOADED: 3,
  DELETED: 4,
  FAILED_TO_UPLOAD: 10,
  FILE_NOT_EXISTS: 11,
};

module.exports = {
  fileStatus,
};
