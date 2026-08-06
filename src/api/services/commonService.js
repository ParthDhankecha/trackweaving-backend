const projectSetupConfigService = require('./config/projectSetupConfigService');
const cronService = require('./cronService');
const machineService = require('./machineService');
// const alertConfigService = require('./alertConfigService');
const utilService = require('./utilService');


module.exports = {
    async initializeApp() {
        utilService.infoLog('buildProjectConfig');
        const ProjectConfig = await projectSetupConfigService.buildProjectConfig();
        if (ProjectConfig) utilService.errLog(ProjectConfig);

        utilService.infoLog('buildSetupConfig');
        const SetupConfig = await projectSetupConfigService.buildSetupConfig();
        if (SetupConfig) utilService.errLog(SetupConfig);

        utilService.infoLog('CronStarted');
        await cronService.startCronJob();

        utilService.infoLog('buildMachineAlertConfig');
        let machines = await machineService.find({ isDeleted: false }, { useLean: true, projection: { _id: 1, maxSpeedLimit: 1, isAlertActive: 1 } });
        global.config.MACHINE_ALERT_CONFIG = {};
        for (let machine of machines) {
            if (machine.maxSpeedLimit) {
                global.config.MACHINE_ALERT_CONFIG[String(machine._id)] = {
                    speedLimit: machine.maxSpeedLimit,
                    sendAlert: machine.isAlertActive || false,
                };
            }
        }

        // utilService.infoLog('syncWorkspaceAlerts');
        // await alertConfigService.syncWorkspaceAlerts();


        utilService.infoLog('Initialize App Done!');
    }
}