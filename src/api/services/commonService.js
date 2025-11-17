const projectSetupConfigService = require("./config/projectSetupConfigService");
const machineService = require("./machineService");
const cronService = require("./cronService");
const { infoLog, errLog } = require("./utilService");

module.exports = {
    async initializeApp() {
        infoLog('buildProjectConfig');
        const ProjectConfig = await projectSetupConfigService.buildProjectConfig();
        if (ProjectConfig) errLog(ProjectConfig);

        infoLog('buildSetupConfig');
        const SetupConfig = await projectSetupConfigService.buildSetupConfig();
        if (SetupConfig) errLog(SetupConfig);

        infoLog('CronStarted');
        await cronService.startCronJob();

        infoLog('buildMachineAlertConfig');
        let machines = await machineService.find({ isDeleted: false }, { useLean: true, projection: { _id: 1, maxSpeedLimit: 1 } });
        global.config.MACHINE_ALERT_CONFIG = {};
        for (let machine of machines) {
            if(machine.maxSpeedLimit) {
                global.config.MACHINE_ALERT_CONFIG[machine._id] = {
                    speedLimit: machine.maxSpeedLimit,
                    sendAlert: machine.isAlertActive || false,
                };
            }
        }

        infoLog('Initialize App Done!');
    }
}