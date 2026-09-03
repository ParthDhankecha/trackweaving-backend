const moment = require('moment');
const { ObjectId } = require('mongoose').Types;

const machineLogsService = require('../../services/machineLogsService');
const machineGroupService = require('../../services/machineGroupService');
const operatorService = require('../../services/operatorService');
const reportService = require('../../services/reportService');
const machineService = require('../../services/machineService');
const utilService = require('../../services/utilService');


module.exports = {
    /**
     * Overview stats for the manufacturer
     * Returns: total workspaces, total machines, breakdown by machineType,
     *          currently running vs stopped machines, avg efficiency, total picks today
     */
    getOverview: async (req, res, next) => {
        try {
            const manufacturerId = ObjectId(req.mfrUser.manufacturerId);

            // All workspaces assigned to this manufacturer
            const workspaces = await workspaceModel.find(
                { manufacturerId, isDeleted: false },
                { _id: 1, firmName: 1, isActive: 1 }
            ).lean();
            const workspaceIds = workspaces.map(w => w._id);

            if (!workspaceIds.length) {
                return res.ok({
                    totalWorkspaces: 0,
                    totalMachines: 0,
                    byMachineType: {},
                    runningMachines: 0,
                    stoppedMachines: 0,
                    avgEfficiency: 0,
                    totalPicksToday: 0,
                    workspaces: []
                }, global.config.message.OK);
            }

            // All machines
            const machines = await machineModel.find(
                { manufacturerId, isDeleted: false },
                { _id: 1, machineType: 1, workspaceId: 1, machineCode: 1, machineName: 1 }
            ).lean();
            const machineIds = machines.map(m => m._id);

            // Machine type breakdown
            const byMachineType = machines.reduce((acc, m) => {
                const t = m.machineType || 'rapier';
                acc[t] = (acc[t] || 0) + 1;
                return acc;
            }, {});

            // Latest logs for all machines
            const latestLogs = await machineLatestLogsModel.find(
                { machineId: { $in: machineIds }, isDeleted: false },
                { machineId: 1, stop: 1, efficiencyPercent: 1, picksCurrentShift: 1 }
            ).lean();

            const logMap = {};
            for (const l of latestLogs) logMap[String(l.machineId)] = l;

            let running = 0, stopped = 0, effSum = 0, effCount = 0, totalPicks = 0;
            for (const m of machines) {
                const log = logMap[String(m._id)];
                if (log) {
                    if (log.stop === 0) running++; else stopped++;
                    effSum += log.efficiencyPercent || 0;
                    effCount++;
                    totalPicks += log.picksCurrentShift || 0;
                } else {
                    stopped++;
                }
            }

            // Per-workspace summary
            const workspaceSummary = workspaces.map(ws => {
                const wsMachines = machines.filter(m => String(m.workspaceId) === String(ws._id));
                let wsRunning = 0, wsStopped = 0, wsEff = 0;
                for (const m of wsMachines) {
                    const l = logMap[String(m._id)];
                    if (l) {
                        if (l.stop === 0) wsRunning++; else wsStopped++;
                        wsEff += l.efficiencyPercent || 0;
                    } else {
                        wsStopped++;
                    }
                }
                return {
                    _id: ws._id,
                    firmName: ws.firmName,
                    isActive: ws.isActive,
                    totalMachines: wsMachines.length,
                    runningMachines: wsRunning,
                    stoppedMachines: wsStopped,
                    avgEfficiency: wsMachines.length ? Math.round(wsEff / wsMachines.length) : 0
                };
            });

            return res.ok({
                totalWorkspaces: workspaces.length,
                totalMachines: machines.length,
                byMachineType,
                runningMachines: running,
                stoppedMachines: stopped,
                avgEfficiency: effCount ? Math.round(effSum / effCount) : 0,
                totalPicksToday: totalPicks,
                workspaces: workspaceSummary
            }, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    /**
     * Workspace option list for the authenticated manufacturer
     * Returns only workspaces assigned to this manufacturer (for filter dropdowns)
     */
    getWorkspaceOptions: async (req, res, next) => {
        try {
            const manufacturerId = ObjectId(req.mfrUser.manufacturerId);
            if (!utilService.isValidObjectId(manufacturerId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const workspaces = await workspaceModel.find(
                { manufacturerId, isDeleted: false },
                { _id: 1, firmName: 1 }
            ).sort({ firmName: 1 }).lean();

            return res.ok(workspaces, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    getMachineGroupOptions: async (req, res, next) => {
        try {
            const workspaceId = req.params.workspaceId;
            if (!utilService.isValidObjectId(workspaceId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const machineGroups = await machineGroupService.find({ workspaceId: workspaceId }, {
                projection: { _id: 1, groupName: 1 },
                useLean: true,
            });

            return res.ok(machineGroups, global.config.message.OK);
        }
        catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    getMachines: async (req, res, next) => {
        try {
            const { workspaceId } = req.params;
            if (!utilService.isValidObjectId(workspaceId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const machines = await machineService.find({ workspaceId, isDeleted: false }, {
                projection: 'machineCode machineName machineGroupId',
                useLean: true,
            });

            return res.ok(machines, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    getQualities: async (req, res, next) => {
        try {
            const { workspaceId } = req.params;
            if (!utilService.isValidObjectId(workspaceId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const qualities = await machineLogsService.getDistinctQualities(workspaceId);
            return res.ok(qualities, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    getMachineLogList: async (req, res, next) => {
        try {
            const manufacturerId = req.mfrUser.manufacturerId;
            const body = req.body;
            if (!utilService.isValidObjectId(manufacturerId) || !utilService.isValidObjectId(body.workspaceId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const machineLogsData = await machineLogsService.getMachineLogsWithPagination(body);

            const groupingConfig = {};
            const matchObj = machineLogsData.data.reduce((acc, log) => {
                if (log?.machineId?.machineGroupId) {
                    acc.machineGroupIds.add(log.machineId.machineGroupId);
                }
                if (log?.machineId?._id) {
                    acc.operatorMachineIds.add(log.machineId._id);
                }
                return acc;
            }, { machineGroupIds: new Set(), operatorMachineIds: new Set() });
            if (matchObj.machineGroupIds.size > 0) {
                const machineGroups = await machineGroupService.find({
                    _id: { $in: Array.from(matchObj.machineGroupIds) }
                }, {
                    useLean: true,
                    projection: { groupName: 1 }
                });
                groupingConfig.machineGroups = machineGroups.reduce((acc, group) => {
                    acc[group._id.toString()] = group.groupName;
                    return acc;
                }, {});
            }
            if (matchObj.operatorMachineIds.size > 0) {
                const operators = await operatorService.find({
                    machineIds: { $in: Array.from(matchObj.operatorMachineIds) }
                }, {
                    projection: { operatorName: 1, machineIds: 1, shift: 1 }
                });
                groupingConfig.machineOperatorObj = operators.reduce((acc, operator) => {
                    operator.machineIds.forEach(mId => {
                        acc[String(mId).concat('-', operator.shift)] = operator.operatorName;
                    });
                    return acc;
                }, {});
            }

            const machineData = [];
            for (let logData of machineLogsData.data) {
                if (!logData.machineId.lastStartTime) logData.machineId.lastStartTime = new Date();
                if (!logData.machineId.lastStopTime) logData.machineId.lastStopTime = new Date();
                let data = {};
                data.machineCode = logData.machineId.machineCode;
                data.machineName = logData.machineId.machineName;
                data.reed = logData.machineId.reed || '';
                data.quality = logData.machineId.quality || '';
                data.machineType = logData.machineId.machineType || 'rapier';
                data.machineGroupId = logData.machineId?.machineGroupId || '';

                data.machineGroup = groupingConfig.machineGroups?.[data.machineGroupId];
                if (!data.machineGroup) { delete data.machineGroup; }
                data.operator = groupingConfig.machineOperatorObj?.[String(logData.machineId._id).concat('-', logData.shift)];
                if (!data.operator) { delete data.operator; }

                data.efficiency = logData.efficiencyPercent;
                data.picks = logData.picksCurrentShift;
                data.speed = logData.speedRpm;
                data.currentStop = logData.stop;
                data.stopReason = machineLogsService.getStopReason(logData.stop, logData.machineId.displayType);
                data.pieceLengthM = logData.pieceLengthM;
                data.beamLeft = logData.beamLeft;
                data.setPicks = logData.setPicks;
                data.stopsData = {};
                data.totalDuration = logData.stop === 0 ? (moment.utc((moment().diff(moment(new Date(logData.machineId.lastStartTime).toISOString()), 'seconds')) * 1000).format('HH:mm') || '00:00') : (moment.utc((moment().diff(moment(new Date(logData.machineId.lastStopTime).toISOString()), 'seconds')) * 1000).format('HH:mm') || '00:00');

                let totalStopDuration = 0;
                let totalStops = 0;
                const stopKeys = global.config.MACHINE_TYPE_KEY_MAPPING[data.machineType] || global.config.MACHINE_TYPE_KEY_MAPPING.rapier;
                for (let key of stopKeys) {
                    data.stopsData[key] = {
                        count: logData?.machineId?.stopsCount[key]?.count || 0,
                        duration: moment.utc((logData?.machineId?.stopsCount[key]?.duration || 0) * 1000).format('HH:mm'),
                    };
                    totalStops += logData?.machineId?.stopsCount[key]?.count || 0;
                    totalStopDuration += logData?.machineId?.stopsCount[key]?.duration || 0;
                }
                if (data.machineType === 'rapier') {
                    const runTime = logData.runTime?.split(':') || [];
                    if (runTime.length > 1) {
                        let runMins = parseInt(runTime[0]) * 60 + parseInt(runTime[1]);
                        runMins -= Math.floor(totalStopDuration / 60);
                        data.runTime = `${Math.floor(runMins / 60).toString().padStart(2, '0')}:${(runMins % 60).toString().padStart(2, '0')}`;
                    }
                } else {
                    data.runTime = logData.runTime;
                }
                data.stopsData.total = {
                    duration: moment.utc(totalStopDuration * 1000).format('HH:mm'),
                    count: totalStops
                };

                machineData.push(data);
            }

            const response = {
                aggregateReport: machineLogsData.aggregateReport,
                machineLogs: machineData,
                totalCount: machineLogsData.aggregateReport.all
            };

            return res.ok(response, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    getReport: async (req, res, next) => {
        try {
            const body = req.body;
            const fields = ['reportType'];
            if (body.reportType !== 'beamCompletionDateReport') {
                fields.push('startDate', 'endDate');
            }
            utilService.checkRequiredParams(fields, body);
            if (!utilService.isValidObjectId(body.workspaceId)) {
                throw global.config.message.BAD_REQUEST;
            }

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
                        workspaceId: body.workspaceId,
                        machineIds: body.machineIds,
                        startDate: body.startDate,
                        endDate: body.endDate,
                        shift: body.shift
                    });
                    break;

                case 'qualityProductionReport':
                    resObj = await reportService.generateQualityProductionReport({
                        workspaceId: body.workspaceId,
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
                        workspaceId: body.workspaceId,
                        machineIds: body.machineIds,
                        startDate: body.startDate,
                        endDate: body.endDate,
                        shift: body.shift,
                        minStopMinutes: body.minStopMinutes
                    });
                    break;

                case 'beamProductionReport':
                    resObj = await reportService.generateBeamProductionReport({
                        workspaceId: body.workspaceId,
                        machineIds: body.machineIds,
                        startDate: body.startDate,
                        endDate: body.endDate,
                    });
                    break;

                case 'beamCompletionDateReport':
                    resObj = await reportService.generateBeamCompletionDateReport({
                        workspaceId: body.workspaceId,
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


    /**
     * Analytics API
     * Returns:
     *  - efficiencyByWorkspace: avg efficiency per workspace
     *  - productionByWorkspace: total picks per workspace
     *  - stopAnalysis:          aggregated stop counts+duration per stop type across all machines
     *  - topStops:              sorted list of stop types by frequency
     *  - machineTypeEfficiency: avg efficiency per machine type
     */
    getAnalytics: async (req, res, next) => {
        try {
            const manufacturerId = ObjectId(req.mfrUser.manufacturerId);
            const body = req.body || {};

            const workspaceFilter = { manufacturerId, isDeleted: false };
            if (body.workspaceId) workspaceFilter._id = ObjectId(body.workspaceId);

            const workspaces = await workspaceModel.find(workspaceFilter, { _id: 1, firmName: 1 }).lean();
            const workspaceIds = workspaces.map(w => w._id);

            if (!workspaceIds.length) {
                return res.ok({
                    efficiencyByWorkspace: [],
                    productionByWorkspace: [],
                    stopAnalysis: [],
                    topStops: [],
                    machineTypeEfficiency: []
                }, global.config.message.OK);
            }

            const machineFilter = { manufacturerId, workspaceId: { $in: workspaceIds }, isDeleted: false };
            if (body.machineType) machineFilter.machineType = body.machineType;

            const machines = await machineModel.find(machineFilter, { _id: 1, machineType: 1, workspaceId: 1 }).lean();
            const machineIds = machines.map(m => m._id);

            const latestLogs = await machineLatestLogsModel.find(
                { machineId: { $in: machineIds }, isDeleted: false },
                {
                    machineId: 1,
                    efficiencyPercent: 1,
                    picksCurrentShift: 1,
                    stopsCount: 1
                }
            ).lean();

            // Map machineId → log
            const logMap = {};
            for (const l of latestLogs) logMap[String(l.machineId)] = l;

            // Machine info map
            const machineInfoMap = {};
            for (const m of machines) machineInfoMap[String(m._id)] = m;

            // --- Per-workspace efficiency & production ---
            const wsData = {};
            for (const ws of workspaces) {
                wsData[String(ws._id)] = {
                    firmName: ws.firmName,
                    efficiencySum: 0,
                    machineCount: 0,
                    totalPicks: 0
                };
            }

            for (const m of machines) {
                const key = String(m.workspaceId);
                if (!wsData[key]) continue;
                const l = logMap[String(m._id)];
                if (l) {
                    wsData[key].efficiencySum += l.efficiencyPercent || 0;
                    wsData[key].machineCount++;
                    wsData[key].totalPicks += l.picksCurrentShift || 0;
                }
            }

            const efficiencyByWorkspace = Object.entries(wsData).map(([id, d]) => ({
                workspaceId: id,
                firmName: d.firmName,
                avgEfficiency: d.machineCount ? Math.round(d.efficiencySum / d.machineCount) : 0
            }));

            const productionByWorkspace = Object.entries(wsData).map(([id, d]) => ({
                workspaceId: id,
                firmName: d.firmName,
                totalPicks: d.totalPicks
            }));

            // --- Stop analysis across all machines ---
            const stopTypes = ['warp', 'weft', 'feeder', 'manual', 'other', 'h1', 'h2'];
            const stopAnalysisMap = {};
            for (const t of stopTypes) stopAnalysisMap[t] = { count: 0, duration: 0 };

            for (const m of machines) {
                const l = logMap[String(m._id)];
                if (!l || !l.stopsCount) continue;
                for (const t of stopTypes) {
                    if (l.stopsCount[t]) {
                        stopAnalysisMap[t].count += l.stopsCount[t].count || 0;
                        stopAnalysisMap[t].duration += l.stopsCount[t].duration || 0;
                    }
                }
            }

            const stopAnalysis = stopTypes.map(t => ({
                stopType: t,
                count: stopAnalysisMap[t].count,
                totalDurationSeconds: stopAnalysisMap[t].duration
            }));

            const topStops = [...stopAnalysis].sort((a, b) => b.count - a.count);

            // --- Efficiency by machine type ---
            const typeMap = {};
            for (const m of machines) {
                const t = m.machineType || 'rapier';
                if (!typeMap[t]) typeMap[t] = { effSum: 0, count: 0 };
                const l = logMap[String(m._id)];
                if (l) {
                    typeMap[t].effSum += l.efficiencyPercent || 0;
                    typeMap[t].count++;
                }
            }

            const machineTypeEfficiency = Object.entries(typeMap).map(([type, d]) => ({
                machineType: type,
                avgEfficiency: d.count ? Math.round(d.effSum / d.count) : 0,
                totalMachines: d.count
            }));

            return res.ok({
                efficiencyByWorkspace,
                productionByWorkspace,
                stopAnalysis,
                topStops,
                machineTypeEfficiency
            }, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },
};