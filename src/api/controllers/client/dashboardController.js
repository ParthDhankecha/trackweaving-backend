const moment = require('moment');

const machineLogsService = require('../../services/machineLogsService');
const machineService = require('../../services/machineService');
const machineGroupService = require('../../services/machineGroupService');
const operatorService = require('../../services/operatorService');
const utilService = require('../../services/utilService');


const getStopObj = (log) => {
    // stop min(s): warp: 2.5, filler: 1, leno: 2.5, packageSensor: 1
    switch (log.stop) {
        // "H1 feeler (C1)", "H1 feeler (C2)", "H2 feeler (C1)", "H2 feeler (C2)"
        case 20:
        case 21:
        case 25:
        case 26:
            return { key: 'feeler', duration: 60 };// 1 min
        // "Dropper", "CC"
        case 31:
        case 43:
            return { key: 'warp', duration: 150 };// 2.5 mins
        // "Leno (left)", "Leno (right)"
        case 41:
        case 42:
            return { key: 'leno', duration: 150 };// 2.5 mins
        // "Package sensor (C1)", "Package sensor (C2)"
        case 50:
        case 51:
            return { key: 'packageSensor', duration: 60 };// 1 min
        default:
            return null;
    }
}
const getPerformanceLabel = (efficiency) => {
    if (efficiency >= 90) return 'excellent';
    else if (efficiency >= 88) return 'very_good';
    else if (efficiency >= 86) return 'good';
    else if (efficiency >= 85) return 'average';
    else return 'poor';
}

const toOneDecimal = (value) => Math.round((Number(value) || 0) * 10) / 10;


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
    },

    customView: async (req, res, next) => {
        try {
            const body = req.body || {};
            const targetSection = body.section;
            if (!targetSection || !/^[A-Z]+$/.test(targetSection)) {
                throw global.config.message.BAD_REQUEST;
            }

            const { workspaceId } = req.user;
            const { machineLogs, machineGroupMap } = await machineLogsService.customDashboardView({
                workspaceId: workspaceId,
                findMachineGroup: machineGroupService.find,
            });

            const data = {
                overallEfficiency: 0,
                efficiencyChartList: [],
                stoppedMachineList: []
            };

            const efficiencyObj = {};
            for (const mLog of machineLogs) {
                const machineGroup = (mLog.efficiencyPercent > 0) && machineGroupMap?.[String(mLog.machineId?.machineGroupId ?? '')];
                if (machineGroup) {
                    if (!efficiencyObj[machineGroup.sectionKey]) {
                        efficiencyObj[machineGroup.sectionKey] = {};
                    }
                    if (!efficiencyObj[machineGroup.sectionKey][machineGroup.lineKey]) {
                        efficiencyObj[machineGroup.sectionKey][machineGroup.lineKey] = {
                            value: 0,
                            count: 0
                        };
                    }

                    efficiencyObj[machineGroup.sectionKey][machineGroup.lineKey].value += mLog.efficiencyPercent;
                    efficiencyObj[machineGroup.sectionKey][machineGroup.lineKey].count += 1;
                }

                const stopObj = !!mLog.machineId?.lastStopTime && getStopObj(mLog);
                if (stopObj && machineGroup?.sectionKey === targetSection) {
                    const duration = moment().diff(moment(mLog.machineId.lastStopTime), 'seconds');
                    if (stopObj.duration <= duration) {
                        data.stoppedMachineList.push({
                            machineCode: mLog.machineId.machineCode,
                            lineKey: machineGroup.lineKey,
                            stopTime: moment.utc(duration * 1000).format('HH:mm:ss'),
                            stopSeconds: duration,
                            efficiency: toOneDecimal(mLog.efficiencyPercent),
                            stopReason: stopObj.key,
                        });
                    }
                }
            }

            let overallEfficiency = 0;
            let overallEfficiencyCount = 0;

            for (const [secKey, sectionObj] of Object.entries(efficiencyObj)) {
                let sectionEfficiency = 0;
                let sectionEfficiencyCount = 0;

                for (const [lineKey, lineObj] of Object.entries(sectionObj)) {
                    sectionEfficiency += lineObj.value;
                    sectionEfficiencyCount += lineObj.count;

                    if (secKey === targetSection && lineObj.count > 0) {
                        const efficiency = toOneDecimal(lineObj.value / lineObj.count);
                        data.efficiencyChartList.push({
                            lineKey: lineKey,
                            efficiency: efficiency,
                            performance: getPerformanceLabel(efficiency)
                        });
                    }
                }

                data[`section${secKey}`] = toOneDecimal(sectionEfficiency / (sectionEfficiencyCount || 1));
                overallEfficiency += sectionEfficiency;
                overallEfficiencyCount += sectionEfficiencyCount;
            }
            data.overallEfficiency = toOneDecimal(overallEfficiency / (overallEfficiencyCount || 1));
            data.efficiencyChartList.sort((a, b) => String(a.lineKey).localeCompare(String(b.lineKey), undefined, { numeric: true }));


            return res.ok(data, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },
}