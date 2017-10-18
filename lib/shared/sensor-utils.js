'use strict';

const db = require('../database');
const { log, logError } = require('../shared/logger');
const { fileStatus } = require('../shared/constants');

const createItem = (item) => {
  log('SensorData: Create item', item);
  const statusItem =
    Object.assign({},
      item,
      { status: fileStatus.READY_FOR_UPLOAD,
        data: JSON.stringify(item.data) });
  return db.insertIntoSensorData(statusItem)
    .then(() => db.getSensorDataByTypeAndDate(statusItem))
    .catch(logError);
};

const updateItemStatus = ({ status, ids }) => {
  const condition = ids.map(id => `id=${id}`).join(' OR ');
  log('Update item', { status, ids, condition });
  return db.changeSensorStatus({
    status,
    condition: `WHERE ${condition}`,
  });
};

module.exports = {
  createItem,
  updateItemStatus,
};
