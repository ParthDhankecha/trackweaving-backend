const projectSetupConfigService = require('../../services/config/projectSetupConfigService');
const { log } = require('../../services/utilService');


module.exports = {
    async getProjectConfig(req, res, next) {
        try {
            const projectConfig = await projectSetupConfigService.getProjectConfig();
            if (!projectConfig) {
                return res.notFound({}, global.config.message.CONFIG_NOT_FOUND);
            }

            return res.ok(projectConfig, global.config.message.OK);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    },

    async getSetupConfig(req, res, next) {
        try {
            const setupConfig = await projectSetupConfigService.getSetupConfig();
            if (!setupConfig) {
                return res.notFound({}, global.config.message.CONFIG_NOT_FOUND);
            }

            return res.ok(setupConfig, global.config.message.OK);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    },

    async updateProjectConfig(req, res, next) {
        try {
            const body = req.body;
            const updatedRecord = await projectSetupConfigService.updateConfig(body, 'projectConfigModel');
            if (updatedRecord) {

                return res.ok(updatedRecord, global.config.message.CONFIG_UPDATED);
            }

            return res.notFound({}, global.config.message.CONFIG_NOT_FOUND);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    },

    async updateSetupConfig(req, res, next) {
        try {
            const body = req.body;
            const updatedRecord = await projectSetupConfigService.updateConfig(body, 'setupConfigModel', true);

            if (updatedRecord) {
                return res.ok(updatedRecord, global.config.message.CONFIG_UPDATED);
            }

            return res.notFound({}, global.config.message.CONFIG_NOT_FOUND);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    }
}