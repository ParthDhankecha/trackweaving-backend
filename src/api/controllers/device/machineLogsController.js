const moment = require("moment");
const machineLogsService = require("../../services/machineLogsService");

module.exports = {
    getList: async (req, res, next) => {
        try {
            const body = req.body || {};
            body.workspaceId = req.user.workspaceId;
            const machineLogsData = await machineLogsService.getMachineLogsWithPagination(body);

            let machineData = [];
            for(let logData of machineLogsData.data) {
                let data = {};
                data.machineCode = logData.machineId.machineCode;
                data.machineName = logData.machineId.machineName;
                data.efficiency = logData.efficiencyPercent;
                data.picks = logData.picksCurrentShift;
                data.speed = logData.speedRpm;
                data.currentStop = logData.stop;
                data.stopReason = machineLogsService.getStopReason(logData.stop, logData.displayType);
                data.pieceLengthM = logData.pieceLengthM;
                data.stops = logData?.machine?.stopCount || 0;
                data.beamLeft = logData.beamLeft;
                data.setPicks = logData.setPicks;
                data.stopsData = {};
                data.totalDuration = logData.stop === 0 ? (moment.utc((moment().diff(moment(new Date(logData.machineId.lastStartTime).toISOString()), 'seconds')) * 1000).format('HH:mm') || '00:00') : (moment.utc((moment().diff(moment(new Date(logData.machineId.lastStopTime).toISOString()), 'seconds')) * 1000).format('HH:mm') || '00:00');
                let totalStopDuration = 0;
                let totalStops = 0;
                for(let key in logData?.machineId?.stopsCount){
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

            let response = {
                aggregateReport: machineLogsData.aggregateReport,
                machineLogs: machineData,
                totalCount: machineLogsData.aggregateReport.all
            };
            // console.log(response);
            

            return res.ok(response, global.config.message.OK);

        } catch (error) {
            log(error)
            return res.serverError(error)
        }
    }
}