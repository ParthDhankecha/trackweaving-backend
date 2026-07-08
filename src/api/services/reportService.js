const moment = require('moment');
const machineService = require('./machineService');
const machineLogsService = require('./machineLogsService');

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

        const machines = await machineService.find(
            { _id: { $in: machineIds }, workspaceId },
            { projection: { machineCode: 1, machineType: 1 }, useLean: true }
        );

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
        const totalNumbers = {
            totalPicks: 0,
            totalEfficiency: 0,
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
                    prodMeter: 0,
                    avgPicks: 0
                };
            }

            const machine = machines.find(m => m._id.toString() === data.machineId.toString());
            data.machineCode = machine?.machineCode || '';
            data.machineType = machine?.machineType || 'rapier';
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

            if(data.machineType === 'rapier') {
                const runTime = data.runTime?.split(':') || [];
                if (runTime.length > 1) {
                    let runMins = parseInt(runTime[0]) * 60 + parseInt(runTime[1]);
                    runMins -= Math.floor(totalStopDuration / 60);
                    data.runTime = `${Math.floor(runMins / 60).toString().padStart(2, '0')}:${(runMins % 60).toString().padStart(2, '0')}`;
                }
            }

            finalData[reportDate][shiftKey].list.push(data);
            finalData[reportDate][shiftKey].totalPicks += data.picksCurrentShift || 0;
            finalData[reportDate][shiftKey].efficiency += data.efficiencyPercent || 0;
            finalData[reportDate][shiftKey].prodMeter += data.pieceLengthM || 0;
        }

        const parsedData = [];
        for (const date in finalData) {
            if (finalData[date].dayShift) {
                finalData[date].dayShift.avgPicks = finalData[date].dayShift.list.length
                    ? Math.round(finalData[date].dayShift.totalPicks / finalData[date].dayShift.list.length)
                    : 0;
                finalData[date].dayShift.efficiency = finalData[date].dayShift.list.length
                    ? Math.round(finalData[date].dayShift.efficiency / finalData[date].dayShift.list.length)
                    : 0;
                totalNumbers.totalPicks += finalData[date].dayShift.totalPicks;
                totalNumbers.totalEfficiency += finalData[date].dayShift.efficiency;
                totalNumbers.totalProdMeter += finalData[date].dayShift.prodMeter;
                totalNumbers.avgCount += 1;
                totalNumbers.avgPicks = finalData[date].dayShift.avgPicks;
            }
            if (finalData[date].nightShift) {
                finalData[date].nightShift.avgPicks = finalData[date].nightShift.list.length
                    ? Math.round(finalData[date].nightShift.totalPicks / finalData[date].nightShift.list.length)
                    : 0;
                finalData[date].nightShift.efficiency = finalData[date].nightShift.list.length
                    ? Math.round(finalData[date].nightShift.efficiency / finalData[date].nightShift.list.length)
                    : 0;
                totalNumbers.totalPicks += finalData[date].nightShift.totalPicks;
                totalNumbers.totalEfficiency += finalData[date].nightShift.efficiency;
                totalNumbers.totalProdMeter += finalData[date].nightShift.prodMeter;
                totalNumbers.avgCount += 1;
                totalNumbers.avgPicks = finalData[date].nightShift.avgPicks;
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
            avgProdMeter: totalNumbers.totalProdMeter,
            avgPicks: Math.round((totalNumbers.avgPicks / totalNumbers.avgCount) || 0)
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
            avgProdMeter: reportData.avgProdMeter,
            avgPicks: reportData.avgPicks,
            shiftLabel,
            stopColumns: getStopColumnsForTypes([...machineTypes])
        };
    }
};
