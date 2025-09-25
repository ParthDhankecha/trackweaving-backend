

const usersService = require("../../services/usersService");
const { log, checkRequiredParams } = require("../../services/utilService")



module.exports = {
    getById: async (req, res, next) => {
        try {
            checkRequiredParams(['id'], req.params);

            const user = await usersService.findById(req.params.id);
            if (!user) {
                return res.notFound(null, global.config.message.USER_NOT_FOUND);
            }

            return res.ok(user, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    syncData: async (req, res, next) => {
        try {
            let syncData = {
                refreshInterval: global.config.REFRESH_INTERVAL,
                efficiencyAveragePer: global.config.EFFICIENCY_AVERAGE_PER,
                efficiencyGoodPer: global.config.EFFICIENCY_GOOD_PER,
            };

            return res.ok(syncData, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    }
}