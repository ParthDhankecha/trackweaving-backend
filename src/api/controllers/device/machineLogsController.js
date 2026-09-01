const moment = require("moment");

const machineLogsService = require("../../services/machineLogsService");
const machineGroupService = require("../../services/machineGroupService");
const operatorService = require("../../services/operatorService");
const utilService = require("../../services/utilService");


module.exports = {
    getList: async (req, res, next) => {
        try {
            const body = req.body || {};
            body.workspaceId = req.user.workspaceId;
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
                    }
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
    }
}