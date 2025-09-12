const http = require('http');

const { setGlobalConfigs } = require('./src/config/constant/index');
setGlobalConfigs();

const app = require('./src/config/express');
const { env, port } = require('./src/config/env-vars');
const { Connect } = require('./src/config/mongoose');
const seederService = require('./src/api/services/config/seederService');
const commonService = require('./src/api/services/commonService');
const { infoLog, warnLog, errLog, log } = require('./src/api/services/utilService');


const server = http.createServer(app);
global.appPath = __dirname;

server.listen(port);
server.on('listening', async () => {
  await Connect();
  await seederService.seedAllConfig();
  await commonService.initializeApp();

  infoLog(`We're flying on ${env.toUpperCase()}::${server.address().port}`);
});

server.on('error', (error) => {
  errLog(`Server connection error: ${error.message}`);

  if (error.code === 'EADDRINUSE' && env === 'development') {
    server.listen(parseInt(port) + 1);
    warnLog(`We are moving on another server PORT=${server.address().port} for development only.`);
  }
});


module.exports = server;