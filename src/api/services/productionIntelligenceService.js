const moment = require('moment');

const machineService = require('./machineService');
const machineLogsService = require('./machineLogsService');
const workspaceService = require('./workspaceService');
const reportService = require('./reportService');
const { getActionableStopStats } = require('./reportRules');

const STOP_REASON_LABELS = {
    weft: 'Weft Stop',
    warp: 'Warp Stop',
    feeder: 'Feeder Stop',
    manual: 'Other / Manual',
    other: 'Machine Error',
    h1: 'H1 Stop',
    h2: 'H2 Stop'
};

const PRIORITY_WEIGHTS = {
    downtime: 0.30,
    productionLoss: 0.30,
    stopFrequency: 0.15,
    repeatedStop: 0.15,
    efficiency: 0.10
};

const HISTORY_LOOKBACK_DAYS = 45;
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

function round1(value) {
    return Math.round((Number(value) || 0) * 10) / 10;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
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

function formatHoursMinutes(totalMinutes) {
    const rounded = Math.round(totalMinutes || 0);
    const hours = Math.floor(rounded / 60);
    const minutes = rounded % 60;
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return hours >= 1000 ? `${formatIndianNumber(hours)}h` : `${hours}h`;
    return `${hours >= 1000 ? formatIndianNumber(hours) : hours}h ${minutes}m`;
}

function formatPercent(value) {
    return `${round1(value).toFixed(1)}%`;
}

function timesLabel(ratio) {
    return `${round1(ratio)}x`;
}

function stopKeysForMachine(machineType) {
    return global.config.MACHINE_TYPE_KEY_MAPPING[machineType]
        || global.config.MACHINE_TYPE_KEY_MAPPING.rapier;
}

function machineDisplayName(machine) {
    return machine?.machineCode || 'Machine';
}

function estimatedLossFromRate(productionMeters, runMinutes, downtimeMinutes) {
    const rate = (Number(productionMeters) || 0) / Math.max(Number(runMinutes) || 1, 1);
    return Math.round(rate * (Number(downtimeMinutes) || 0));
}

function emptyMachineAgg(machine) {
    return {
        id: String(machine._id),
        name: machineDisplayName(machine),
        productionMeters: 0,
        picks: 0,
        efficiencySum: 0,
        efficiencyCount: 0,
        rpmSum: 0,
        rpmCount: 0,
        runningTimeMinutes: 0,
        downtimeMinutes: 0,
        rawDowntimeMinutes: 0,
        totalStops: 0,
        rawStopCount: 0,
        stopReasons: {},
        days: {}
    };
}

function applyLog(agg, log, machine, workspace, availableMinutesCache) {
    const machineType = machine?.machineType || 'rapier';
    const stopKeys = stopKeysForMachine(machineType);
    const production = reportService.calculatePannaWithPieceLengthM(log.pieceLengthM, machine?.panna) || 0;
    const picks = Number(log.picksCurrentShift) || 0;
    const efficiency = Number(log.efficiencyPercent) || 0;
    const rpm = reportService.resolveDisplaySpeedRpm(log);
    const rawDowntimeSeconds = stopKeys.reduce((sum, key) => sum + (Number(log.stopsCount?.[key]?.duration) || 0), 0);
    const stopStats = getActionableStopStats(log, stopKeys);
    const downtimeSeconds = stopStats.durationSeconds;
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

    const shiftKey = log.shift === global.config.SHIFT_TYPE.DAY ? 'dayShift' : 'nightShift';
    const cacheKey = `${moment(log.shiftDate).startOf('day').toISOString()}|${shiftKey}`;
    if (!(cacheKey in availableMinutesCache)) {
        availableMinutesCache[cacheKey] = reportService.getAvailableShiftMinutes(log.shiftDate, shiftKey, workspace) || 0;
    }

    const runMinutes = reportService.parseDurationToMinutes(runTime);
    const downtimeMinutes = Math.round(downtimeSeconds / 60);
    const rawDowntimeMinutes = Math.round(rawDowntimeSeconds / 60);

    agg.productionMeters += production;
    agg.picks += picks;
    agg.runningTimeMinutes += runMinutes;
    agg.downtimeMinutes += downtimeMinutes;
    agg.rawDowntimeMinutes += rawDowntimeMinutes;
    if (efficiency > 0) {
        agg.efficiencySum += efficiency;
        agg.efficiencyCount += 1;
    }
    if (rpm > 0) {
        agg.rpmSum += rpm;
        agg.rpmCount += 1;
    }

    if (!agg.days[dayKey]) {
        agg.days[dayKey] = {
            date: dayKey,
            productionMeters: 0,
            efficiencySum: 0,
            efficiencyCount: 0,
            rpmSum: 0,
            rpmCount: 0,
            downtimeMinutes: 0,
            rawDowntimeMinutes: 0,
            totalStops: 0,
            rawStopCount: 0,
            stopReasons: {}
        };
    }
    const day = agg.days[dayKey];
    day.productionMeters += production;
    day.downtimeMinutes += downtimeMinutes;
    day.rawDowntimeMinutes += rawDowntimeMinutes;
    if (efficiency > 0) {
        day.efficiencySum += efficiency;
        day.efficiencyCount += 1;
    }
    if (rpm > 0) {
        day.rpmSum += rpm;
        day.rpmCount += 1;
    }

    const rawStopCount = stopKeys.reduce((sum, key) => sum + (Number(log.stopsCount?.[key]?.count) || 0), 0);
    agg.rawStopCount += rawStopCount;
    day.rawStopCount += rawStopCount;

    if (stopStats.actionable) {
        for (const key of stopKeys) {
            const count = stopStats.reasons[key]?.count || 0;
            const duration = stopStats.reasons[key]?.durationSeconds || 0;
            if (!agg.stopReasons[key]) agg.stopReasons[key] = { count: 0, durationSeconds: 0 };
            agg.stopReasons[key].count += count;
            agg.stopReasons[key].durationSeconds += duration;
            agg.totalStops += count;
            if (!day.stopReasons[key]) day.stopReasons[key] = { count: 0, durationSeconds: 0 };
            day.stopReasons[key].count += count;
            day.stopReasons[key].durationSeconds += duration;
            day.totalStops += count;
        }
    }

    return { runMinutes, availableMinutes: availableMinutesCache[cacheKey] };
}

function finalizeMachine(agg) {
    const efficiency = agg.efficiencyCount ? round1(agg.efficiencySum / agg.efficiencyCount) : 0;
    const averageRpm = agg.rpmCount ? Math.round(agg.rpmSum / agg.rpmCount) : 0;
    const estimatedProductionLoss = estimatedLossFromRate(
        agg.productionMeters,
        agg.runningTimeMinutes,
        agg.downtimeMinutes
    );
    const reasons = Object.entries(agg.stopReasons)
        .map(([key, row]) => ({
            key,
            reason: STOP_REASON_LABELS[key] || key,
            count: row.count,
            durationMinutes: Math.round(row.durationSeconds / 60)
        }))
        .sort((a, b) => b.durationMinutes - a.durationMinutes || b.count - a.count);
    const topReason = reasons[0] || null;
    return {
        ...agg,
        efficiency,
        averageRpm,
        estimatedProductionLoss,
        reasons,
        topReason,
        isActive: agg.productionMeters > 0 || agg.downtimeMinutes > 0 || agg.totalStops > 0
    };
}

function daySeries(agg, dates) {
    return dates.map((date) => {
        const day = agg.days[date];
        return {
            date,
            productionMeters: Math.round(day?.productionMeters || 0),
            efficiency: day?.efficiencyCount ? round1(day.efficiencySum / day.efficiencyCount) : 0,
            averageRpm: day?.rpmCount ? Math.round(day.rpmSum / day.rpmCount) : 0,
            downtimeMinutes: day?.downtimeMinutes || 0,
            totalStops: day?.totalStops || 0,
            stopReasons: day?.stopReasons || {}
        };
    });
}

function ratio(value, baseline) {
    if (!baseline) return value > 0 ? 3 : 0;
    return value / baseline;
}

function classifyPriority(score) {
    if (score >= 75) return 'critical';
    if (score >= 50) return 'attention';
    return 'normal';
}

function buildPriority(machine, averages, watchlistIds) {
    const stopRatio = ratio(machine.totalStops, averages.averageStops);
    const downtimeRatio = ratio(machine.downtimeMinutes, averages.averageDowntimeMinutes);
    const topReason = machine.topReason;
    const topReasonShare = machine.totalStops && topReason
        ? topReason.count / machine.totalStops
        : 0;
    const factoryReasonAvg = averages.stopReasonAverages[topReason?.key] || 0;
    const reasonRatio = topReason ? ratio(topReason.count, factoryReasonAvg) : 0;
    const efficiencyGap = Math.max(0, averages.averageEfficiency - machine.efficiency);
    const speedGapPercent = averages.averageRpm
        ? ((averages.averageRpm - machine.averageRpm) / averages.averageRpm) * 100
        : 0;

    const downtimeScore = clamp((downtimeRatio / 3) * 100, 0, 100);
    const productionLossScore = clamp((machine.estimatedProductionLoss / Math.max(averages.maxLoss, 1)) * 100, 0, 100);
    const stopFrequencyScore = clamp((stopRatio / 3) * 100, 0, 100);
    const repeatedStopScore = clamp((Math.max(topReasonShare, reasonRatio / 3)) * 100, 0, 100);
    const efficiencyScore = clamp((efficiencyGap / 20) * 100, 0, 100);

    const priorityScore = round1(
        downtimeScore * PRIORITY_WEIGHTS.downtime
        + productionLossScore * PRIORITY_WEIGHTS.productionLoss
        + stopFrequencyScore * PRIORITY_WEIGHTS.stopFrequency
        + repeatedStopScore * PRIORITY_WEIGHTS.repeatedStop
        + efficiencyScore * PRIORITY_WEIGHTS.efficiency
    );

    const candidates = [
        {
            key: 'downtime',
            label: 'High Downtime',
            primaryIssue: topReason ? `Repeated ${topReason.reason}s` : 'High Downtime',
            explanation: `Downtime is ${timesLabel(downtimeRatio)} higher than factory average.`,
            score: downtimeScore,
            tag: `${formatHoursMinutes(machine.downtimeMinutes)} Downtime`
        },
        {
            key: 'stops',
            label: 'Repeated Stops',
            primaryIssue: topReason ? `Repeated ${topReason.reason}s` : 'Repeated Stops',
            explanation: topReason
                ? `${topReason.reason} occurred ${topReason.count} times, ${timesLabel(reasonRatio)} factory average.`
                : `Stop frequency is ${timesLabel(stopRatio)} higher than factory average.`,
            score: Math.max(stopFrequencyScore, repeatedStopScore),
            tag: topReason ? `${topReason.reason.replace(' Stop', '')} x${topReason.count}` : `${machine.totalStops} Stops`
        },
        {
            key: 'loss',
            label: 'Production Loss',
            primaryIssue: 'Production Loss',
            explanation: `Estimated ${formatMeters(machine.estimatedProductionLoss)} production lost due to downtime.`,
            score: productionLossScore,
            tag: `${formatMeters(machine.estimatedProductionLoss)} Loss`
        },
        {
            key: 'efficiency',
            label: 'Low Efficiency',
            primaryIssue: 'Low Efficiency',
            explanation: `Efficiency is ${round1(efficiencyGap)}% below factory average.`,
            score: efficiencyScore,
            tag: `Low Eff ${formatPercent(machine.efficiency)}`
        }
    ];

    if (averages.averageRpm && speedGapPercent > 5) {
        candidates.push({
            key: 'speed',
            label: 'Low Speed',
            primaryIssue: 'Low Speed',
            explanation: `Average speed is ${round1(speedGapPercent)}% below expected machine speed.`,
            score: clamp(speedGapPercent * 6, 0, 100),
            tag: `Speed ↓ ${round1(speedGapPercent)}%`
        });
    }

    const ranked = [...candidates].sort((a, b) => b.score - a.score);
    const primary = ranked[0];
    const tags = [];
    if (topReason?.count) tags.push(`${topReason.reason.replace(' Stop', '')} x${topReason.count}`);
    if (stopRatio >= 1.3) tags.push(`${timesLabel(stopRatio)} Stop Avg`);
    if (machine.downtimeMinutes) tags.push(`${machine.downtimeMinutes}m Downtime`);
    if (efficiencyGap >= 5) tags.push(`Low Eff ${formatPercent(machine.efficiency)}`);
    if (speedGapPercent > 5 && tags.length < 3) tags.push(`Speed ↓ ${round1(speedGapPercent)}%`);

    return {
        machineId: machine.id,
        machineName: machine.name,
        priorityScore,
        severity: classifyPriority(priorityScore),
        primaryIssue: primary.primaryIssue,
        explanation: stopRatio >= 1.3 && primary.key !== 'stops'
            ? `Stop frequency is ${timesLabel(stopRatio)} higher than the selected factory average.`
            : primary.explanation,
        productionMeters: Math.round(machine.productionMeters),
        picks: machine.picks,
        efficiency: machine.efficiency,
        averageRpm: machine.averageRpm,
        totalStops: machine.totalStops,
        downtimeMinutes: machine.downtimeMinutes,
        estimatedProductionLoss: machine.estimatedProductionLoss,
        stopReasons: machine.reasons.map((row) => ({
            ...row,
            estimatedLossMeters: machine.estimatedProductionLoss && machine.downtimeMinutes
                ? Math.round(machine.estimatedProductionLoss * (row.durationMinutes / Math.max(machine.downtimeMinutes, 1)))
                : 0
        })),
        tags: tags.slice(0, 3),
        alsoOnWatchlist: watchlistIds.has(machine.id),
        stopFrequencyRatio: round1(stopRatio),
        history7: machine.history7 || [],
        history30Average: machine.history30Average || null
    };
}

function hasDaySignal(day) {
    return (day?.productionMeters || 0) > 0
        || (day?.efficiency || 0) > 0
        || (day?.downtimeMinutes || 0) > 0
        || (day?.totalStops || 0) > 0
        || (day?.averageRpm || 0) > 0;
}

function formatSignedChange(value) {
    if (!Number.isFinite(value) || value === 0) return '→ 0%';
    return `${value > 0 ? '↑' : '↓'} ${round1(Math.abs(value))}%`;
}

function watchComparison(primaryTrend, ctx) {
    const noData = 'No production data';
    if (primaryTrend.includes('Efficiency')) {
        if (!ctx.hasCurrentEfficiency) {
            return {
                current: noData,
                normal: ctx.avg30Eff ? formatPercent(ctx.avg30Eff) : '—',
                change: '—',
                changeIsBad: false,
                hasValidCurrent: false
            };
        }
        const gap = round1(Math.abs(ctx.effChange));
        return {
            current: formatPercent(ctx.currentEff),
            normal: ctx.avg30Eff ? formatPercent(ctx.avg30Eff) : '—',
            change: !gap
                ? 'in line with normal'
                : `${gap} pp ${ctx.effChange < 0 ? 'below' : 'above'} normal`,
            changeIsBad: ctx.effChange < 0,
            hasValidCurrent: true
        };
    }
    if (primaryTrend.includes('Downtime')) {
        const current = Math.round(ctx.currentDowntime || 0);
        const normal = Math.round(ctx.prevDowntimeAvg || 0);
        if (!current && !normal) {
            return { current: noData, normal: '—', change: '—', changeIsBad: false, hasValidCurrent: false };
        }
        const displayedChange = normal
            ? ((current - normal) / normal) * 100
            : 0;
        return {
            current: `${current} min`,
            normal: `${normal} min`,
            change: formatSignedChange(displayedChange),
            changeIsBad: displayedChange > 0,
            hasValidCurrent: true
        };
    }
    if (primaryTrend.includes('Speed') || primaryTrend.includes('Degradation')) {
        if (!ctx.currentRpm || !ctx.prevRpmAvg) {
            return { current: noData, normal: '—', change: '—', changeIsBad: false, hasValidCurrent: false };
        }
        return {
            current: `${Math.round(ctx.currentRpm)} RPM`,
            normal: `${Math.round(ctx.prevRpmAvg)} RPM`,
            change: formatSignedChange(ctx.speedChange),
            changeIsBad: ctx.speedChange < 0,
            hasValidCurrent: true
        };
    }
    if (!ctx.hasCurrentStops && !ctx.previousReasonAvg) {
        return { current: noData, normal: '—', change: '—', changeIsBad: false, hasValidCurrent: false };
    }
    return {
        current: `${round1(ctx.currentReasonCount || 0)}/day`,
        normal: `${round1(ctx.previousReasonAvg || 0)}/day`,
        change: formatSignedChange(ctx.reasonChange),
        changeIsBad: ctx.reasonChange > 0,
        hasValidCurrent: true
    };
}

function consecutiveDecline(values, minDays) {
    if (values.length < minDays + 1) return 0;
    let streak = 0;
    for (let i = values.length - 1; i > 0; i--) {
        if (values[i] < values[i - 1]) streak += 1;
        else break;
    }
    return streak;
}

function average(values) {
    const nums = values.filter((value) => Number.isFinite(value));
    if (!nums.length) return 0;
    return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function topDayReason(day) {
    let bestKey = '';
    let bestCount = 0;
    for (const [key, row] of Object.entries(day.stopReasons || {})) {
        const count = Number(row?.count) || 0;
        if (count > bestCount) {
            bestCount = count;
            bestKey = key;
        }
    }
    return bestKey ? { key: bestKey, count: bestCount } : null;
}

function buildWatchlist(machines, productionDays, trendDays) {
    const windowDays = productionDays.slice(-Math.max(trendDays, 7));
    const days30 = productionDays.slice(-30);
    const previousWindow = productionDays.slice(-(trendDays * 2), -trendDays);
    const items = [];

    for (const machine of machines) {
        const series = daySeries(machine, windowDays);
        const series30 = daySeries(machine, days30);
        const previousSeries = daySeries(machine, previousWindow);
        const latest = [...series].reverse().find(hasDaySignal);
        if (!latest) continue;

        const effValues = series.map((day) => day.efficiency).filter((value) => value > 0);
        const downtimeValues = series.filter(hasDaySignal).map((day) => day.downtimeMinutes);
        const prevDowntimeAvg = average(previousSeries.filter(hasDaySignal).map((day) => day.downtimeMinutes));
        const prevRpmAvg = average(previousSeries.map((day) => day.averageRpm).filter((value) => value > 0));
        const avg30Eff = average(series30.map((day) => day.efficiency).filter((value) => value > 0));
        const currentEff = latest.efficiency || 0;
        const currentRpm = latest.averageRpm || 0;
        const hasCurrentEfficiency = currentEff > 0;
        const currentDowntime = latest.downtimeMinutes || 0;
        const downtimeChange = prevDowntimeAvg
            ? ((average(downtimeValues) - prevDowntimeAvg) / prevDowntimeAvg) * 100
            : 0;
        const speedChange = prevRpmAvg && currentRpm
            ? ((currentRpm - prevRpmAvg) / prevRpmAvg) * 100
            : 0;
        const effChange = hasCurrentEfficiency && avg30Eff ? currentEff - avg30Eff : 0;

        const reasonSeries = windowDays.map((date) => topDayReason(machine.days[date] || { stopReasons: {} }));
        const sameReasonStreak = (() => {
            if (reasonSeries.length < 4) return { key: '', streak: 0 };
            const latestReason = reasonSeries[reasonSeries.length - 1];
            if (!latestReason) return { key: '', streak: 0 };
            let streak = 0;
            for (let i = reasonSeries.length - 1; i >= 0; i--) {
                if (reasonSeries[i]?.key === latestReason.key && (reasonSeries[i]?.count || 0) > 0) streak += 1;
                else break;
            }
            return { key: latestReason.key, streak, count: latestReason.count };
        })();
        const previousReasonAvg = average(previousSeries.filter(hasDaySignal).map((day) => Number(day.stopReasons?.[sameReasonStreak.key]?.count) || 0));
        const currentReasonCount = latest.stopReasons?.[sameReasonStreak.key]?.count || 0;
        const hasCurrentStops = currentReasonCount > 0;
        const reasonChange = previousReasonAvg
            ? ((currentReasonCount - previousReasonAvg) / previousReasonAvg) * 100
            : 0;

        const findings = [];
        const effGap = hasCurrentEfficiency && avg30Eff ? avg30Eff - currentEff : 0;
        const effStreak = consecutiveDecline(effValues, 3);
        if (hasCurrentEfficiency && (effStreak >= 3 || effGap >= 8)) {
            findings.push({
                status: effGap >= 15 || (effStreak >= 5 && effGap >= 8) ? 'critical' : 'watch',
                primaryTrend: 'Efficiency Declining',
                explanation: effStreak >= 3
                    ? `Efficiency has declined for ${effStreak} consecutive production days.`
                    : `Efficiency is ${round1(effGap)} percentage points below its 30-day normal.`,
                tag: `Efficiency ↓ ${round1(Math.abs(effChange))} pp`
            });
        }

        if (sameReasonStreak.streak >= 3 || (reasonChange >= 40 && sameReasonStreak.key)) {
            const label = STOP_REASON_LABELS[sameReasonStreak.key] || sameReasonStreak.key;
            findings.push({
                status: reasonChange >= 80 ? 'critical' : 'watch',
                primaryTrend: `${label} Rising`,
                explanation: reasonChange >= 40
                    ? `${label} frequency increased ${round1(reasonChange)}% compared with the previous ${trendDays}-day average.`
                    : `The same ${label.toLowerCase()} increased for ${sameReasonStreak.streak} consecutive production days.`,
                tag: `${label.replace(' Stop', '')} Stops ↑ ${round1(Math.max(reasonChange, sameReasonStreak.streak))}`
            });
        }

        if (downtimeChange >= 30) {
            findings.push({
                status: downtimeChange >= 80 ? 'critical' : 'watch',
                primaryTrend: 'Downtime Rising',
                explanation: downtimeChange >= 80
                    ? `Machine downtime is ${round1(downtimeChange)}% above its normal range.`
                    : `Machine downtime has remained above its previous ${trendDays}-day average.`,
                tag: `Downtime ↑ ${round1(downtimeChange)}%`
            });
        }

        if (prevRpmAvg && speedChange <= -5) {
            findings.push({
                status: speedChange <= -12 ? 'critical' : 'watch',
                primaryTrend: 'Speed Degradation',
                explanation: `Average running speed is ${round1(Math.abs(speedChange))}% below normal.`,
                tag: `Speed ↓ ${round1(Math.abs(speedChange))}%`
            });
        }

        if (!findings.length) continue;
        const status = findings.some((item) => item.status === 'critical') || findings.length >= 2
            ? 'critical'
            : 'watch';
        const primary = findings.sort((a, b) => (a.status === 'critical' ? 0 : 1) - (b.status === 'critical' ? 0 : 1))[0];
        const tags = [...new Set(findings.map((item) => item.tag))].slice(0, 3);
        const comparison = watchComparison(primary.primaryTrend, {
            hasCurrentEfficiency,
            currentEff,
            avg30Eff,
            effChange,
            currentDowntime,
            prevDowntimeAvg,
            downtimeChange,
            currentRpm,
            prevRpmAvg,
            speedChange,
            currentReasonCount,
            previousReasonAvg,
            reasonChange,
            hasCurrentStops
        });

        items.push({
            machineId: machine.id,
            machineName: machine.name,
            status,
            primaryTrend: primary.primaryTrend,
            explanation: primary.explanation,
            currentValue: comparison.current,
            currentEfficiency: currentEff,
            historicalAverage: comparison.normal,
            historicalEfficiency: round1(avg30Eff),
            percentageChange: round1(effChange),
            hasValidCurrent: comparison.hasValidCurrent,
            comparisonCurrent: comparison.current,
            comparisonNormal: comparison.normal,
            comparisonChange: comparison.change,
            changeIsBad: comparison.changeIsBad,
            trendData: series.slice(-trendDays).map((day) => ({
                date: day.date,
                efficiency: day.efficiency,
                downtimeMinutes: day.downtimeMinutes,
                productionMeters: day.productionMeters
            })),
            tags
        });
    }

    return items.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'critical' ? -1 : 1;
        return a.percentageChange - b.percentageChange;
    });
}

function shortActionIssue(machine) {
    const issue = String(machine.primaryIssue || '');
    if (/stop/i.test(issue)) return 'repeated stops';
    if (/efficien/i.test(issue)) return 'low efficiency';
    if (/downtime/i.test(issue)) return 'long downtime';
    if (/speed/i.test(issue)) return 'low speed';
    if (/loss/i.test(issue)) return 'production loss';
    return issue.replace(/^Repeated /i, '').toLowerCase() || 'this issue';
}

function machineActionDetail(machine) {
    const parts = [];
    if (machine.totalStops) {
        const ratio = machine.stopFrequencyRatio;
        parts.push(ratio >= 1.3
            ? `${machine.totalStops} stops, ${timesLabel(ratio)} selected average`
            : `${machine.totalStops} stops`);
    }
    if (/efficien/i.test(machine.primaryIssue || '') && machine.history30Average?.efficiency) {
        parts.push(`${formatPercent(machine.efficiency)} efficiency versus ${formatPercent(machine.history30Average.efficiency)} normal`);
    }
    if (machine.estimatedProductionLoss) {
        parts.push(`~${formatMeters(machine.estimatedProductionLoss)} loss`);
    }
    return parts.join(', ') || machine.explanation;
}

function buildRecommendations(priorityMachines, watchlist, stopReasons) {
    const items = [];
    const usedIds = new Set();
    const first = priorityMachines[0];
    if (first) {
        usedIds.add(first.machineId);
        items.push({
            title: `Check ${first.machineName} ${shortActionIssue(first)}`,
            detail: machineActionDetail(first)
        });
    }
    const second = priorityMachines.find((machine) => !usedIds.has(machine.machineId));
    if (second) {
        usedIds.add(second.machineId);
        items.push({
            title: `Check ${second.machineName} ${shortActionIssue(second)}`,
            detail: machineActionDetail(second)
        });
    } else {
        const watch = watchlist.find((machine) => !usedIds.has(machine.machineId));
        if (watch) {
            usedIds.add(watch.machineId);
            items.push({
                title: `Inspect ${watch.machineName}`,
                detail: watch.explanation
            });
        }
    }
    if (stopReasons[0]) {
        items.push({
            title: `Focus on ${stopReasons[0].reason}`,
            detail: `${stopReasons[0].durationMinutes} min downtime, ~${formatMeters(stopReasons[0].estimatedLossMeters)} estimated loss.`
        });
    }
    return items.slice(0, 3);
}

function periodLabel(startDate, endDate, shiftLabel) {
    const start = moment(startDate);
    const end = moment(endDate);
    const dateText = start.isSame(end, 'day')
        ? start.format('D MMM YYYY')
        : `${start.format('D MMM')} - ${end.format('D MMM YYYY')}`;
    return `${dateText} | ${shiftLabel}`;
}

async function fetchLogs({ workspaceId, machineIds, start, end, shifts }) {
    if (!machineIds.length) return [];
    return machineLogsService.find({
        workspaceId,
        machineId: { $in: machineIds },
        shiftDate: { $gte: start, $lte: end },
        shift: { $in: shifts }
    }, {
        projection: LOG_PROJECTION,
        sort: { shiftDate: 1, machineId: 1 },
        useLean: true
    });
}

module.exports = {
    PRIORITY_WEIGHTS,
    async build({ workspaceId, machineIds, startDate, endDate, shifts, trendDays = 7 }) {
        const shiftList = Array.isArray(shifts) && shifts.length
            ? shifts
            : [global.config.SHIFT_TYPE.DAY, global.config.SHIFT_TYPE.NIGHT];
        const selectedTrendDays = [3, 7, 30].includes(Number(trendDays)) ? Number(trendDays) : 7;
        const periodStart = moment(startDate).startOf('day').toDate();
        const periodEnd = moment(endDate).endOf('day').toDate();
        const historyStart = moment(endDate).subtract(HISTORY_LOOKBACK_DAYS, 'days').startOf('day').toDate();

        const [machines, workspace, periodLogs, historyLogs] = await Promise.all([
            machineService.find(
                { _id: { $in: machineIds }, workspaceId },
                { projection: { machineCode: 1, machineType: 1, panna: 1 }, useLean: true, sort: { machineCode: 1 } }
            ),
            workspaceService.findOne(
                { _id: workspaceId },
                { projection: { dayShift: 1, nightShift: 1 }, useLean: true }
            ),
            fetchLogs({ workspaceId, machineIds, start: periodStart, end: periodEnd, shifts: shiftList }),
            fetchLogs({ workspaceId, machineIds, start: historyStart, end: periodEnd, shifts: shiftList })
        ]);

        const machineMap = machines.reduce((acc, machine) => {
            acc[String(machine._id)] = machine;
            return acc;
        }, {});
        const periodAgg = {};
        const historyAgg = {};
        const availableCache = {};
        machines.forEach((machine) => {
            periodAgg[String(machine._id)] = emptyMachineAgg(machine);
            historyAgg[String(machine._id)] = emptyMachineAgg(machine);
        });

        for (const log of periodLogs) {
            const id = String(log.machineId);
            if (!periodAgg[id] || !machineMap[id]) continue;
            applyLog(periodAgg[id], log, machineMap[id], workspace, availableCache);
        }
        for (const log of historyLogs) {
            const id = String(log.machineId);
            if (!historyAgg[id] || !machineMap[id]) continue;
            applyLog(historyAgg[id], log, machineMap[id], workspace, availableCache);
        }

        const periodMachines = Object.values(periodAgg).map(finalizeMachine);
        const historyMachines = Object.values(historyAgg).map(finalizeMachine);
        const activeMachines = periodMachines.filter((machine) => machine.isActive);
        const factoryActive = activeMachines.filter((machine) => machine.productionMeters > 0);
        const averageBase = factoryActive.length ? factoryActive : activeMachines;
        const stopReasonTotals = {};
        averageBase.forEach((machine) => {
            machine.reasons.forEach((row) => {
                stopReasonTotals[row.key] = (stopReasonTotals[row.key] || 0) + row.count;
            });
        });
        const averages = {
            averageStops: averageBase.length ? average(averageBase.map((machine) => machine.totalStops)) : 0,
            averageDowntimeMinutes: averageBase.length ? average(averageBase.map((machine) => machine.downtimeMinutes)) : 0,
            averageEfficiency: averageBase.length ? average(averageBase.map((machine) => machine.efficiency)) : 0,
            averageRpm: averageBase.length ? average(averageBase.map((machine) => machine.averageRpm).filter((value) => value > 0)) : 0,
            maxLoss: Math.max(...periodMachines.map((machine) => machine.estimatedProductionLoss), 1),
            stopReasonAverages: Object.fromEntries(
                Object.entries(stopReasonTotals).map(([key, count]) => [key, averageBase.length ? count / averageBase.length : 0])
            )
        };

        const productionDays = [...new Set(historyLogs
            .filter((log) => (Number(log.picksCurrentShift) || 0) > 0 || (Number(log.pieceLengthM) || 0) > 0)
            .map((log) => moment(log.shiftDate).format('YYYY-MM-DD'))
        )].sort();

        const watchlist = buildWatchlist(historyMachines, productionDays, selectedTrendDays);
        const watchlistIds = new Set(watchlist.map((item) => item.machineId));
        const historyById = historyMachines.reduce((acc, machine) => {
            acc[machine.id] = machine;
            return acc;
        }, {});
        const attachHistory = (target, history) => {
            if (!history) return;
            const days7 = productionDays.slice(-7);
            const days30 = productionDays.slice(-30);
            const series30 = daySeries(history, days30);
            target.history7 = daySeries(history, days7);
            target.history30Average = {
                efficiency: round1(average(series30.map((day) => day.efficiency).filter((value) => value > 0))),
                downtimeMinutes: Math.round(average(series30.map((day) => day.downtimeMinutes))),
                productionMeters: Math.round(average(series30.map((day) => day.productionMeters)))
            };
        };

        periodMachines.forEach((machine) => attachHistory(machine, historyById[machine.id]));
        watchlist.forEach((item) => {
            const period = periodMachines.find((machine) => machine.id === item.machineId);
            attachHistory(item, historyById[item.machineId]);
            if (!period) return;
            item.productionMeters = Math.round(period.productionMeters);
            item.picks = period.picks;
            item.efficiency = period.efficiency;
            item.averageRpm = period.averageRpm;
            item.totalStops = period.totalStops;
            item.downtimeMinutes = period.downtimeMinutes;
            item.estimatedProductionLoss = period.estimatedProductionLoss;
            item.stopReasons = period.reasons.map((row) => ({
                ...row,
                estimatedLossMeters: period.estimatedProductionLoss && period.downtimeMinutes
                    ? Math.round(period.estimatedProductionLoss * (row.durationMinutes / Math.max(period.downtimeMinutes, 1)))
                    : 0
            }));
        });

        const scored = periodMachines
            .filter((machine) => machine.isActive)
            .map((machine) => buildPriority(machine, averages, watchlistIds));
        const priorityMachines = scored
            .filter((machine) => machine.severity !== 'normal')
            .sort((a, b) =>
                b.estimatedProductionLoss - a.estimatedProductionLoss
                || b.priorityScore - a.priorityScore
            )
            .slice(0, 5);

        const totalLoss = periodMachines.reduce((sum, machine) => sum + machine.estimatedProductionLoss, 0);
        const totalProduction = periodMachines.reduce((sum, machine) => sum + machine.productionMeters, 0);
        const totalDowntime = periodMachines.reduce((sum, machine) => sum + machine.downtimeMinutes, 0);
        const totalPicks = periodMachines.reduce((sum, machine) => sum + machine.picks, 0);
        const overallEfficiency = averageBase.length ? round1(average(averageBase.map((machine) => machine.efficiency))) : 0;
        const topLoss = [...periodMachines]
            .sort((a, b) => b.estimatedProductionLoss - a.estimatedProductionLoss)
            .filter((machine) => machine.estimatedProductionLoss > 0);
        const top5 = topLoss.slice(0, 5);
        const top5Share = totalLoss ? Math.round((top5.reduce((sum, machine) => sum + machine.estimatedProductionLoss, 0) / totalLoss) * 100) : 0;
        const opportunityMachines = (priorityMachines.length ? priorityMachines : top5)
            .filter((machine) => (machine.estimatedProductionLoss || 0) > 0)
            .slice(0, 2);
        const opportunityShare = totalLoss
            ? Math.round((opportunityMachines.reduce((sum, machine) => sum + machine.estimatedProductionLoss, 0) / totalLoss) * 100)
            : 0;
        const recoverable = Math.round(opportunityMachines.reduce((sum, machine) => sum + machine.estimatedProductionLoss, 0) * 0.5);

        const reasonTotals = {};
        periodMachines.forEach((machine) => {
            machine.reasons.forEach((row) => {
                if (!reasonTotals[row.key]) {
                    reasonTotals[row.key] = { reason: row.reason, durationMinutes: 0, count: 0, estimatedLossMeters: 0 };
                }
                reasonTotals[row.key].durationMinutes += row.durationMinutes;
                reasonTotals[row.key].count += row.count;
            });
        });
        const stopReasonLosses = Object.values(reasonTotals)
            .map((row) => ({
                ...row,
                estimatedLossMeters: totalDowntime
                    ? Math.round(totalLoss * (row.durationMinutes / totalDowntime))
                    : 0
            }))
            .sort((a, b) => b.estimatedLossMeters - a.estimatedLossMeters);

        const shiftLabel = shiftList.length > 1 ? 'All Shift' : (
            Number(shiftList[0]) === global.config.SHIFT_TYPE.NIGHT ? 'Night Shift' : 'Day Shift'
        );

        return {
            periodLabel: periodLabel(startDate, endDate, shiftLabel),
            trendDays: selectedTrendDays,
            weights: PRIORITY_WEIGHTS,
            summary: {
                totalProductionMeters: Math.round(totalProduction),
                overallEfficiency,
                totalPicks,
                totalDowntimeMinutes: totalDowntime,
                estimatedProductionLoss: totalLoss,
                machinesNeedingAction: priorityMachines.length,
                watchlistCount: watchlist.length
            },
            factoryAverage: {
                averageStops: round1(averages.averageStops),
                averageDowntimeMinutes: round1(averages.averageDowntimeMinutes),
                averageEfficiency: round1(averages.averageEfficiency),
                averageRpm: Math.round(averages.averageRpm || 0)
            },
            productionOpportunity: {
                headline: opportunityMachines.length === 2
                    ? `${opportunityMachines[0].machineName} and ${opportunityMachines[1].machineName} contributed ${opportunityShare}% of estimated production loss. Start with these two machines.`
                    : opportunityMachines.length === 1
                        ? `${opportunityMachines[0].machineName} contributed ${opportunityShare}% of estimated production loss. Start with this machine.`
                        : 'No significant production loss was identified for the selected period.',
                supporting: recoverable
                    ? `Reducing the major identified issues by 50% could potentially recover approximately ${formatMeters(recoverable)} of production.`
                    : 'Keep monitoring stop reasons and downtime to protect daily output.'
            },
            priorityMachines,
            maintenanceWatchlist: {
                criticalCount: watchlist.filter((item) => item.status === 'critical').length,
                watchCount: watchlist.filter((item) => item.status === 'watch').length,
                machines: watchlist
            },
            productionLossBreakdown: {
                topSharePercent: top5Share,
                summary: top5.length
                    ? `Top ${top5.length} machine${top5.length === 1 ? '' : 's'} caused ${top5Share}% of total estimated production loss.`
                    : 'No estimated production loss for the selected period.',
                rows: topLoss.map((machine) => ({
                    machineId: machine.id,
                    machineName: machine.name,
                    estimatedLossMeters: machine.estimatedProductionLoss,
                    downtimeMinutes: machine.downtimeMinutes,
                    mainReason: machine.topReason?.reason || '-'
                }))
            },
            stopReasonLosses,
            recommendations: buildRecommendations(priorityMachines, watchlist, stopReasonLosses)
        };
    }
};
