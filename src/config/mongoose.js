const mongoose = require('mongoose');
const { env, mongo: { uri, strictQuery, options } } = require('./env-vars');
const { errLog, infoLog } = require('../api/services/utilService');

mongoose.set('debug', env === 'development');

mongoose.set('strictQuery', strictQuery);

mongoose.connection.on('error', (err) => {
  errLog(`Mongo Engine is down : ${err}`);
});

mongoose.connection.on('connected', () => {
  infoLog(`Mongo Engine is up on ${env}`);
});


exports.Connect = async () => {
  mongoose.connect(uri, options);
  return mongoose.connection;
};