const moment = require('moment');

const reportService = require('../../services/reportService');
const utilService = require('../../services/utilService');


module.exports = {
    getReport: async (req, res, next) => {
        try {
            const body = req.body;
            const fields = ['reportType', 'startDate', 'endDate'];
            utilService.checkRequiredParams(fields, body);

            const startDate = moment(body.startDate).format('YYYY-MM-DD');
            const endDate = moment(body.endDate).format('YYYY-MM-DD');
            if (!startDate?.isValid() || !endDate?.isValid() || startDate.isAfter(endDate)) {
                throw global.config.message.BAD_REQUEST;
            }

            if (body.reportType === 'qualityProductionReport') {
                if (!body.quality || !String(body.quality).trim()) {
                    throw global.config.message.BAD_REQUEST;
                }
            } else {
                if (!Array.isArray(body.machineIds) || body.machineIds.length === 0) {
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

                case 'qualityProductionReport':
                    resObj = await reportService.generateQualityProductionReport({
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
            utilService.log(error);

            return res.serverError(error);
        }
    }
};
