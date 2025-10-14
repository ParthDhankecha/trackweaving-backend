const moment = require("moment");

const machineLogsService = require("../../services/machineLogsService");
const machineService = require("../../services/machineService");
const { checkRequiredParams, log } = require("../../services/utilService");



module.exports = {
    create: async (req, res, next) => {
        try {
            checkRequiredParams(['apiKey', 'machineId', 'workspaceId'], req.body);
            if (req.body.apiKey !== global.config.API_KEY) {
                throw global.config.message.UNAUTHORIZED;
            }
            let { apiKey, ...body } = req.body;

            const sort = { createdAt: -1 };
            const machine = await machineService.findOne({ _id: body.machineId, workspaceId: body.workspaceId });
            if (!machine) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            const machineLog = await machineLogsService.findOne({ machineId: body.machineId, workspaceId: body.workspaceId }, { sort });

            body = machineLogsService.parseBlock(body);
            if ((!machineLog && body.stop !== 0) || (machineLog && machineLog.stop === 0 && body.stop !== 0)) {
                machine.lastStopTime = moment();
            } else if (!machineLog && body.stop === 0) {
                machine.lastStartTime = moment();
            } else if (machineLog && machineLog.stop !== 0 && body.stop === 0) {
                machine.lastStartTime = moment();
                let stopDuration = 0;
                if (machine.lastStopTime) {
                    const stop = moment(machine.lastStopTime);
                    stopDuration = Math.abs(moment().diff(stop, 'seconds'));
                    if (stopDuration >= 60) {
                        machine.stopsCount += 1;
                    }
                }
                // 0 - Running fine || 1 - Warp stop || 2 - weft stop || 7, 15, 16, 17, 18 - Feeder Stop || 4, 6 - Manual stop
                switch (machineLog.stop) {

                    case 1:
                        machine.stopsData.wrap.push({
                            start: machine.lastStopTime,
                            end: moment(),
                            duration: stopDuration
                        });
                        break;
                    case 2:
                        machine.stopsData.weft.push({
                            start: machine.lastStopTime,
                            end: moment(),
                            duration: stopDuration
                        });
                        break;
                    case 7:
                    case 15:
                    case 16:
                    case 17:
                    case 18:
                        machine.stopsData.feeder.push({
                            start: machine.lastStopTime,
                            end: moment(),
                            duration: stopDuration
                        });
                        break;
                    case 4:
                    case 6:
                        machine.stopsData.manual.push({
                            start: machine.lastStopTime,
                            end: moment(),
                            duration: stopDuration
                        });
                        break;
                    default:
                        machine.stopsData.other.push({
                            start: machine.lastStopTime,
                            end: moment(),
                            duration: stopDuration,
                            statusCode: machineLog.stop
                        });
                        break;
                }
            }

            await machine.save();

            await machineLogsService.create(body);

            return res.created(null, global.config.message.CREATED);
        } catch (error) {
            console.log(error)
            return res.serverError(error)
        }
    },

    createLog: async (req, res, next) => {
        try {
            checkRequiredParams(['apiKey', 'workspaceId', 'logs'], req.body);
            if (req.body.apiKey !== global.config.API_KEY) {
                throw global.config.message.UNAUTHORIZED;
            }
            let logs = req.body.logs;
            for (let machineId in logs) {
                let body = machineLogsService.parseBlock(logs[machineId].rawData, logs[machineId].displayType);
                let record = {
                    ...body,
                    stopsData: logs[machineId].stopsData,
                    stopCount: logs[machineId].stopCount,
                    machineId,
                    workspaceId: req.body.workspaceId,
                    rawData: logs[machineId].rawData
                };
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
            log(error);

            return res.serverError(error)
        }
    },

    getMachineList: async (req, res, next) => {
        checkRequiredParams(['apiKey', 'workspaceId'], req.body);
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
        let machineLogs = await machineLogsService.findLatestLogs({ machineId: { $in: machineIds } }, { projection: { stopsData: 1, machineId: 1, lastStopTime: 1, lastStartTime: 1, stop: 1, shift: 1, rawData: 1 }, useLean: true });
        let machineData = {};
        for(let machine of machines) {
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
                rawData: log?.rawData || [],
            };
        }

        return res.ok({ machines, machineData });
    },

    getList: async (req, res, next) => {
        try {
            const body = req.body || {};
            body.workspaceId = req.user.workspaceId;
            const machineLogsData = await machineLogsService.getMachineLogsWithPagination(body);

            const machineData = [];
            for (let logData of machineLogsData.data) {
                let data = {};
                data.machineCode = logData.machineId.machineCode;
                data.machineName = logData.machineId.machineName;
                data.efficiency = logData.efficiencyPercent;
                data.picks = logData.picksCurrentShift;
                data.speed = logData.speedRpm;
                data.currentStop = logData.stop;
                data.stopReason = machineLogsService.getStopReason(logData.stop, logData.displayType);
                data.pieceLengthM = logData.pieceLengthM;
                data.stops = logData?.stopCount || 0;
                data.beamLeft = logData.beamLeft;
                data.setPicks = logData.setPicks;
                data.stopsData = {};
                data.totalDuration = logData.stop === 0 ? (moment.utc((moment().diff(moment(new Date(logData.machineId.lastStartTime).toISOString()), 'seconds')) * 1000).format('HH:mm') || '00:00') : (moment.utc((moment().diff(moment(new Date(logData.machineId.lastStopTime).toISOString()), 'seconds')) * 1000).format('HH:mm') || '00:00');

                let totalStopDuration = 0;
                let totalStops = 0;
                for (let key in logData?.machineId?.stopsCount) {
                    data.stopsData[key] = {
                        count: logData?.machineId?.stopsCount[key].count || 0,
                        duration: moment.utc(logData?.machineId?.stopsCount[key].duration * 1000).format('HH:mm'),
                    }
                    totalStops += logData?.machineId?.stopsCount[key].count || 0;
                    totalStopDuration += logData?.machineId?.stopsCount[key].duration || 0;
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
            log(error)
            return res.serverError(error)
        }
    }
}