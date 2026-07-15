const moment = require('moment');
const machineService = require('./machineService');
const machineLogsService = require('./machineLogsService');
const workspaceService = require('./workspaceService');

const STOP_KEY_LABELS = {
    warp: 'Warp',
    weft: 'Weft',
    feeder: 'Feeder',
    manual: 'Manual',
    other: 'Other',
    h1: 'H1',
    h2: 'H2'
};

const STOP_KEY_ORDER = ['h1', 'h2', 'warp', 'weft', 'feeder', 'manual', 'other'];

function getStopColumnsForTypes(types = []) {
    const keys = new Set();
    types.forEach(type => {
        (global.config.MACHINE_TYPE_KEY_MAPPING[type] || global.config.MACHINE_TYPE_KEY_MAPPING.rapier).forEach(key => keys.add(key));
    });
    return STOP_KEY_ORDER
        .filter(key => keys.has(key))
        .map(key => ({ key, label: STOP_KEY_LABELS[key] || key }));
}

function hasStopKey(machineType, key) {
    const keys = global.config.MACHINE_TYPE_KEY_MAPPING[machineType] || global.config.MACHINE_TYPE_KEY_MAPPING.rapier;
    return keys.includes(key);
}

function formatDurationSeconds(totalSeconds = 0) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function formatStopDurationSeconds(totalSeconds = 0) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function parseDurationToMinutes(value = '') {
    const parts = String(value || '').split(':').map(part => parseInt(part, 10));
    if (parts.length < 2 || parts.slice(0, 2).some(Number.isNaN)) return 0;
    return Math.max(0, (parts[0] * 60) + parts[1]);
}

function getShiftWindow(shiftDate, shiftConfig = {}) {
    if (!shiftConfig?.startTime || !shiftConfig?.endTime) {
        return null;
    }
    const [startHour = 0, startMinute = 0] = String(shiftConfig.startTime).split(':').map(Number);
    const [endHour = 0, endMinute = 0] = String(shiftConfig.endTime).split(':').map(Number);
    if ([startHour, startMinute, endHour, endMinute].some(Number.isNaN)) {
        return null;
    }
    const start = moment(shiftDate).startOf('day').hour(startHour).minute(startMinute).second(0).millisecond(0);
    let end = moment(shiftDate).startOf('day').hour(endHour).minute(endMinute).second(0).millisecond(0);
    if (!end.isAfter(start)) {
        end.add(1, 'day');
    }
    return { start, end };
}

/**
 * Denominator for real efficiency:
 * - Today only (shiftDate === today) and still running → currentTime - startTime
 * - All other dates / completed shifts → endTime - startTime from workspace
 */
function getAvailableShiftMinutes(shiftDate, shiftKey, workspace) {
    let now = moment().add(330, 'minutes');
    const shiftConfig = workspace?.[shiftKey];
    const window = getShiftWindow(shiftDate, shiftConfig);
    if (!window) return null;

    const fullMinutes = window.end.diff(window.start, 'minutes');
    if (fullMinutes <= 0) return null;
    const isToday = moment(shiftDate).startOf('day').isSame(now.clone().startOf('day'));
    if (!isToday) {
        return fullMinutes;
    }

    if (now.isBefore(window.start)) {
        return 0;
    }
    if (now.isBefore(window.end)) {
        return now.diff(window.start, 'minutes');
    }
    return fullMinutes;
}

function calculateRealEfficiencyPercent(runTime, availableMinutes) {
    if (!availableMinutes || availableMinutes <= 0) return 0;
    const runMinutes = parseDurationToMinutes(runTime);
    const value = (runMinutes / availableMinutes) * 100;
    if (!Number.isFinite(value) || value < 0) return 0;
    return Math.min(100, Math.round(value * 10) / 10);
}

const STOP_CATEGORY_CODE = {
    warp: 1,
    weft: 2,
    feeder: 7,
    manual: 4,
    h1: 8,
    h2: 9
};

const ALL_STOP_DATA_KEYS = ['h1', 'h2', 'warp', 'weft', 'feeder', 'manual', 'other'];

function getStopReasonForEvent(category, stopEvent, displayType) {
    const stopCode = category === 'other'
        ? stopEvent.statusCode
        : (stopEvent.statusCode ?? STOP_CATEGORY_CODE[category]);
    if (stopCode == null) {
        return STOP_KEY_LABELS[category] || category;
    }
    return machineLogsService.getStopReason(stopCode, displayType);
}

module.exports = {
    STOP_KEY_LABELS,
    getStopColumnsForTypes,
    hasStopKey,

    async generateProductionShiftWiseReport({ workspaceId, machineIds, startDate, endDate, shift }) {
        if (!Array.isArray(machineIds) || machineIds.length === 0) {
            throw global.config.message.BAD_REQUEST;
        }

        const shiftFilter = Array.isArray(shift) ? shift : [shift];
        const condition = {
            machineId: { $in: machineIds },
            workspaceId,
            shiftDate: {
                $gte: moment(new Date(startDate).toISOString()).startOf('day'),
                $lte: moment(new Date(endDate).toISOString()).endOf('day')
            },
            shift: { $in: shiftFilter }
        };

        const [machines, workspace] = await Promise.all([
            machineService.find(
                { _id: { $in: machineIds }, workspaceId },
                { projection: { machineCode: 1, machineType: 1, quality: 1 }, useLean: true }
            ),
            workspaceService.findOne(
                { _id: workspaceId },
                { projection: { dayShift: 1, nightShift: 1 }, useLean: true }
            )
        ]);

        const reportData = await machineLogsService.find(condition, {
            projection: {
                rawData: false,
                workspaceId: false,
                lastStopTime: false,
                lastStartTime: false,
                picksTotal: false,
                setPicks: false,
                stop: false,
                alarmsActive: false,
                loomStateCode: false,
                isDeleted: false
            },
            sort: { machineId: 1 },
            useLean: true
        });

        const finalData = {};
        const availableMinutesCache = {};
        const totalNumbers = {
            totalPicks: 0,
            totalEfficiency: 0,
            totalRealEfficiency: 0,
            totalProdMeter: 0,
            avgPicks: 0,
            avgCount: 0
        };

        for (const data of reportData) {
            const reportDate = moment(data.shiftDate).startOf('day').toISOString();
            if (!finalData[reportDate]) {
                finalData[reportDate] = {};
            }

            const shiftKey = data.shift === global.config.SHIFT_TYPE.DAY ? 'dayShift' : 'nightShift';
            if (!finalData[reportDate][shiftKey]) {
                finalData[reportDate][shiftKey] = {
                    list: [],
                    totalPicks: 0,
                    efficiency: 0,
                    realEfficiency: 0,
                    prodMeter: 0,
                    avgPicks: 0
                };
            }

            const machine = machines.find(m => m._id.toString() === data.machineId.toString());
            data.machineCode = machine?.machineCode || '';
            data.machineType = machine?.machineType || 'rapier';
            data.quality = machine?.quality || '';
            data.stopsData = {};

            let totalStopCount = 0;
            let totalStopDuration = 0;
            const stopKeys = global.config.MACHINE_TYPE_KEY_MAPPING[data.machineType] || global.config.MACHINE_TYPE_KEY_MAPPING.rapier;

            for (const key of stopKeys) {
                data.stopsData[key] = {
                    count: data.stopsCount[key]?.count || 0,
                    duration: formatDurationSeconds(data.stopsCount[key]?.duration || 0)
                };
                totalStopCount += data.stopsData[key].count || 0;
                totalStopDuration += data.stopsCount[key]?.duration || 0;
            }

            data.stopsData.total = {
                count: totalStopCount,
                duration: formatDurationSeconds(totalStopDuration)
            };
            delete data.stopsCount;

            if (data.machineType === 'rapier') {
                const runTime = data.runTime?.split(':') || [];
                if (runTime.length > 1) {
                    let runMins = parseInt(runTime[0]) * 60 + parseInt(runTime[1]);
                    runMins -= Math.floor(totalStopDuration / 60);
                    data.runTime = `${Math.floor(runMins / 60).toString().padStart(2, '0')}:${(runMins % 60).toString().padStart(2, '0')}`;
                }
            }

            const cacheKey = `${reportDate}|${shiftKey}`;
            if (!(cacheKey in availableMinutesCache)) {
                availableMinutesCache[cacheKey] = getAvailableShiftMinutes(data.shiftDate, shiftKey, workspace);
            }
            data.realEfficiencyPercent = calculateRealEfficiencyPercent(data.runTime, availableMinutesCache[cacheKey]);

            finalData[reportDate][shiftKey].list.push(data);
            finalData[reportDate][shiftKey].totalPicks += data.picksCurrentShift || 0;
            finalData[reportDate][shiftKey].efficiency += data.efficiencyPercent || 0;
            finalData[reportDate][shiftKey].realEfficiency += data.realEfficiencyPercent || 0;
            finalData[reportDate][shiftKey].prodMeter += data.pieceLengthM || 0;
        }

        const parsedData = [];
        for (const date in finalData) {
            if (finalData[date].dayShift) {
                const dayShift = finalData[date].dayShift;
                const dayCount = dayShift.list.length;
                dayShift.avgPicks = dayCount ? Math.round(dayShift.totalPicks / dayCount) : 0;
                dayShift.efficiency = dayCount ? Math.round(dayShift.efficiency / dayCount) : 0;
                dayShift.realEfficiency = dayCount ? Math.round((dayShift.realEfficiency / dayCount) * 10) / 10 : 0;
                totalNumbers.totalPicks += dayShift.totalPicks;
                totalNumbers.totalEfficiency += dayShift.efficiency;
                totalNumbers.totalRealEfficiency += dayShift.realEfficiency;
                totalNumbers.totalProdMeter += dayShift.prodMeter;
                totalNumbers.avgCount += 1;
                totalNumbers.avgPicks = dayShift.avgPicks;
            }
            if (finalData[date].nightShift) {
                const nightShift = finalData[date].nightShift;
                const nightCount = nightShift.list.length;
                nightShift.avgPicks = nightCount ? Math.round(nightShift.totalPicks / nightCount) : 0;
                nightShift.efficiency = nightCount ? Math.round(nightShift.efficiency / nightCount) : 0;
                nightShift.realEfficiency = nightCount ? Math.round((nightShift.realEfficiency / nightCount) * 10) / 10 : 0;
                totalNumbers.totalPicks += nightShift.totalPicks;
                totalNumbers.totalEfficiency += nightShift.efficiency;
                totalNumbers.totalRealEfficiency += nightShift.realEfficiency;
                totalNumbers.totalProdMeter += nightShift.prodMeter;
                totalNumbers.avgCount += 1;
                totalNumbers.avgPicks = nightShift.avgPicks;
            }
            parsedData.push({
                reportDate: date,
                reportData: finalData[date]
            });
        }

        return {
            list: parsedData,
            totalPicks: totalNumbers.totalPicks,
            totalEfficiency: Math.round((totalNumbers.totalEfficiency / totalNumbers.avgCount) || 0),
            totalRealEfficiency: Math.round(((totalNumbers.totalRealEfficiency / totalNumbers.avgCount) || 0) * 10) / 10,
            avgProdMeter: totalNumbers.totalProdMeter,
            avgPicks: Math.round((totalNumbers.avgPicks / totalNumbers.avgCount) || 0)
        };
    },

    async generateStoppageReport({ workspaceId, machineIds, startDate, endDate, shift, minStopMinutes }) {
        if (!Array.isArray(machineIds) || machineIds.length === 0) {
            throw global.config.message.BAD_REQUEST;
        }
        if (!minStopMinutes || minStopMinutes <= 0) {
            throw global.config.message.BAD_REQUEST;
        }

        const shiftFilter = Array.isArray(shift) ? shift : [shift];
        const minStopSeconds = minStopMinutes * 60;
        const condition = {
            machineId: { $in: machineIds },
            workspaceId,
            shiftDate: {
                $gte: moment(new Date(startDate).toISOString()).startOf('day'),
                $lte: moment(new Date(endDate).toISOString()).endOf('day')
            },
            shift: { $in: shiftFilter }
        };

        const machines = await machineService.find(
            { _id: { $in: machineIds }, workspaceId },
            { projection: { machineCode: 1, displayType: 1 }, useLean: true }
        );

        const reportData = await machineLogsService.find(condition, {
            projection: {
                machineId: 1,
                shift: 1,
                shiftDate: 1,
                stopsData: 1
            },
            sort: { shiftDate: 1, machineId: 1 },
            useLean: true
        });

        const list = [];
        for (const log of reportData) {
            const machine = machines.find(m => m._id.toString() === log.machineId.toString());
            const displayType = machine?.displayType || 'nazon';
            const machineCode = machine?.machineCode || '';
            const shiftLabel = log.shift === global.config.SHIFT_TYPE.DAY ? 'Day Shift' : 'Night Shift';
            const reportDate = moment(log.shiftDate).startOf('day').toISOString();
            const stopsData = log.stopsData || {};

            for (const key of ALL_STOP_DATA_KEYS) {
                for (const stop of stopsData[key] || []) {
                    const duration = stop.duration || 0;
                    if (duration < minStopSeconds) continue;

                    list.push({
                        reportDate,
                        machineCode,
                        machineId: log.machineId,
                        shift: log.shift,
                        shiftLabel,
                        stopReason: getStopReasonForEvent(key, stop, displayType),
                        from: stop.start,
                        to: stop.end,
                        stopTime: formatStopDurationSeconds(duration)
                    });
                }
            }
        }

        list.sort((a, b) => {
            const dateCompare = new Date(a.reportDate) - new Date(b.reportDate);
            if (dateCompare !== 0) return dateCompare;
            if (a.shift !== b.shift) return a.shift - b.shift;
            const machineCompare = (a.machineCode || '').localeCompare(b.machineCode || '');
            if (machineCompare !== 0) return machineCompare;
            return new Date(a.from || 0) - new Date(b.from || 0);
        });

        return {
            list,
            totalStops: list.length
        };
    },

    async generateBeamLeftReport({ workspaceId, machineIds, startDate, endDate }) {
        if (!Array.isArray(machineIds) || machineIds.length === 0) {
            throw global.config.message.BAD_REQUEST;
        }

        const rangeStart = moment(new Date(startDate).toISOString()).startOf('day').toDate();
        const rangeEnd = moment(new Date(endDate).toISOString()).endOf('day').toDate();

        const [machines, beamRecords] = await Promise.all([
            machineService.find(
                { _id: { $in: machineIds }, workspaceId },
                { projection: { machineCode: 1, machineName: 1 }, useLean: true }
            ),
            beamLeftModel.find({
                machineId: { $in: machineIds },
                workspaceId,
                isDeleted: false,
                startDate: { $gte: rangeStart, $lte: rangeEnd }
            }).sort({ startDate: 1, machineId: 1 }).lean()
        ]);

        const machineMap = {};
        machines.forEach(m => {
            machineMap[m._id.toString()] = m;
        });

        const list = beamRecords.map(record => {
            const machine = machineMap[record.machineId?.toString()] || {};
            const shiftVal = Number(record.shift);
            return {
                machineName: `${machine.machineName || ''} (${machine.machineCode || '-'})`,
                startDate: record.startDate,
                shift: shiftVal === global.config.SHIFT_TYPE.NIGHT ? 'Night Shift' : 'Day Shift',
                endDate: record.endDate || null,
                quality: record.quality || '',
                beamLength: record.beamLength ?? null,
                productionMtr: record.productionMtr ?? null
            };
        });

        return {
            list,
            totalRecords: list.length,
            totalProductionMtr: list.reduce((sum, row) => sum + (row.productionMtr || 0), 0)
        };
    },

    flattenReportForExport(reportData, shiftType) {
        const shiftKey = shiftType === global.config.SHIFT_TYPE.DAY ? 'dayShift' : 'nightShift';
        const shiftLabel = shiftType === global.config.SHIFT_TYPE.DAY ? 'Day Shift' : 'Night Shift';
        const list = [];

        for (const item of reportData.list || []) {
            const shiftData = item.reportData?.[shiftKey];
            if (shiftData) {
                list.push({
                    ...shiftData,
                    reportDate: item.reportDate,
                    shiftLabel
                });
            }
        }

        const machineTypes = new Set();
        list.forEach(item => {
            (item.list || []).forEach(row => machineTypes.add(row.machineType || 'rapier'));
        });

        return {
            list,
            totalPicks: reportData.totalPicks,
            totalEfficiency: reportData.totalEfficiency,
            totalRealEfficiency: reportData.totalRealEfficiency,
            avgProdMeter: reportData.avgProdMeter,
            avgPicks: reportData.avgPicks,
            shiftLabel,
            stopColumns: getStopColumnsForTypes([...machineTypes])
        };
    }
};
