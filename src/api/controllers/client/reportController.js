const moment = require('moment');

const reportService = require('../../services/reportService');
const monthlySummaryService = require('../../services/monthlySummaryService');
const productionIntelligenceService = require('../../services/productionIntelligenceService');
const machineService = require('../../services/machineService');
const utilService = require('../../services/utilService');


module.exports = {
    getReport: async (req, res, next) => {
        try {
            const body = req.body;
            const fields = ['reportType'];
            if (body.reportType !== 'beamCompletionDateReport') {
                fields.push('startDate', 'endDate');
            }
            utilService.checkRequiredParams(fields, body);

            if (body.reportType !== 'beamCompletionDateReport') {
                const startDate = moment(body.startDate);
                const endDate = moment(body.endDate);
                if (!startDate.isValid() || !endDate.isValid() || startDate.isAfter(endDate)) {
                    throw global.config.message.BAD_REQUEST;
                }
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

                case 'beamProductionReport':
                    resObj = await reportService.generateBeamProductionReport({
                        workspaceId: req.user.workspaceId,
                        machineIds: body.machineIds,
                        startDate: body.startDate,
                        endDate: body.endDate,
                    });
                    break;

                case 'beamCompletionDateReport':
                    resObj = await reportService.generateBeamCompletionDateReport({
                        workspaceId: req.user.workspaceId,
                        machineIds: body.machineIds,
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
    },

    getMonthlySummary: async (req, res) => {
        try {
            utilService.checkRequiredParams(['year', 'month'], req.body || {});
            const year = Number(req.body.year);
            const month = Number(req.body.month);
            if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || year < 2000) {
                throw global.config.message.BAD_REQUEST;
            }

            const machineQuery = { workspaceId: req.user.workspaceId };
            if (req.user.isMaster) {
                machineQuery._id = { $in: req.user.machineIds || [] };
            }

            const machines = await machineService.find(machineQuery, {
                projection: { _id: 1 },
                useLean: true
            });

            const data = await monthlySummaryService.build({
                workspaceId: req.user.workspaceId,
                machineIds: machines.map((machine) => machine._id),
                year,
                month
            });

            return res.ok(data, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    getProductionIntelligence: async (req, res) => {
        try {
            utilService.checkRequiredParams(['startDate', 'endDate', 'machineIds'], req.body || {});
            const startDate = moment(req.body.startDate);
            const endDate = moment(req.body.endDate);
            if (!startDate.isValid() || !endDate.isValid() || startDate.isAfter(endDate)) {
                throw global.config.message.BAD_REQUEST;
            }
            if (!Array.isArray(req.body.machineIds) || req.body.machineIds.length === 0) {
                throw global.config.message.BAD_REQUEST;
            }

            let machineIds = req.body.machineIds;
            if (req.user.isMaster) {
                const allowed = new Set((req.user.machineIds || []).map((id) => String(id)));
                machineIds = machineIds.filter((id) => allowed.has(String(id)));
            }

            const data = await productionIntelligenceService.build({
                workspaceId: req.user.workspaceId,
                machineIds,
                startDate: req.body.startDate,
                endDate: req.body.endDate,
                shifts: req.body.shift,
                trendDays: req.body.trendDays
            });

            return res.ok(data, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    }
};
