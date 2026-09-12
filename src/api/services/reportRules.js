/**
 * Shared report rules used by Monthly Summary and Production Intelligence.
 *
 * Beam-change / setup period:
 * A loom may sit stopped while a beam is changed. Those logs have
 * picksCurrentShift < 1000 and are expected operational downtime.
 * They must not drive actionable downtime, stop counts, production loss,
 * priority, watchlist, or recommendations.
 *
 * Field: machineLogs.picksCurrentShift (also accepts currentShiftPicks).
 *
 * Missing / invalid picks:
 * Historical documents may omit this field. Do not treat that as 0.
 * If picks cannot be read as a finite number, keep legacy behavior
 * and include the log's stops.
 */

const ACTIONABLE_PICKS_THRESHOLD = 1000;

function readPicksCurrentShift(log) {
    const raw = log == null ? undefined : (log.picksCurrentShift ?? log.currentShiftPicks);
    if (raw === null || raw === undefined || raw === '') return null;
    const value = typeof raw === 'number' ? raw : Number(String(raw).trim());
    if (!Number.isFinite(value)) return null;
    return value;
}

function isProductionRelevantStop(log) {
    const picks = readPicksCurrentShift(log);
    if (picks === null) return true;
    return picks >= ACTIONABLE_PICKS_THRESHOLD;
}

function getActionableStopStats(log, stopKeys = []) {
    if (!isProductionRelevantStop(log)) {
        return {
            actionable: false,
            count: 0,
            durationSeconds: 0,
            reasons: {}
        };
    }

    const reasons = {};
    let count = 0;
    let durationSeconds = 0;
    for (const key of stopKeys) {
        const rowCount = Number(log?.stopsCount?.[key]?.count) || 0;
        const duration = Number(log?.stopsCount?.[key]?.duration) || 0;
        reasons[key] = { count: rowCount, durationSeconds: duration };
        count += rowCount;
        durationSeconds += duration;
    }

    return {
        actionable: true,
        count,
        durationSeconds,
        reasons
    };
}

function actionableDowntimeMinutes(log, stopKeys = []) {
    return Math.round(getActionableStopStats(log, stopKeys).durationSeconds / 60);
}

function getActionableLongStopSeconds(log, stopsData = {}, stopKeys = [], minSeconds = 600) {
    if (!isProductionRelevantStop(log)) return 0;
    let total = 0;
    for (const key of stopKeys) {
        const events = stopsData[key] || [];
        for (const event of events) {
            const duration = Number(event?.duration) || 0;
            if (duration >= minSeconds) total += duration;
        }
    }
    return total;
}

module.exports = {
    ACTIONABLE_PICKS_THRESHOLD,
    readPicksCurrentShift,
    isProductionRelevantStop,
    getActionableStopStats,
    actionableDowntimeMinutes,
    getActionableLongStopSeconds
};
