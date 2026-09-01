const appVersionService = require('../../services/appVersionService');
const utilService = require('../../services/utilService');


module.exports = {
    getAppVersion: async (req, res, next) => {
        try {
            const { appflavor, appversion, appplatform } = req.headers;

            const data = await appVersionService.getForceVersion({
                flavor: appflavor,
                version: appversion,
                platform: appplatform,
            });

            data.apiHost = global.config.API_HOST || null;

            return res.ok(data, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    getConfig: async (req, res, next) => {
        try {
            const data = {
                // dashboard related configs
                refreshInterval: global.config.REFRESH_INTERVAL,
                efficiencyAveragePer: global.config.EFFICIENCY_AVERAGE_PER,
                efficiencyGoodPer: global.config.EFFICIENCY_GOOD_PER,
                beamLeftMin: global.config.BEAM_LEFT_MIN,
                // device related configs
                apiHost: global.config.API_HOST || null,
                reportUrl: global.config.REPORT_URL || null,
            };

            const { appflavor = 'base' } = req.headers;
            if (String(appflavor).toLowerCase() === 'pickwell' && data.apiHost) {
                const replacePart = data.apiHost.match(/:\/\/([^/]+)\/?/)?.[1];
                if (replacePart) {
                    data.reportUrl = data.apiHost.replace(replacePart, 'monitor.pickwell.in');
                }
            }

            return res.ok(data, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },
}