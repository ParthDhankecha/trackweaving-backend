const moment = require('moment');

const machineLogsService = require('../../services/machineLogsService');
const machineAttentionService = require('../../services/machineAttentionService');
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


// Custom Dashboard 2 Helpers -- Start
const TV_ATTENTION_REASON_MAP = {
    LOW_SPEED: 'Low RPM',
    REPEATED_STOP: 'High Stops',
    HIGH_RECENT_DOWNTIME: 'High Stops',
    LOW_EFFICIENCY: 'Low Efficiency',
    BELOW_FACTORY_AVERAGE: 'Low Efficiency',
};
const EFFICIENCY_BUCKET_DEFS = [
    { key: 'excellent', min: 94, max: null },
    { key: 'good', min: 88, max: 94 },
    { key: 'watch', min: 80, max: 88 },
    { key: 'low', min: null, max: 80 },
];
const LONG_STOPPED_MIN_MINUTES = 10;
const ATTENTION_BOARD_GROUPS = [
    { key: 'fixnow', label: 'Fix Now' },
    { key: 'needsattention', label: 'Needs Attention' },
    { key: 'watch', label: 'Watch' },
    { key: 'good', label: 'Good' },
];

function getShiftName(shift) {
    return Number(shift) === global.config.SHIFT_TYPE.NIGHT ? 'Night Shift' : 'Day Shift';
}

function getEfficiencyBucketKey(efficiency) {
    if (efficiency >= 94) return 'excellent';
    if (efficiency >= 88) return 'good';
    if (efficiency >= 80) return 'watch';
    return 'low';
}

function emptyEfficiencyBuckets() {
    return EFFICIENCY_BUCKET_DEFS.reduce((acc, def) => {
        acc[def.key] = {
            ...(def.min != null ? { min: def.min } : {}),
            ...(def.max != null ? { max: def.max } : {}),
            count: 0,
            machines: [],
        };
        return acc;
    }, {});
}

function toTvAttentionReason(reasons = []) {
    for (const reason of reasons) {
        const label = TV_ATTENTION_REASON_MAP[reason?.code];
        if (label) return label;
    }
    return null;
}

function formatDurationHHmm(from) {
    if (!from) return '00:00';
    const seconds = Math.max(0, moment().diff(moment(from), 'seconds'));
    return moment.utc(seconds * 1000).format('HH:mm') || '00:00';
}

function computeGroupMetrics(machines = []) {
    const count = machines.length;
    if (!count) {
        return { efficiency: 0, pick: 0, avgPicks: 0, avgSpeed: 0, count: 0 };
    }

    let efficiencySum = 0;
    let efficiencyCount = 0;
    let pickSum = 0;
    let speedSum = 0;
    let running = 0;

    for (const machine of machines) {
        if (Number(machine.efficiency) > 0) {
            efficiencySum += Number(machine.efficiency);
            efficiencyCount += 1;
        }
        pickSum += Number(machine.picks) || 0;
        speedSum += Number(machine.speed) || 0;
        if (Number(machine.speed) > 0) running += 1;
    }

    return {
        efficiency: Math.round(efficiencySum / (efficiencyCount || 1)),
        pick: pickSum,
        avgPicks: Math.round(pickSum / count),
        avgSpeed: running ? Math.round(speedSum / running) : 0,
        count,
    };
}

function buildAttentionBoardMachine(log, attention = {}) {
    const machine = log.machineId || {};
    const isRunning = Number(log.stop) === 0;
    const durationFrom = isRunning ? (machine.lastStartTime || log.lastStartTime) : (machine.lastStopTime || log.lastStopTime);
    return {
        machineId: String(machine._id || ''),
        machineCode: machine.machineCode || '',
        quality: machine.quality || '',
        efficiency: Number.isFinite(Number(log.efficiencyPercent)) ? toOneDecimal(log.efficiencyPercent) : 0,
        picks: Number(log.picksCurrentShift) || 0,
        speed: Number(log.speedRpm) || 0,
        currentStop: log.stop || 0,
        stopReason: machineLogsService.getStopReason(log.stop, machine.displayType),
        totalDuration: formatDurationHHmm(durationFrom),
        attentiongroup: attention.attentiongroup || 'good',
        attentionReasons: attention.attentionReasons || [],
    };
}
// Custom Dashboard 2 Helpers -- End


module.exports = {
    getList: async (req, res, next) => {
        try {
            const body = req.body;
            const { workspaceId, isMaster } = req.user;
            body.workspaceId = workspaceId;
            if (isMaster) body.masterMachineIds = req.user.machineIds;

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
                data.canUpdateBeamLeft = machineLogsService.canUpdateBeamLeft(logData.machineId.displayType);
                if (data.canUpdateBeamLeft) {
                    data.machineId = logData.machineId._id;
                }
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

            if (machineAttentionService.shouldIncludeAttention(body)) {
                await machineAttentionService.attachAttentionGroups(
                    machineData,
                    machineLogsData.data,
                    workspaceId
                );
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

    customView2: async (req, res, next) => {
        try {
            const body = req.body;
            const screen = body.screen;
            const machineGroupId = body.machineGroupId;
            if (!utilService.isValidObjectId(machineGroupId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const CUSTOM_DASHBOARD_2_SCREEN = global.config.CUSTOM_DASHBOARD_2_SCREEN;
            if (!CUSTOM_DASHBOARD_2_SCREEN?._list?.includes(screen)) {
                throw global.config.message.BAD_REQUEST;
            }

            const { workspaceId } = req.user;
            const group = await machineGroupService.findOne(
                { _id: machineGroupId, workspaceId },
                { useLean: true, projection: { groupName: 1 } }
            );
            if (!group) throw global.config.message.RECORD_NOT_FOUND;

            const { machineLogs } = await machineLogsService.customDashboardView2({
                workspaceId,
                machineGroupId,
            });

            // TODO: upcoming feature (`machines` came from .customDashboardView2 service)
            // const weeklyTopPerformers = await machineLogsService.getWeeklyTopPerformers({
            //     workspaceId,
            //     machineIds: machines.map(machine => machine._id),
            // });

            const isOverviewScreen = screen === CUSTOM_DASHBOARD_2_SCREEN.OVERVIEW;
            const isAttentionScreen = screen === CUSTOM_DASHBOARD_2_SCREEN.ATTENTION;
            const validLogs = machineLogs.filter(log => log?.machineId?._id);
            const now = moment();

            const data = {
                group: {
                    _id: group._id,
                    name: group.groupName,
                },
            };

            const attentionRows = validLogs.map(log => ({
                machineCode: log.machineId.machineCode,
                machineId: log.machineId._id,
            }));

            await machineAttentionService.attachAttentionGroups(attentionRows, validLogs, workspaceId);
            const attentionByCode = attentionRows.reduce((acc, row) => {
                acc[row.machineCode] = {
                    attentiongroup: row.attentiongroup,
                    attentionReasons: row.attentionReasons || [],
                };
                return acc;
            }, {});

            const shiftCounts = {};
            let efficiencySum = 0;
            let efficiencyCount = 0;
            const running = [];
            const longStoppedMachines = [];
            const efficiencyBuckets = emptyEfficiencyBuckets();
            const logsByAttentionGroup = {};
            const longStopThresholdSec = LONG_STOPPED_MIN_MINUTES * 60;

            for (const log of validLogs) {
                const rawEfficiency = Number(log.efficiencyPercent);
                const hasEfficiency = Number.isFinite(rawEfficiency);
                const efficiency = hasEfficiency ? toOneDecimal(rawEfficiency) : 0;

                if (Number.isInteger(log.shift)) {
                    shiftCounts[log.shift] = (shiftCounts[log.shift] || 0) + 1;
                }
                if (hasEfficiency && rawEfficiency > 0) {
                    efficiencySum += rawEfficiency;
                    efficiencyCount += 1;
                }

                const machine = log.machineId;
                const machineId = String(machine._id);
                const machineCode = machine.machineCode;

                if (isAttentionScreen) {
                    const attentionKey = attentionByCode[machineCode]?.attentiongroup || 'good';
                    (logsByAttentionGroup[attentionKey] ??= []).push(log);
                }

                if (isOverviewScreen) {
                    efficiencyBuckets[getEfficiencyBucketKey(hasEfficiency ? rawEfficiency : 0)].machines.push({
                        machineId,
                        machineCode,
                        efficiency,
                    });

                    const isRunning = Number(log.stop) === 0;
                    if (isRunning) {
                        running.push({
                            machineId,
                            machineCode,
                            efficiency,
                            attentionReasons: attentionByCode[machineCode]?.attentionReasons || [],
                        });
                    } else {
                        const lastStopTime = machine.lastStopTime || log.lastStopTime;
                        if (lastStopTime) {
                            const stopDurationSeconds = Math.max(0, now.diff(moment(lastStopTime), 'seconds'));
                            if (stopDurationSeconds >= longStopThresholdSec) {
                                longStoppedMachines.push({
                                    machineId,
                                    machineCode,
                                    stopMinutes: Math.floor(stopDurationSeconds / 60),
                                    stopReason: machineLogsService.getStopReason(log.stop, machine.displayType),
                                });
                            }
                        }
                    }
                }
            }

            const shiftValue = Object.entries(shiftCounts).reduce(
                (acc, [shift, count]) => (count > acc.maxCount ? { value: Number(shift), maxCount: count } : acc),
                { value: global.config.SHIFT_TYPE.DAY, maxCount: 0 }
            ).value;
            data.shift = {
                name: getShiftName(shiftValue),
            };
            data.overallEfficiency = efficiencyCount ? toOneDecimal(efficiencySum / efficiencyCount) : 0;

            if (isOverviewScreen) {
                for (const bucket of Object.values(efficiencyBuckets)) {
                    bucket.machines.sort((a, b) => b.efficiency - a.efficiency);
                    bucket.count = bucket.machines.length;
                }

                running.sort((a, b) => b.efficiency - a.efficiency);
                data.topRunningMachines = running.slice(0, 5).map(({ machineId, machineCode, efficiency }) => ({
                    machineId,
                    machineCode,
                    efficiency,
                }));

                data.needsAttentionMachines = [...running].sort((a, b) => a.efficiency - b.efficiency).slice(0, 5)
                    .map(({ machineId, machineCode, efficiency, attentionReasons }) => {
                        const attentionReason = toTvAttentionReason(attentionReasons);
                        return {
                            machineId,
                            machineCode,
                            efficiency,
                            ...(attentionReason ? { attentionReason } : {}),
                        };
                    });

                data.longStoppedMachines = longStoppedMachines;
                data.efficiencyBuckets = efficiencyBuckets;
            }

            if (isAttentionScreen) {
                data.attentionBoard = ATTENTION_BOARD_GROUPS.map(def => {
                    const groupMachines = (logsByAttentionGroup[def.key] || []).map(log =>
                        buildAttentionBoardMachine(log, attentionByCode[log.machineId.machineCode])
                    );
                    return {
                        key: def.key,
                        label: def.label,
                        machines: groupMachines,
                        ...computeGroupMetrics(groupMachines),
                    };
                });
            }

            data.totalMachines = validLogs.length;
            data.generatedAt = new Date().toISOString();

            return res.ok(data, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },
}