const { log } = require('../../services/utilService');
const mongoose = require('mongoose');
const moment = require('moment');
const machineLogsService = require('../../services/machineLogsService');


module.exports = {

    /**
     * Overview stats for the manufacturer
     * Returns: total workspaces, total machines, breakdown by machineType,
     *          currently running vs stopped machines, avg efficiency, total picks today
     */
    getOverview: async (req, res, next) => {
        try {
            const manufacturerId = new mongoose.Types.ObjectId(req.manufacturer.id);

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
                totalMachines:   machines.length,
                byMachineType,
                runningMachines:  running,
                stoppedMachines:  stopped,
                avgEfficiency:    effCount ? Math.round(effSum / effCount) : 0,
                totalPicksToday:  totalPicks,
                workspaces:       workspaceSummary
            }, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    /**
     * Machine list with filters
     * Query params: workspaceId, machineType, page, limit, search (machineName/machineCode)
     */
    getMachineList: async (req, res, next) => {
        try {
            const manufacturerId = new mongoose.Types.ObjectId(req.manufacturer.id);
            const body = req.body || {};

            const machineFilter = { manufacturerId, isDeleted: false };
            if (body.workspaceId) machineFilter.workspaceId = new mongoose.Types.ObjectId(body.workspaceId);
            if (body.machineType) machineFilter.machineType = body.machineType;
            if (body.search) {
                machineFilter.$or = [
                    { machineCode: { $regex: body.search, $options: 'i' } },
                    { machineName: { $regex: body.search, $options: 'i' } }
                ];
            }

            const page  = parseInt(body.page)  || 1;
            const limit = parseInt(body.limit) || 20;
            const skip  = (page - 1) * limit;

            const [machines, totalCount] = await Promise.all([
                machineModel.find(machineFilter, {
                    machineCode: 1, machineName: 1, machineType: 1, serialNumber: 1,
                    workspaceId: 1, displayType: 1, lastStartTime: 1, lastStopTime: 1
                })
                    .populate({ path: 'workspaceId', select: 'firmName' })
                    .skip(skip)
                    .limit(limit)
                    .sort({ createdAt: -1 })
                    .lean(),
                machineModel.countDocuments(machineFilter)
            ]);

            const machineIds = machines.map(m => m._id);
            const latestLogs = await machineLatestLogsModel.find(
                { machineId: { $in: machineIds }, isDeleted: false },
                {
                    machineId: 1,
                    stop: 1,
                    efficiencyPercent: 1,
                    picksCurrentShift: 1,
                    picksTotal: 1,
                    speedRpm: 1,
                    beamLeft: 1,
                    stopCount: 1,
                    runTime: 1,
                    shift: 1,
                    pieceLengthM: 1,
                    setPicks: 1
                }
            ).lean();

            const logMap = {};
            for (const l of latestLogs) logMap[String(l.machineId)] = l;

            const now = moment();
            const list = machines.map(m => {
                const l = logMap[String(m._id)] || {};
                const isRunning = l.stop === 0;
                // Duration since last start (running) or last stop (stopped)
                let totalDuration = '00:00';
                try {
                    const ref = isRunning ? m.lastStartTime : m.lastStopTime;
                    if (ref) totalDuration = moment.utc(now.diff(moment(ref), 'seconds') * 1000).format('HH:mm');
                } catch (e) {}
                return {
                    _id:              m._id,
                    machineCode:      m.machineCode,
                    machineName:      m.machineName,
                    machineType:      m.machineType,
                    serialNumber:     m.serialNumber,
                    workspace:        m.workspaceId,
                    isRunning,
                    stop:             l.stop ?? null,
                    stopReason:       machineLogsService.getStopReason(l.stop ?? 0, m.displayType || 'nazon'),
                    efficiencyPercent: Math.round(l.efficiencyPercent || 0),
                    picksCurrentShift: l.picksCurrentShift || 0,
                    picksTotal:       l.picksTotal || 0,
                    speedRpm:         l.speedRpm || 0,
                    beamLeft:         l.beamLeft ?? null,
                    totalStops:       l.stopCount || 0,
                    runTime:          l.runTime || '00:00:00',
                    totalDuration,
                    pieceLengthM:     l.pieceLengthM || 0,
                    setPicks:         l.setPicks || 0,
                    shift:            l.shift ?? null
                };
            });

            return res.ok({ list, totalCount }, global.config.message.OK);
        } catch (error) {
            log(error);
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
            const manufacturerId = new mongoose.Types.ObjectId(req.manufacturer.id);
            const body = req.body || {};

            const workspaceFilter = { manufacturerId, isDeleted: false };
            if (body.workspaceId) workspaceFilter._id = new mongoose.Types.ObjectId(body.workspaceId);

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
                        stopAnalysisMap[t].count    += l.stopsCount[t].count    || 0;
                        stopAnalysisMap[t].duration += l.stopsCount[t].duration || 0;
                    }
                }
            }

            const stopAnalysis = stopTypes.map(t => ({
                stopType: t,
                count:    stopAnalysisMap[t].count,
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
            log(error);
            return res.serverError(error);
        }
    },

    /**
     * Workspace option list for the authenticated manufacturer
     * Returns only workspaces assigned to this manufacturer (for filter dropdowns)
     */
    getWorkspaceOptions: async (req, res, next) => {
        try {
            const manufacturerId = new mongoose.Types.ObjectId(req.manufacturer.id);
            const workspaces = await workspaceModel.find(
                { manufacturerId, isDeleted: false },
                { _id: 1, firmName: 1 }
            ).sort({ firmName: 1 }).lean();

            return res.ok(workspaces, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    }
};
