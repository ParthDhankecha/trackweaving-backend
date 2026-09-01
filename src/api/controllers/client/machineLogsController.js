const moment = require('moment');

const machineLogsService = require('../../services/machineLogsService');
const machineService = require('../../services/machineService');
const utilService = require('../../services/utilService');



module.exports = {
    createInovanceLog: async (req, res, next) => {
        try {
            utilService.checkRequiredParams(['apiKey', 'logs'], req.body);
            if (req.body.apiKey !== global.config.API_KEY) {
                throw global.config.message.UNAUTHORIZED;
            }
            const records = await inovanceModel.insertMany(req.body.logs);
            return res.ok(records);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    createLog: async (req, res, next) => {
        try {
            utilService.checkRequiredParams(['apiKey', 'workspaceId', 'logs'], req.body);
            if (req.body.apiKey !== global.config.API_KEY) {
                throw global.config.message.UNAUTHORIZED;
            }
            let logs = req.body.logs;
            for (let machineId in logs) {
                const powerOff = logs[machineId].powerOff === true;
                let body = powerOff
                    ? {}
                    : (machineLogsService.parseBlock(logs[machineId].rawData, logs[machineId].displayType) || {});
                let record = {
                    ...body,
                    stopsData: logs[machineId].stopsData,
                    stopCount: logs[machineId].stopCount,
                    machineId,
                    workspaceId: req.body.workspaceId,
                    rawData: logs[machineId].rawData,
                    displayType: logs[machineId].displayType,
                    powerOff,
                    updatedTime: logs[machineId].updatedTime,
                };
                if (powerOff) {
                    record.stop = global.config.POWER_OFF_STOP_CODE || 9999;
                    record.speedRpm = 0;
                }
                if (logs[machineId].lastStartTime) {
                    record.lastStartTime = logs[machineId].lastStartTime;
                }
                if (logs[machineId].lastStopTime) {
                    record.lastStopTime = logs[machineId].lastStopTime;
                }
                if (logs[machineId].prevData) {
                    let prevData = machineLogsService.parseBlock(logs[machineId].prevData.rawData, logs[machineId].prevData.displayType);
                    prevData = {
                        ...prevData,
                        machineId,
                        stopsData: prevData.stopsData,
                        stopCount: prevData.stopCount,
                        workspaceId: req.body.workspaceId,
                        rawData: logs[machineId].prevData.rawData
                    }
                    record.prevData = prevData;
                }
                await machineLogsService.create(record);
            }

            return res.ok(null);
        } catch (error) {
            utilService.log(error);

            return res.serverError(error)
        }
    },

    getMachineList: async (req, res, next) => {
        utilService.checkRequiredParams(['apiKey', 'workspaceId'], req.body);
        if (req.body.apiKey !== global.config.API_KEY) {
            throw global.config.message.UNAUTHORIZED;
        }
        let machines = await machineService.find({ workspaceId: req.body.workspaceId, isDeleted: false }, { projection: { machineCode: 1, ip: 1, deviceType: 1, displayType: 1 }, sort: { _id: 1 }, useLean: true });
        let machineIds = [];
        machines = machines.map(m => {
            machineIds.push(m._id);
            m.id = m._id.toString();
            delete m._id;

            return m;
        });
        let machineLogs = await machineLogsService.findLatestLogs({ machineId: { $in: machineIds }, updatedAt: { $gte: moment().startOf('day') } }, { projection: { stopsData: 1, machineId: 1, lastStopTime: 1, lastStartTime: 1, stop: 1, shift: 1, rawData: 1, powerOff: 1 }, useLean: true });
        let machineData = {};
        for (let machine of machines) {
            let log = machineLogs.find(l => l.machineId.toString() == machine.id.toString());
            machineData[machine.id] = {
                displayType: machine.displayType || 'nazon',
                stopCount: 0,
                stopsData: log?.stopsData || {
                    warp: [],
                    weft: [],
                    feeder: [],
                    manual: [],
                    other: []
                },
                lastStopTime: log?.lastStopTime || null,
                lastStartTime: log?.lastStartTime || null,
                stop: log?.stop || 0,
                powerOff: log?.powerOff === true,
                rawData: log?.rawData || [],
            };
        }

        return res.ok({ machines, machineData });
    },

    getQualityList: async (req, res, next) => {
        try {
            const qualities = await machineLogsService.getDistinctQualities(req.user.workspaceId);
            return res.ok(qualities, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    getList: async (req, res, next) => {
        try {
            const body = req.body || {};
            body.workspaceId = req.user.workspaceId;
            const machineLogsData = await machineLogsService.getMachineLogsWithPagination(body);

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
                    data.runTime = logData.runTime || '-';
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
    }
}