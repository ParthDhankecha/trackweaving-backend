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
            const { apiKey, ...body } = req.body;

            const sort = { createdAt: -1 };
            const machine = await machineService.findOne({ _id: body.machineId, workspaceId: body.workspaceId });
            if (!machine) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            const machineLog = await machineLogsService.findOne({ machineId: body.machineId, workspaceId: body.workspaceId }, { sort });

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

    getList: async (req, res, next) => {
        try {
            const body = req.body || {};
            body.workspaceId = req.user.workspaceId;
            const machineLogsData = await machineLogsService.getMachineLogsWithPagination(body);
            console.log(machineLogsData);
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
                data.machineName = logData.machine.machineName;
                data.efficiency = logData.efficiencyPercent;
                data.picks = logData.picksTotal;
                data.speed = logData.speedRpm;
                data.pieceLengthM = logData.pieceLengthM;
                data.stops = logData?.machine?.stopsCount || 0;
                data.beamLeft = logData.beamLeft;
                data.setPicks = logData.setPicks;
                data.stopsData = {};
                data.totalDuration = logData.stop === 0 ? (moment.utc((moment().diff(moment(logData.machine.lastStartTime), 'seconds')) * 1000).format('HH:mm') || '00:00') : (moment.utc((moment().diff(moment(logData.machine.lastStopTime), 'seconds')) * 1000).format('HH:mm') || '00:00');
                let totalStopDuration = 0;
                let totalStops = 0;
                for(let key in logData?.machine?.stopsData){
                    let duration = logData?.machine?.stopsData[key]?.reduce((acc, curr) => acc + (curr.duration || 0), 0) || 0;
                    data.stopsData[key] = {
                        count: logData?.machine?.stopsData[key]?.length || 0,
                        duration: moment.utc(duration * 1000).format('HH:mm'),
                    }
                    totalStops += logData?.machine?.stopsData[key]?.length || 0;
                    totalStopDuration += duration;
                }
                data.stopsData.total = {
                    duration: moment.utc(totalStopDuration * 1000).format('HH:mm'),
                    count: totalStops
                };
                
                machineData.push(data);
            }

            let response = {
                aggregateReport: {
                    efficiency: efficiency / machineLogsData?.data?.length,
                    pick: pick,
                    avgSpeed: speed / machineLogsData?.data?.length,
                    avgPicks: pick / machineLogsData?.data?.length,
                    running: machineLogsData?.counts?.running || 0,
                    stopped: machineLogsData?.counts?.stopped || 0,
                    all: (machineLogsData?.counts?.running || 0) + (machineLogsData?.counts?.stopped || 0)
                },
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