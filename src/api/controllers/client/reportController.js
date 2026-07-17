const { log, checkRequiredParams } = require('../../services/utilService');
const reportService = require('../../services/reportService');


module.exports = {
    getReport: async (req, res, next) => {
        try {
            const fields = ['reportType', 'startDate', 'endDate'];
            checkRequiredParams(fields, req.body);
            const body = req.body;

            if (body.reportType === 'productionQualityWise') {
                if (!body.quality || !String(body.quality).trim()) {
                    throw global.config.message.BAD_REQUEST;
                }
            } else {
                checkRequiredParams(['machineIds'], req.body);
                if (Array.isArray(body.machineIds) && body.machineIds.length === 0) {
                    throw global.config.message.BAD_REQUEST;
                }
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

                case 'productionQualityWise':
                    resObj = await reportService.generateProductionQualityWiseReport({
                        workspaceId: req.user.workspaceId,
                        quality: body.quality,
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

                case 'beamLeftReport':
                    resObj = await reportService.generateBeamLeftReport({
                        workspaceId: req.user.workspaceId,
                        machineIds: body.machineIds,
                        startDate: body.startDate,
                        endDate: body.endDate,
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
