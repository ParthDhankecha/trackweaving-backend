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
            for(let machineId in logs) {
                let body = machineLogsService.parseBlock(logs[machineId].rawData);
                let record = {
                    ...body,
                    stopsData: logs[machineId].stopsData,
                    stopsCount: logs[machineId].stopsCount,
                    machineId,
                    workspaceId: req.body.workspaceId,
                    rawData: logs[machineId].rawData
                };
                if(logs[machineId].lastStartTime){
                    record.lastStartTime = logs[machineId].lastStartTime;
                }
                if(logs[machineId].lastStopTime){
                    record.lastStopTime = logs[machineId].lastStopTime;
                }
                if(logs[machineId].prevData){
                    let prevData = machineLogsService.parseBlock(logs[machineId].prevData.rawData);
                    prevData = {
                        ...prevData,
                        machineId,
                        stopsData: prevData.stopsData,
                        stopsCount: prevData.stopsCount,
                        workspaceId: req.body.workspaceId,
                        rawData: logs[machineId].prevData
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
        let machines = await machineService.find({ workspaceId: req.body.workspaceId, isDeleted: false }, { projection: { machineCode: 1, ip: 1, deviceType: 1 }, sort: { _id: 1 }, useLean: true });
        let machineIds = [];
        machines = machines.map(m => { 
            machineIds.push(m._id);
            m.id = m._id.toString();
            delete m._id;

            return m; 
        });
        let machineLogs = await machineLogsService.findLatestLogs({ machineId: { $in: machineIds } }, { projection: { stopsData: 1, lastStopTime: 1, lastStartTime: 1, stop: 1, shift: 1, rawData: 1 }, useLean: true });
        let machineData = {};
        for(let machine of machines) {
            let log = machineLogs.find(l => l.machineId.toString() === machine.id.toString());
            machineData[machine.id] = {
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
                shift: log?.shift || 1,
                rawData: log?.rawData || [],
            };
        }

        return res.ok({ machines, machineData });
    },

    getList: async (req, res, next) => {
        try {
            checkRequiredParams(['workspaceId'], req.body);
            const body = req.body || {};
            const pageObj = {
                page: parseInt(body.page) || 1,
                limit: parseInt(body.limit) || 10
            };

            const machineLogsData = await machineLogsService.getMachineLogsWithPagination(req.body);
            let efficiency = 0;
            let pick = 0;
            let speed = 0;
            for(let data of machineLogsData.data) {
                efficiency += data.efficiencyPercent;
                pick += data.picksTotal;
                speed += data.speedRpm;
            }

            let machineData = [];
            for(let logData of machineLogsData.data) {
                let data = {};
                data.efficiency = logData.efficiencyPercent;
                data.picks = logData.picksTotal;
                data.speed = logData.speedRpm;
                data.pieceLengthM = logData.pieceLengthM;
                data.stops = logData?.machine?.stopsCount || 0;
                data.beamLeft = logData.beamLeft;
                data.setPicks = logData.setPicks;
                data.stopsData = logData?.machine?.stopsData || {};
                
                machineData.push(data);
            }

            let response = {
                aggregateReport: machineLogsData.aggregateReport,
                machineLogs: machineData,
                totalCount: machineLogsData.totalMachines
            };

            return res.ok(response, global.config.message.OK);

        } catch (error) {
            log(error)
            return res.serverError(error)
        }
    }
}