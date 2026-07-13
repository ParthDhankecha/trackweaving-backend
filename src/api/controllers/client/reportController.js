const { log, checkRequiredParams } = require('../../services/utilService');
const reportService = require('../../services/reportService');


module.exports = {
    getReport: async (req, res, next) => {
        try {
            const fields = ['machineIds', 'reportType', 'startDate', 'endDate'];
            checkRequiredParams(fields, req.body);
            const body = req.body;
            if (Array.isArray(body.machineIds) && body.machineIds.length === 0) {
                throw global.config.message.BAD_REQUEST;
            }

            let resObj = {};
            switch (body.reportType) {
                case 'productionShiftWise':
                    resObj = await reportService.generateProductionShiftWiseReport({
                        workspaceId: req.user.workspaceId,
                        machineIds: body.machineIds,
                        startDate: body.startDate,
                        endDate: body.endDate,
                        shift: body.shift
                    });
                    break;

                case 'stoppageReport':
                    if (!body.minStopMinutes || body.minStopMinutes <= 0) {
                        throw global.config.message.BAD_REQUEST;
                    }
                    resObj = await reportService.generateStoppageReport({
                        workspaceId: req.user.workspaceId,
                        machineIds: body.machineIds,
                        startDate: body.startDate,
                        endDate: body.endDate,
                        shift: body.shift,
                        minStopMinutes: body.minStopMinutes
                    });
                    break;

                case 'stopageFilter':
                    break;

                default:
                    break;
            }

            return res.ok(resObj, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    }
};
