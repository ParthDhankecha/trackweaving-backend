const projectSetupConfigService = require("./config/projectSetupConfigService");
const { infoLog, errLog } = require("./utilService");

module.exports = {
    async initializeApp() {
        infoLog('buildProjectConfig');
        const ProjectConfig = await projectSetupConfigService.buildProjectConfig();
        if (ProjectConfig) errLog(ProjectConfig);

        infoLog('buildSetupConfig');
        const SetupConfig = await projectSetupConfigService.buildSetupConfig();
        if (SetupConfig) errLog(SetupConfig);

        infoLog('Initialize App Done!');
    }
}