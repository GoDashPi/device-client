'use strict';

/**
 * Database module
 */

// const { log, logError } = require('../shared/logger');

const Sequelize = require('sequelize');

const Op = Sequelize.Op;

const sequelize = new Sequelize('dashpi', null, null, {
  dialect: 'sqlite',
  storage: 'dashpi.db',
});

/**
 * Sessions Model
 * @type {Model}
 */
const Sessions = sequelize.define('sessions', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    unique: true,
    autoIncrement: true,
  },
  session: Sequelize.STRING(64), // eslint-disable-line new-cap
  recordingStartedAt: {
    type: Sequelize.DATE,
    allowNull: true,
  },
});

/**
 * SensorData Model
 * @type {Model}
 */
const SensorData = sequelize.define('sensordata', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
  },
  data: Sequelize.TEXT,
  type: Sequelize.TEXT(16), // eslint-disable-line new-cap
  status: Sequelize.INTEGER,
  fileCreatedAt: Sequelize.DATE,
});

Sessions.hasMany(SensorData);
SensorData.belongsTo(Sessions);

/**
 * Files Model
 * @type {Model}
 */
const Files = sequelize.define('files', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
  },
  fileCreatedAt: Sequelize.DATE,
  filename: Sequelize.TEXT(64), // eslint-disable-line new-cap
  type: Sequelize.TEXT(16), // eslint-disable-line new-cap
  path: Sequelize.TEXT(128), // eslint-disable-line new-cap
  status: Sequelize.INTEGER,
});

Sessions.hasMany(Files);
Files.belongsTo(Sessions);

const initialize = () =>
  sequelize.sync();
  // sequelize.sync({ force: true });

const createSession = ({ session }) =>
  initialize()
    .then(() => Sessions.create({ session }));

const insertIntoSensorData = ({ sessionId, data, status, fileCreatedAt, type }) =>
  SensorData.create({ sessionId, data, status, fileCreatedAt, type });

//
// const insertIntoSensorData = ({ session, data, status, created, type }) =>
//   new Promise((resolve, reject) => {
//     db.run(`INSERT INTO sensordata (session, data, status, created, type)
//              VALUES ('${session}', '${data}', '${status}', '${created}', '${type}')`,
//       (error) => {
//         if (error) {
//           logError(error);
//           return reject(error);
//         }
//         return resolve('ok');
//       });
//   });

const insertIntoFiles = ({ id, path, status, fileCreatedAt, type, filename }) =>
  Files.create({ path, status, fileCreatedAt, type, filename, sessionId: id });

const updateFiles = (values, options) =>
  Files.update(values, options);

const changeFileStatus = (status, options) =>
  Files.update({ status }, options);

const changeSensorStatus = (status, options) =>
  SensorData.update({ status }, options);

// const changeSensorStatus = ({ status, condition }) => new Promise((resolve, reject) => {
//   db.run(`UPDATE sensordata SET status=${status} ${condition}`, (error) => {
//     if (error) {
//       logError(error);
//       return reject(error);
//     }
//     return resolve('ok');
//   });
// });

const getFilesByStatus = ({ statuses }) => {
  const or = statuses.map((status) => ({ status }));
  return Files.findAll({
    where: {
      [Op.or]: or,
    },
  });
};

const getSensorDataByStatus = ({ statuses }) => {
  const or = statuses.map((status) => ({ status }));
  return SensorData.findAll({
    where: {
      [Op.or]: or,
    },
  });
};

const getFilesBySessionId = ({ id }) =>
  Files.findAll({ where: { sessionId: id } });

const getRowByFile = ({ path }) =>
  Files.findAll({
    where: { path },
  });

const getSensorDataByTypeAndDate = ({ sessionId, type, fileCreatedAt }) =>
  SensorData.findAll({
    where: {
      sessionId,
      type,
      fileCreatedAt,
    },
  });

const getSensorDataByTypeAndStatus = ({ type, sessionId, status }) =>
  SensorData.findAll({
    where: {
      type,
      sessionId,
      status,
    },
  });

const getSessions = () =>
  Sessions.findAll();

const getSessionById = (id) =>
  Sessions.findById(id);

const updateSession = (values, { where }) =>
  Sessions.update(values, { where });

const getSessionBySession = (session) =>
  Sessions.findAll({ where: { session } });

module.exports = {
  createSession,
  insertIntoFiles,
  updateFiles,

  changeFileStatus,
  changeSensorStatus,

  getFilesByStatus,
  getSessions,
  getSessionById,
  getSessionBySession,

  updateSession,
  getRowByFile,

  getSensorDataByStatus,
  getFilesBySessionId,
  insertIntoSensorData,
  getSensorDataByTypeAndDate,
  getSensorDataByTypeAndStatus,
};
