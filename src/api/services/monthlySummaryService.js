const moment = require('moment');

const machineService = require('./machineService');
const machineLogsService = require('./machineLogsService');
const workspaceService = require('./workspaceService');
const reportService = require('./reportService');
const { getActionableStopStats, getActionableLongStopSeconds } = require('./reportRules');

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const STOP_REASON_LABELS = {
    weft: 'Weft Stop',
    warp: 'Warp Stop',
    feeder: 'Feeder Stop',
    manual: 'Other / Manual',
    other: 'Machine Error',
    h1: 'H1 Stop',
    h2: 'H2 Stop'
};

const STOP_REASON_ORDER = ['weft', 'warp', 'feeder', 'manual', 'other', 'h1', 'h2'];
const LONG_STOP_SECONDS = 10 * 60;

const LOG_PROJECTION = {
    rawData: 0,
    workspaceId: 0,
    lastStopTime: 0,
    lastStartTime: 0,
    picksTotal: 0,
    stop: 0,
    loomStateCode: 0,
    isDeleted: 0,
    alarmsActive: 0,
    quality: 0,
    operatorId: 0,
    beamLeft: 0,
    beamCompletionDate: 0,
    powerOff: 0
};

function monthLabel(year, month) {
    return `${MONTH_NAMES[month - 1]} ${year}`;
}

function previousMonth(year, month) {
    if (month === 1) return { year: year - 1, month: 12 };
    return { year, month: month - 1 };
}

function round1(value) {
    return Math.round((Number(value) || 0) * 10) / 10;
}

function formatIndianNumber(value, fractionDigits = 0) {
    const abs = Math.abs(Number(value) || 0);
    const [intPart, decPart] = abs.toFixed(fractionDigits).split('.');
    const lastThree = intPart.slice(-3);
    const other = intPart.slice(0, -3);
    const formatted = other
        ? `${other.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${lastThree}`
        : lastThree;
    const sign = value < 0 ? '-' : '';
    return fractionDigits > 0 ? `${sign}${formatted}.${decPart}` : `${sign}${formatted}`;
}

function formatMeters(value) {
    return `${formatIndianNumber(Math.round(value || 0))} m`;
}

function formatPicksCompact(picks) {
    const value = Number(picks) || 0;
    if (value >= 1e7) return `${(value / 1e7).toFixed(2)} Cr`;
    if (value >= 1e5) return `${(value / 1e5).toFixed(2)} L`;
    return formatIndianNumber(value);
}

function formatHoursMinutes(totalMinutes) {
    const rounded = Math.round(totalMinutes || 0);
    const hours = Math.floor(rounded / 60);
    const minutes = rounded % 60;
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return hours >= 1000 ? `${formatIndianNumber(hours)}h` : `${hours}h`;
    return `${hours >= 1000 ? formatIndianNumber(hours) : hours}h ${minutes}m`;
}

function formatPercent(value, fractionDigits = 1) {
    return `${round1(value).toFixed(fractionDigits)}%`;
}

function formatChangeLabel(percentChange) {
    const change = Number(percentChange) || 0;
    if (change === 0) return '→ 0.0%';
    const arrow = change > 0 ? '↑' : '↓';
    return `${arrow} ${Math.abs(change).toFixed(1)}%`;
}

function percentChange(current, previous) {
    if (!previous) return 0;
    return ((current - previous) / previous) * 100;
}

function classifyPerformance(efficiency) {
    if (efficiency >= 90) return 'excellent';
    if (efficiency >= 80) return 'good';
    if (efficiency >= 70) return 'average';
    return 'needsAttention';
}

function emptyKpis() {
    return {
        totalProductionMeters: 0,
        overallEfficiency: 0,
        totalPicks: 0,
        totalDowntimeMinutes: 0,
        averageRpm: 0,
        runningTimeHours: 0,
        utilizationPercent: 0
    };
}

function factoryNow() {
    return moment().utcOffset('+05:30');
}

function getPeriodWindow(year, month) {
    const now = factoryNow();
    const y = Number(year);
    const m = Number(month);
    const daysInMonth = moment({ year: y, month: m - 1, day: 1 }).daysInMonth();
    const isCurrentMonth = now.format('YYYY-MM') === `${y}-${String(m).padStart(2, '0')}`;
    const elapsedDays = isCurrentMonth ? Math.min(now.date(), daysInMonth) : daysInMonth;
    return { isCurrentMonth, isPartial: isCurrentMonth && elapsedDays < daysInMonth, elapsedDays, daysInMonth };
}

function percentChangeByAverage(currentTotal, previousTotal, currentDays, previousDays) {
    const currentAvg = (Number(currentTotal) || 0) / Math.max(Number(currentDays) || 1, 1);
    const previousAvg = (Number(previousTotal) || 0) / Math.max(Number(previousDays) || 1, 1);
    return percentChange(currentAvg, previousAvg);
}

function monthRange(year, month, throughDay = null) {
    const start = moment({ year, month: month - 1, day: 1 }).startOf('day');
    const lastDay = Math.min(throughDay || start.daysInMonth(), start.daysInMonth());
    const end = moment({ year, month: month - 1, day: lastDay }).endOf('day');
    return {
        start: start.toDate(),
        end: end.toDate(),
        days: lastDay
    };
}

function periodLabel(year, month, { isPartial, elapsedDays } = {}) {
    const label = monthLabel(year, month);
    if (isPartial && elapsedDays) {
        return `${label} (1–${elapsedDays})`;
    }
    return label;
}

function dailyAverageKpis(kpis, days) {
    const d = Math.max(Number(days) || 1, 1);
    return {
        totalProductionMeters: kpis.totalProductionMeters / d,
        overallEfficiency: kpis.overallEfficiency,
        totalPicks: kpis.totalPicks / d,
        totalDowntimeMinutes: kpis.totalDowntimeMinutes / d,
        averageRpm: kpis.averageRpm,
        runningTimeHours: kpis.runningTimeHours / d,
        utilizationPercent: kpis.utilizationPercent
    };
}

function stopKeysForMachine(machineType) {
    return global.config.MACHINE_TYPE_KEY_MAPPING[machineType]
        || global.config.MACHINE_TYPE_KEY_MAPPING.rapier;
}

function machineDisplayName(machine) {
    return machine?.machineCode || 'Machine';
}

function sumStopDuration(stopsCount = {}, stopKeys = []) {
    return stopKeys.reduce((sum, key) => sum + (Number(stopsCount[key]?.duration) || 0), 0);
}

function topStopReason(stopsCount = {}, stopKeys = []) {
    let bestKey = '';
    let bestDuration = 0;
    for (const key of stopKeys) {
        const duration = Number(stopsCount[key]?.duration) || 0;
        if (duration > bestDuration) {
            bestDuration = duration;
            bestKey = key;
        }
    }
    return bestKey ? (STOP_REASON_LABELS[bestKey] || bestKey) : '';
}

function longStopSeconds(stopsData = {}, stopKeys = []) {
    let total = 0;
    for (const key of stopKeys) {
        const events = stopsData[key] || [];
        for (const event of events) {
            const duration = Number(event?.duration) || 0;
            if (duration >= LONG_STOP_SECONDS) total += duration;
        }
    }
    return total;
}

function processLogs(logs, machineMap, workspace) {
    const availableMinutesCache = {};
    const dailyMap = {};
    const machineAgg = {};
    const shiftAgg = {
        0: { productionMeters: 0, efficiencySum: 0, efficiencyCount: 0, downtimeSeconds: 0, rpmSum: 0, rpmCount: 0 },
        1: { productionMeters: 0, efficiencySum: 0, efficiencyCount: 0, downtimeSeconds: 0, rpmSum: 0, rpmCount: 0 }
    };
    const reasonAgg = {};
    let totalProduction = 0;
    let totalPicks = 0;
    let totalDowntimeSeconds = 0;
    let longStopsSeconds = 0;
    let efficiencySum = 0;
    let efficiencyCount = 0;
    let rpmSum = 0;
    let rpmCount = 0;
    let runMinutes = 0;
    let availableMinutes = 0;

    for (const log of logs) {
        const machineId = String(log.machineId);
        const machine = machineMap[machineId];
        const machineType = machine?.machineType || 'rapier';
        const stopKeys = stopKeysForMachine(machineType);
        const production = reportService.calculatePannaWithPieceLengthM(log.pieceLengthM, machine?.panna) || 0;
        const picks = Number(log.picksCurrentShift) || 0;
        const efficiency = Number(log.efficiencyPercent) || 0;
        const rpm = reportService.resolveDisplaySpeedRpm(log);
        const stopStats = getActionableStopStats(log, stopKeys);
        const downtimeSeconds = stopStats.durationSeconds;
        const rawDowntimeSeconds = sumStopDuration(log.stopsCount, stopKeys);
        const shiftKey = log.shift === global.config.SHIFT_TYPE.DAY ? 'dayShift' : 'nightShift';
        const reportDate = moment(log.shiftDate).startOf('day').toISOString();
        const dayKey = moment(log.shiftDate).format('YYYY-MM-DD');

        let runTime = log.runTime;
        if (machineType === 'rapier' && runTime) {
            const parts = String(runTime).split(':');
            if (parts.length > 1) {
                let mins = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
                mins -= Math.floor(downtimeSeconds / 60);
                runTime = `${Math.max(0, Math.floor(mins / 60)).toString().padStart(2, '0')}:${Math.max(0, mins % 60).toString().padStart(2, '0')}`;
            }
        }

        const cacheKey = `${reportDate}|${shiftKey}`;
        if (!(cacheKey in availableMinutesCache)) {
            availableMinutesCache[cacheKey] = reportService.getAvailableShiftMinutes(log.shiftDate, shiftKey, workspace) || 0;
        }
        const logRunMinutes = reportService.parseDurationToMinutes(runTime);
        const logAvailableMinutes = availableMinutesCache[cacheKey];

        totalProduction += production;
        totalPicks += picks;
        totalDowntimeSeconds += downtimeSeconds;
        longStopsSeconds += getActionableLongStopSeconds(log, log.stopsData, stopKeys, LONG_STOP_SECONDS);
        runMinutes += logRunMinutes;
        availableMinutes += logAvailableMinutes;
        if (efficiency > 0) {
            efficiencySum += efficiency;
            efficiencyCount += 1;
        }
        if (rpm > 0) {
            rpmSum += rpm;
            rpmCount += 1;
        }

        if (!dailyMap[dayKey]) {
            dailyMap[dayKey] = {
                date: dayKey,
                day: Number(dayKey.slice(-2)),
                productionMeters: 0,
                efficiencySum: 0,
                efficiencyCount: 0,
                rpmSum: 0,
                rpmCount: 0,
                downtimeMinutes: 0
            };
        }
        dailyMap[dayKey].productionMeters += production;
        dailyMap[dayKey].downtimeMinutes += Math.round(downtimeSeconds / 60);
        if (efficiency > 0) {
            dailyMap[dayKey].efficiencySum += efficiency;
            dailyMap[dayKey].efficiencyCount += 1;
        }
        if (rpm > 0) {
            dailyMap[dayKey].rpmSum += rpm;
            dailyMap[dayKey].rpmCount += 1;
        }

        if (!machineAgg[machineId]) {
            machineAgg[machineId] = {
                id: machineId,
                name: machineDisplayName(machine),
                productionMeters: 0,
                efficiencySum: 0,
                efficiencyCount: 0,
                rpmSum: 0,
                rpmCount: 0,
                runningTimeMinutes: 0,
                downtimeMinutes: 0,
                rawDowntimeMinutes: 0,
                stopDurations: {}
            };
        }
        const machineRow = machineAgg[machineId];
        machineRow.productionMeters += production;
        machineRow.runningTimeMinutes += logRunMinutes;
        machineRow.downtimeMinutes += Math.round(downtimeSeconds / 60);
        machineRow.rawDowntimeMinutes += Math.round(rawDowntimeSeconds / 60);
        if (efficiency > 0) {
            machineRow.efficiencySum += efficiency;
            machineRow.efficiencyCount += 1;
        }
        if (rpm > 0) {
            machineRow.rpmSum += rpm;
            machineRow.rpmCount += 1;
        }

        const shiftBucket = shiftAgg[log.shift] || shiftAgg[0];
        shiftBucket.productionMeters += production;
        shiftBucket.downtimeSeconds += downtimeSeconds;
        if (efficiency > 0) {
            shiftBucket.efficiencySum += efficiency;
            shiftBucket.efficiencyCount += 1;
        }
        if (rpm > 0) {
            shiftBucket.rpmSum += rpm;
            shiftBucket.rpmCount += 1;
        }

        if (stopStats.actionable) {
            for (const key of stopKeys) {
                const count = stopStats.reasons[key]?.count || 0;
                const duration = stopStats.reasons[key]?.durationSeconds || 0;
                if (!reasonAgg[key]) reasonAgg[key] = { occurrences: 0, durationSeconds: 0 };
                reasonAgg[key].occurrences += count;
                reasonAgg[key].durationSeconds += duration;
                machineRow.stopDurations[key] = (machineRow.stopDurations[key] || 0) + duration;
            }
        }
    }

    const kpis = {
        totalProductionMeters: Math.round(totalProduction),
        overallEfficiency: efficiencyCount ? round1(efficiencySum / efficiencyCount) : 0,
        totalPicks,
        totalDowntimeMinutes: Math.round(totalDowntimeSeconds / 60),
        averageRpm: rpmCount ? Math.round(rpmSum / rpmCount) : 0,
        runningTimeHours: Math.round(runMinutes / 60),
        utilizationPercent: availableMinutes ? round1((runMinutes / availableMinutes) * 100) : 0
    };

    return { kpis, dailyMap, machineAgg, shiftAgg, reasonAgg, longStopsSeconds, totalDowntimeSeconds };
}

function buildDailyPerformance(dailyMap, year, month, throughDay = null) {
    const days = throughDay || moment({ year, month: month - 1, day: 1 }).daysInMonth();
    const list = [];
    for (let day = 1; day <= days; day++) {
        const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const row = dailyMap[date];
        list.push({
            date,
            day,
            productionMeters: Math.round(row?.productionMeters || 0),
            efficiency: row?.efficiencyCount ? round1(row.efficiencySum / row.efficiencyCount) : 0,
            averageRpm: row?.rpmCount ? Math.round(row.rpmSum / row.rpmCount) : 0,
            downtimeMinutes: row?.downtimeMinutes || 0
        });
    }
    return list;
}

function buildMachines(machineAgg, machines, factoryEfficiency) {
    const rows = machines.map((machine) => {
        const agg = machineAgg[String(machine._id)] || {
            productionMeters: 0,
            efficiencySum: 0,
            efficiencyCount: 0,
            rpmSum: 0,
            rpmCount: 0,
            runningTimeMinutes: 0,
            downtimeMinutes: 0,
            stopDurations: {}
        };
        const efficiency = agg.efficiencyCount ? round1(agg.efficiencySum / agg.efficiencyCount) : 0;
        const stopKeys = stopKeysForMachine(machine.machineType);
        const topReason = topStopReason(Object.fromEntries(
            Object.entries(agg.stopDurations || {}).map(([key, duration]) => [key, { duration }])
        ), stopKeys);
        const vsAverage = factoryEfficiency
            ? round1(((efficiency - factoryEfficiency) / factoryEfficiency) * 100)
            : 0;

        return {
            id: String(machine._id),
            name: machineDisplayName(machine),
            productionMeters: Math.round(agg.productionMeters || 0),
            efficiency,
            averageRpm: agg.rpmCount ? Math.round(agg.rpmSum / agg.rpmCount) : 0,
            runningTimeMinutes: Math.round(agg.runningTimeMinutes || 0),
            downtimeMinutes: Math.round(agg.downtimeMinutes || 0),
            topStopReason: topReason,
            performance: classifyPerformance(efficiency),
            majorIssue: efficiency < 75 ? topReason : undefined,
            vsFactoryAveragePercent: vsAverage
        };
    }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    const ranked = [...rows].sort((a, b) => b.efficiency - a.efficiency);
    return {
        machines: rows,
        topMachines: ranked.slice(0, 5),
        bottomMachines: [...ranked].reverse().slice(0, 5)
    };
}

function buildShifts(shiftAgg) {
    const shifts = [
        {
            id: 'day',
            name: 'Day Shift',
            productionMeters: Math.round(shiftAgg[0]?.productionMeters || 0),
            efficiency: shiftAgg[0]?.efficiencyCount ? round1(shiftAgg[0].efficiencySum / shiftAgg[0].efficiencyCount) : 0,
            downtimeMinutes: Math.round((shiftAgg[0]?.downtimeSeconds || 0) / 60),
            averageRpm: shiftAgg[0]?.rpmCount ? Math.round(shiftAgg[0].rpmSum / shiftAgg[0].rpmCount) : 0,
            isBest: false
        },
        {
            id: 'night',
            name: 'Night Shift',
            productionMeters: Math.round(shiftAgg[1]?.productionMeters || 0),
            efficiency: shiftAgg[1]?.efficiencyCount ? round1(shiftAgg[1].efficiencySum / shiftAgg[1].efficiencyCount) : 0,
            downtimeMinutes: Math.round((shiftAgg[1]?.downtimeSeconds || 0) / 60),
            averageRpm: shiftAgg[1]?.rpmCount ? Math.round(shiftAgg[1].rpmSum / shiftAgg[1].rpmCount) : 0,
            isBest: false
        }
    ];
    const best = [...shifts].sort((a, b) => b.efficiency - a.efficiency)[0];
    if (best && (best.efficiency > 0 || best.productionMeters > 0)) {
        best.isBest = true;
    }
    return shifts;
}

function buildDowntimeReasons(reasonAgg, totalDowntimeSeconds, estimatedLossMeters) {
    const total = totalDowntimeSeconds || 1;
    return STOP_REASON_ORDER
        .filter((key) => reasonAgg[key] && (reasonAgg[key].durationSeconds > 0 || reasonAgg[key].occurrences > 0))
        .map((key) => {
            const row = reasonAgg[key];
            const durationMinutes = Math.round(row.durationSeconds / 60);
            const downtimePercent = round1((row.durationSeconds / total) * 100);
            return {
                reason: STOP_REASON_LABELS[key] || key,
                occurrences: row.occurrences,
                durationMinutes,
                avgStopSeconds: row.occurrences ? Math.round(row.durationSeconds / row.occurrences) : 0,
                downtimePercent,
                estimatedLossMeters: Math.round(estimatedLossMeters * (row.durationSeconds / total))
            };
        })
        .sort((a, b) => b.durationMinutes - a.durationMinutes);
}

function buildKpiCards(current, previous, options = {}) {
    const compareByAverage = !!options.compareByAverage;
    const vsLabel = compareByAverage ? ' vs last month avg' : ' vs last month';

    const productionChange = compareByAverage
        ? percentChangeByAverage(current.totalProductionMeters, previous.totalProductionMeters, options.currentDays, options.previousDays)
        : percentChange(current.totalProductionMeters, previous.totalProductionMeters);
    const efficiencyChange = round1(current.overallEfficiency - previous.overallEfficiency);
    const picksChange = compareByAverage
        ? percentChangeByAverage(current.totalPicks, previous.totalPicks, options.currentDays, options.previousDays)
        : percentChange(current.totalPicks, previous.totalPicks);
    const downtimeChange = compareByAverage
        ? percentChangeByAverage(current.totalDowntimeMinutes, previous.totalDowntimeMinutes, options.currentDays, options.previousDays)
        : percentChange(current.totalDowntimeMinutes, previous.totalDowntimeMinutes);
    const rpmChange = percentChange(current.averageRpm, previous.averageRpm);

    return [
        {
            key: 'production',
            label: 'Total Production',
            value: formatMeters(current.totalProductionMeters),
            icon: 'production',
            comparison: {
                percentChange: round1(productionChange),
                isPositive: productionChange >= 0,
                label: `${formatChangeLabel(productionChange)}${vsLabel}`
            }
        },
        {
            key: 'efficiency',
            label: 'Overall Efficiency',
            value: formatPercent(current.overallEfficiency),
            icon: 'efficiency',
            comparison: {
                percentChange: efficiencyChange,
                isPositive: efficiencyChange >= 0,
                label: formatChangeLabel(efficiencyChange)
            }
        },
        {
            key: 'picks',
            label: 'Total Picks',
            value: formatPicksCompact(current.totalPicks),
            icon: 'picks',
            comparison: {
                percentChange: round1(picksChange),
                isPositive: picksChange >= 0,
                label: `${formatChangeLabel(picksChange)}${vsLabel}`
            }
        },
        {
            key: 'downtime',
            label: 'Total Downtime',
            value: formatHoursMinutes(current.totalDowntimeMinutes),
            icon: 'downtime',
            comparison: {
                percentChange: round1(downtimeChange),
                isPositive: downtimeChange <= 0,
                label: `${formatChangeLabel(downtimeChange)}${vsLabel}`
            }
        },
        {
            key: 'rpm',
            label: 'Average RPM',
            value: `${current.averageRpm} RPM`,
            icon: 'rpm',
            comparison: {
                percentChange: round1(rpmChange),
                isPositive: rpmChange >= 0,
                label: formatChangeLabel(rpmChange)
            }
        },
        {
            key: 'runtime',
            label: 'Running Time',
            value: formatHoursMinutes(current.runningTimeHours * 60),
            icon: 'runtime',
            subtitle: `${formatPercent(current.utilizationPercent)} utilization`
        }
    ];
}

function buildComparisonRows(current, previous, currentLoss, previousLoss, currentMonth, compareMonth, options = {}) {
    const compareByAverage = !!options.compareByAverage;
    const currentCmp = compareByAverage ? dailyAverageKpis(current, options.currentDays) : current;
    const previousCmp = compareByAverage ? dailyAverageKpis(previous, options.previousDays) : previous;
    const currentLossCmp = compareByAverage ? currentLoss / Math.max(options.currentDays || 1, 1) : currentLoss;
    const previousLossCmp = compareByAverage ? previousLoss / Math.max(options.previousDays || 1, 1) : previousLoss;
    const previousLabel = compareByAverage
        ? `${monthLabel(compareMonth.year, compareMonth.month)} (daily avg)`
        : monthLabel(compareMonth.year, compareMonth.month);
    const currentLabel = periodLabel(currentMonth.year, currentMonth.month, {
        isPartial: compareByAverage,
        elapsedDays: options.currentDays
    });
    const productionUnit = compareByAverage ? ' / day' : '';

    const productionChange = compareByAverage
        ? percentChangeByAverage(current.totalProductionMeters, previous.totalProductionMeters, options.currentDays, options.previousDays)
        : percentChange(current.totalProductionMeters, previous.totalProductionMeters);
    const picksChange = compareByAverage
        ? percentChangeByAverage(current.totalPicks, previous.totalPicks, options.currentDays, options.previousDays)
        : percentChange(current.totalPicks, previous.totalPicks);
    const efficiencyChange = round1(current.overallEfficiency - previous.overallEfficiency);
    const downtimeChange = compareByAverage
        ? percentChangeByAverage(current.totalDowntimeMinutes, previous.totalDowntimeMinutes, options.currentDays, options.previousDays)
        : percentChange(current.totalDowntimeMinutes, previous.totalDowntimeMinutes);
    const rpmChange = percentChange(current.averageRpm, previous.averageRpm);
    const lossChange = compareByAverage
        ? percentChangeByAverage(currentLoss, previousLoss, options.currentDays, options.previousDays)
        : percentChange(currentLoss, previousLoss);

    return [
        {
            metric: compareByAverage ? 'Production (avg/day)' : 'Production',
            previousLabel,
            currentLabel,
            previousValue: `${formatMeters(previousCmp.totalProductionMeters)}${productionUnit}`.trim(),
            currentValue: `${formatMeters(currentCmp.totalProductionMeters)}${productionUnit}`.trim(),
            changePercent: round1(productionChange),
            isPositive: productionChange >= 0
        },
        {
            metric: compareByAverage ? 'Picks (avg/day)' : 'Picks',
            previousLabel,
            currentLabel,
            previousValue: compareByAverage
                ? `${formatPicksCompact(previousCmp.totalPicks)} / day`
                : formatPicksCompact(previous.totalPicks),
            currentValue: compareByAverage
                ? `${formatPicksCompact(currentCmp.totalPicks)} / day`
                : formatPicksCompact(current.totalPicks),
            changePercent: round1(picksChange),
            isPositive: picksChange >= 0
        },
        {
            metric: 'Efficiency',
            previousLabel,
            currentLabel,
            previousValue: formatPercent(previousCmp.overallEfficiency),
            currentValue: formatPercent(currentCmp.overallEfficiency),
            changePercent: efficiencyChange,
            isPositive: efficiencyChange >= 0
        },
        {
            metric: compareByAverage ? 'Downtime (avg/day)' : 'Downtime',
            previousLabel,
            currentLabel,
            previousValue: formatHoursMinutes(previousCmp.totalDowntimeMinutes),
            currentValue: formatHoursMinutes(currentCmp.totalDowntimeMinutes),
            changePercent: round1(downtimeChange),
            isPositive: downtimeChange <= 0
        },
        {
            metric: 'Average RPM',
            previousLabel,
            currentLabel,
            previousValue: String(previousCmp.averageRpm),
            currentValue: String(currentCmp.averageRpm),
            changePercent: round1(rpmChange),
            isPositive: rpmChange >= 0
        },
        {
            metric: compareByAverage ? 'Production Loss (avg/day)' : 'Production Loss',
            previousLabel,
            currentLabel,
            previousValue: `${formatMeters(previousLossCmp)}${productionUnit}`.trim(),
            currentValue: `${formatMeters(currentLossCmp)}${productionUnit}`.trim(),
            changePercent: round1(lossChange),
            isPositive: lossChange <= 0
        }
    ];
}

function buildHighlight(current, previous, estimatedLoss, options = {}) {
    const compareByAverage = !!options.compareByAverage;
    const currentCmp = compareByAverage ? dailyAverageKpis(current, options.currentDays) : current;
    const previousCmp = compareByAverage ? dailyAverageKpis(previous, options.previousDays) : previous;
    const productionChange = compareByAverage
        ? percentChangeByAverage(current.totalProductionMeters, previous.totalProductionMeters, options.currentDays, options.previousDays)
        : percentChange(current.totalProductionMeters, previous.totalProductionMeters);
    const downtimeChange = compareByAverage
        ? percentChangeByAverage(current.totalDowntimeMinutes, previous.totalDowntimeMinutes, options.currentDays, options.previousDays)
        : percentChange(current.totalDowntimeMinutes, previous.totalDowntimeMinutes);
    const productionText = compareByAverage
        ? (productionChange >= 0
            ? `Daily production is ${formatPercent(productionChange)} higher`
            : `Daily production is ${formatPercent(Math.abs(productionChange))} lower`)
        : (productionChange >= 0
            ? `Production increased by ${formatPercent(productionChange)}`
            : `Production decreased by ${formatPercent(Math.abs(productionChange))}`);
    const downtimeText = compareByAverage
        ? (downtimeChange <= 0
            ? `daily downtime is ${formatPercent(Math.abs(downtimeChange))} lower`
            : `daily downtime is ${formatPercent(downtimeChange)} higher`)
        : (downtimeChange <= 0
            ? `downtime reduced by ${formatPercent(Math.abs(downtimeChange))}`
            : `downtime increased by ${formatPercent(downtimeChange)}`);
    const vsText = compareByAverage
        ? "compared to last month's daily average"
        : 'compared to last month';
    const periodText = compareByAverage ? 'So far this month' : 'This month';

    return {
        headline: `${periodText} TrackWeaving identified ${formatHoursMinutes(current.totalDowntimeMinutes)} of downtime and approximately ${formatMeters(estimatedLoss)} of potential production loss.`,
        supporting: `${productionText} while ${downtimeText} ${vsText}.`
    };
}

function buildInsights(current, previous, reasons, bottomMachines, shifts, longStopsPercent, totalDowntimeMinutes, options = {}) {
    if (!current.totalProductionMeters && !current.totalDowntimeMinutes) {
        return [{
            id: 'no-data',
            title: 'No Production Data',
            segments: [
                { text: 'No machine logs were found for the selected month. Confirm machines were running and logs were received.' }
            ]
        }];
    }

    const compareByAverage = !!options.compareByAverage;
    const currentCmp = compareByAverage ? dailyAverageKpis(current, options.currentDays) : current;
    const previousCmp = compareByAverage ? dailyAverageKpis(previous, options.previousDays) : previous;
    const productionChange = percentChange(currentCmp.totalProductionMeters, previousCmp.totalProductionMeters);
    const efficiencyChange = round1(currentCmp.overallEfficiency - previousCmp.overallEfficiency);
    const vsPhrase = compareByAverage
        ? " compared to last month's daily average while overall efficiency "
        : ' compared to last month while overall efficiency ';
    const topReason = reasons[0];
    const problemMachines = bottomMachines.slice(0, 3);
    const problemShare = totalDowntimeMinutes
        ? Math.round((problemMachines.reduce((sum, item) => sum + item.downtimeMinutes, 0) / totalDowntimeMinutes) * 100)
        : 0;
    const bestShift = shifts.find((item) => item.isBest) || shifts[0];
    const worstShift = [...shifts].sort((a, b) => a.efficiency - b.efficiency)[0];
    const shiftGap = round1((bestShift?.efficiency || 0) - (worstShift?.efficiency || 0));
    const problemNames = problemMachines
        .map((item) => item.name)
        .join(', ')
        .replace(/, ([^,]*)$/, ' and $1');

    const insights = [
        {
            id: 'production-improved',
            title: productionChange >= 0 ? 'Production Improved' : 'Production Declined',
            segments: [
                { text: productionChange >= 0 ? 'Production increased by ' : 'Production decreased by ' },
                { text: formatPercent(Math.abs(productionChange)), emphasize: true },
                { text: vsPhrase },
                { text: efficiencyChange >= 0 ? 'improved by ' : 'declined by ' },
                { text: formatPercent(Math.abs(efficiencyChange)), emphasize: true },
                { text: '.' }
            ]
        }
    ];

    if (topReason) {
        insights.push({
            id: 'biggest-loss',
            title: 'Biggest Loss Reason',
            segments: [
                { text: topReason.reason, emphasize: true },
                { text: ' contributed ' },
                { text: `${topReason.downtimePercent}% of total downtime`, emphasize: true },
                { text: ', making them the biggest area for improvement.' }
            ]
        });
    }

    if (problemMachines.length) {
        insights.push({
            id: 'attention-machines',
            title: 'Machines Requiring Attention',
            segments: [
                { text: problemNames, emphasize: true },
                { text: ' contributed ' },
                { text: `${problemShare}% of total factory downtime`, emphasize: true },
                { text: '.' }
            ]
        });
    }

    if (bestShift && worstShift && bestShift.id !== worstShift.id) {
        insights.push({
            id: 'shift-gap',
            title: 'Shift Performance Gap',
            segments: [
                { text: `${worstShift.name} efficiency was ` },
                { text: `${shiftGap}% lower than ${bestShift.name}`, emphasize: true },
                { text: '.' }
            ]
        });
    }

    insights.push({
        id: 'long-stops',
        title: 'Long Stops',
        segments: [
            { text: 'Stops longer than ' },
            { text: '10 minutes', emphasize: true },
            { text: ' contributed ' },
            { text: `${longStopsPercent}% of total downtime`, emphasize: true },
            { text: '.' }
        ]
    });

    return insights;
}

function buildRecommendations(reasons, bottomMachines, shifts, currentEfficiency) {
    const problemNames = bottomMachines.slice(0, 3).map((item) => item.name).join(', ');
    const bestShift = shifts.find((item) => item.isBest) || shifts[0];
    const worstShift = [...shifts].sort((a, b) => a.efficiency - b.efficiency)[0];
    const target = Math.min(95, Math.ceil(currentEfficiency || 0) + 2);
    const items = [];

    if (reasons[0] && problemNames) {
        items.push(`Investigate repeated ${reasons[0].reason}s on ${problemNames}.`);
    } else if (reasons[0]) {
        items.push(`Investigate repeated ${reasons[0].reason}s across the factory.`);
    }
    items.push('Reduce stops longer than 10 minutes.');
    if (bestShift && worstShift && bestShift.id !== worstShift.id) {
        items.push(`Review ${worstShift.name} performance compared with ${bestShift.name}.`);
    }
    items.push(`Target factory efficiency improvement from ${formatPercent(currentEfficiency)} to ${target}%.`);
    items.push('Focus preventive maintenance on machines contributing the highest downtime.');
    return items;
}

function estimatedLossMeters(kpis) {
    const runMinutes = Math.max(kpis.runningTimeHours * 60, 1);
    const rate = kpis.totalProductionMeters / runMinutes;
    return Math.round(rate * kpis.totalDowntimeMinutes);
}

async function fetchMonthLogs({ workspaceId, machineIds, year, month, throughDay = null }) {
    const range = monthRange(year, month, throughDay);
    if (!machineIds.length) return [];
    return machineLogsService.find({
        workspaceId,
        machineId: { $in: machineIds },
        shiftDate: { $gte: range.start, $lte: range.end },
        shift: { $in: [global.config.SHIFT_TYPE.DAY, global.config.SHIFT_TYPE.NIGHT] }
    }, {
        projection: LOG_PROJECTION,
        sort: { shiftDate: 1, machineId: 1 },
        useLean: true
    });
}

function comparisonOptions(year, month) {
    const window = getPeriodWindow(year, month);
    const compare = previousMonth(year, month);
    const previousDays = Math.max(monthRange(compare.year, compare.month).days, 1);
    const compareByAverage = window.isCurrentMonth;
    const currentDays = compareByAverage ? Math.max(window.elapsedDays, 1) : window.daysInMonth;
    return {
        compare,
        window,
        compareByAverage,
        currentDays,
        previousDays,
        options: {
            compareByAverage,
            currentDays,
            previousDays
        }
    };
}

function emptySummary(year, month) {
    const { compare, window, options } = comparisonOptions(year, month);
    const currentKpis = emptyKpis();
    const previousKpis = emptyKpis();
    const dailyPerformance = buildDailyPerformance({}, year, month, window.elapsedDays);
    return {
        month: {
            year,
            month,
            label: periodLabel(year, month, { isPartial: window.isCurrentMonth, elapsedDays: window.elapsedDays })
        },
        comparisonMonth: { year: compare.year, month: compare.month, label: monthLabel(compare.year, compare.month) },
        kpis: currentKpis,
        previousKpis,
        kpiCards: buildKpiCards(currentKpis, previousKpis, options),
        highlight: buildHighlight(currentKpis, previousKpis, 0, options),
        dailyPerformance,
        dailySummary: {
            bestDay: dailyPerformance[0],
            lowestDay: dailyPerformance[0],
            averageDailyProduction: 0
        },
        downtimeReasons: [],
        productionLoss: {
            totalDowntimeMinutes: 0,
            estimatedLossMeters: 0,
            potentialAdditionalProductionPercent: 0,
            topProblemMachinesDowntimePercent: 0,
            explanation: 'Estimated production loss is calculated using machine RPM, set picks and downtime duration.'
        },
        topMachines: [],
        bottomMachines: [],
        machines: [],
        shifts: buildShifts({ 0: {}, 1: {} }),
        monthComparison: buildComparisonRows(currentKpis, previousKpis, 0, 0, { year, month }, compare, options),
        insights: buildInsights(currentKpis, previousKpis, [], [], [], 0, 0, options),
        recommendations: buildRecommendations([], [], [], 0),
        longStopsOver10MinPercent: 0
    };
}

module.exports = {
    async build({ workspaceId, machineIds, year, month }) {
        if (!Array.isArray(machineIds) || machineIds.length === 0) {
            return emptySummary(year, month);
        }
        const { compare, window } = comparisonOptions(year, month);
        const [machines, workspace, currentLogs, previousLogs] = await Promise.all([
            machineService.find(
                { _id: { $in: machineIds }, workspaceId },
                { projection: { machineCode: 1, machineType: 1, panna: 1 }, useLean: true, sort: { machineCode: 1 } }
            ),
            workspaceService.findOne(
                { _id: workspaceId },
                { projection: { dayShift: 1, nightShift: 1 }, useLean: true }
            ),
            fetchMonthLogs({
                workspaceId,
                machineIds,
                year,
                month,
                throughDay: window.isCurrentMonth ? window.elapsedDays : null
            }),
            fetchMonthLogs({ workspaceId, machineIds, year: compare.year, month: compare.month })
        ]);

        const machineMap = machines.reduce((acc, machine) => {
            acc[String(machine._id)] = machine;
            return acc;
        }, {});

        const current = processLogs(currentLogs, machineMap, workspace);
        const previous = processLogs(previousLogs, machineMap, workspace);
        const { options } = comparisonOptions(year, month);
        const currentKpis = current.kpis.totalProductionMeters || current.kpis.totalDowntimeMinutes
            ? current.kpis
            : emptyKpis();
        const previousKpis = previous.kpis.totalProductionMeters || previous.kpis.totalDowntimeMinutes
            ? previous.kpis
            : emptyKpis();

        const currentLoss = estimatedLossMeters(currentKpis);
        const previousLoss = estimatedLossMeters(previousKpis);
        const dailyPerformance = buildDailyPerformance(
            current.dailyMap,
            year,
            month,
            window.isCurrentMonth ? window.elapsedDays : null
        );
        const { machines: machineRows, topMachines, bottomMachines } = buildMachines(
            current.machineAgg,
            machines,
            currentKpis.overallEfficiency
        );
        const shifts = buildShifts(current.shiftAgg);
        const downtimeReasons = buildDowntimeReasons(current.reasonAgg, current.totalDowntimeSeconds, currentLoss);
        const longStopsPercent = current.totalDowntimeSeconds
            ? Math.round((current.longStopsSeconds / current.totalDowntimeSeconds) * 100)
            : 0;
        const topProblemShare = currentKpis.totalDowntimeMinutes
            ? Math.round((bottomMachines.reduce((sum, item) => sum + item.downtimeMinutes, 0) / currentKpis.totalDowntimeMinutes) * 100)
            : 0;

        const bestDay = dailyPerformance.reduce((best, item) =>
            item.productionMeters > best.productionMeters ? item : best
        , dailyPerformance[0]);
        const lowestDay = dailyPerformance.reduce((lowest, item) =>
            item.productionMeters < lowest.productionMeters ? item : lowest
        , dailyPerformance[0]);

        return {
            month: {
                year,
                month,
                label: periodLabel(year, month, {
                    isPartial: window.isCurrentMonth,
                    elapsedDays: window.elapsedDays
                })
            },
            comparisonMonth: { year: compare.year, month: compare.month, label: monthLabel(compare.year, compare.month) },
            kpis: currentKpis,
            previousKpis,
            kpiCards: buildKpiCards(currentKpis, previousKpis, options),
            highlight: buildHighlight(currentKpis, previousKpis, currentLoss, options),
            dailyPerformance,
            dailySummary: {
                bestDay,
                lowestDay,
                averageDailyProduction: dailyPerformance.length
                    ? Math.round(currentKpis.totalProductionMeters / dailyPerformance.length)
                    : 0
            },
            downtimeReasons,
            productionLoss: {
                totalDowntimeMinutes: currentKpis.totalDowntimeMinutes,
                estimatedLossMeters: currentLoss,
                potentialAdditionalProductionPercent: currentKpis.totalProductionMeters
                    ? round1((currentLoss / currentKpis.totalProductionMeters) * 100)
                    : 0,
                topProblemMachinesDowntimePercent: Math.min(100, Math.max(0, topProblemShare)),
                explanation: 'Estimated production loss is calculated using machine RPM, set picks and downtime duration.'
            },
            topMachines,
            bottomMachines,
            machines: machineRows,
            shifts,
            monthComparison: buildComparisonRows(
                currentKpis,
                previousKpis,
                currentLoss,
                previousLoss,
                { year, month },
                compare,
                options
            ),
            insights: buildInsights(
                currentKpis,
                previousKpis,
                downtimeReasons,
                bottomMachines,
                shifts,
                longStopsPercent,
                currentKpis.totalDowntimeMinutes,
                options
            ),
            recommendations: buildRecommendations(downtimeReasons, bottomMachines, shifts, currentKpis.overallEfficiency),
            longStopsOver10MinPercent: longStopsPercent
        };
    }
};
