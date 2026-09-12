const moment = require('moment');

const alertConfigService = require('./alertConfigService');
const { readPicksCurrentShift } = require('./reportRules');

const {
    MACHINE_ATTENTION_GROUP,
    ATTENTION_REASON_CODE,
    ATTENTION_GROUP_ORDER,
    DEFAULT_MACHINE_ATTENTION_CONFIG,
} = global.config;

const REASON_PRIORITY = {
    [ATTENTION_REASON_CODE.LONG_CURRENT_STOP]: 1,
    [ATTENTION_REASON_CODE.REPEATED_STOP]: 2,
    [ATTENTION_REASON_CODE.HIGH_RECENT_DOWNTIME]: 3,
    [ATTENTION_REASON_CODE.LOW_EFFICIENCY]: 4,
    [ATTENTION_REASON_CODE.LOW_SPEED]: 5,
    [ATTENTION_REASON_CODE.BELOW_FACTORY_AVERAGE]: 6,
};

const STOP_KEY_LABELS = {
    warp: 'Warp',
    weft: 'Weft',
    feeder: 'Feeder',
    manual: 'Manual',
    other: 'Other',
    h1: 'H1',
    h2: 'H2',
};

function cloneDefaults() {
    return JSON.parse(JSON.stringify(DEFAULT_MACHINE_ATTENTION_CONFIG));
}

function shouldEvaluateMachineAttention(machineLog) {
    const picks = readPicksCurrentShift(machineLog);
    if (picks === null) return true;
    return picks >= 1000;
}

function getStopKeys(machineType) {
    return global.config.MACHINE_TYPE_KEY_MAPPING[machineType]
        || global.config.MACHINE_TYPE_KEY_MAPPING.rapier;
}

function resolveNow(now) {
    return moment.isMoment(now) ? now : moment(now || undefined);
}

function getCurrentStopDurationMinutes(machineLog, now = moment()) {
    if (Number(machineLog.stop) === 0) return 0;

    const lastStopTime = machineLog.machineId?.lastStopTime || machineLog.lastStopTime;
    if (!lastStopTime) return 0;

    return Math.floor(resolveNow(now).diff(moment(lastStopTime), 'minutes', true));
}

function getRunningDurationMinutes(machineLog, now = moment()) {
    if (Number(machineLog.stop) !== 0) return 0;

    const lastStartTime = machineLog.machineId?.lastStartTime || machineLog.lastStartTime;
    if (!lastStartTime) return 0;

    return Math.floor(resolveNow(now).diff(moment(lastStartTime), 'minutes', true));
}

function getStopsData(machineLog) {
    return machineLog.machineId?.stopsData || machineLog.stopsData || {};
}

function countEventsInWindow(events = [], windowMinutes, now = moment()) {
    const resolvedNow = resolveNow(now);
    const windowStart = resolvedNow.clone().subtract(windowMinutes, 'minutes');
    let count = 0;

    for (const event of events) {
        if (!event) continue;
        const start = event.start ? moment(event.start) : null;
        if (!start?.isValid()) continue;
        const end = event.end ? moment(event.end) : resolvedNow;
        if (end.isBefore(windowStart) || start.isAfter(resolvedNow)) continue;
        count += 1;
    }

    return count;
}

function getDowntimeMinutesInWindow(stopsData, stopKeys, windowMinutes, now = moment()) {
    const resolvedNow = resolveNow(now);
    const windowStart = resolvedNow.clone().subtract(windowMinutes, 'minutes');
    let totalSeconds = 0;

    for (const key of stopKeys) {
        const events = stopsData[key] || [];
        for (const event of events) {
            if (!event) continue;
            const start = event.start ? moment(event.start) : null;
            if (!start?.isValid()) continue;
            const end = event.end ? moment(event.end) : resolvedNow;
            const overlapStart = moment.max(start, windowStart);
            const overlapEnd = moment.min(end, resolvedNow);
            if (overlapEnd.isAfter(overlapStart)) {
                totalSeconds += overlapEnd.diff(overlapStart, 'seconds');
            }
        }
    }

    return Math.floor(totalSeconds / 60);
}

function sortReasons(reasons = []) {
    return [...reasons].sort((a, b) => {
        const priorityDiff = (REASON_PRIORITY[a.code] || 99) - (REASON_PRIORITY[b.code] || 99);
        if (priorityDiff !== 0) return priorityDiff;
        return String(a.label).localeCompare(String(b.label));
    });
}

function normalizeCriterion(criterion = {}, defaults = {}) {
    const normalized = {
        enabled: typeof criterion.enabled === 'boolean' ? criterion.enabled : defaults.enabled ?? false,
    };

    for (const key of Object.keys(defaults)) {
        if (key === 'enabled') continue;
        const value = Number(criterion[key]);
        normalized[key] = Number.isFinite(value) ? value : defaults[key];
    }

    return normalized;
}

function normalizeGroupCriteria(groupConfig = {}, defaultGroup = {}) {
    const normalized = {};
    for (const [key, defaults] of Object.entries(defaultGroup)) {
        normalized[key] = normalizeCriterion(groupConfig[key], defaults);
    }
    return normalized;
}

function validateMachineAttentionConfig(config = {}) {
    const errors = [];

    const validateMinutes = (value, path) => {
        if (!Number.isFinite(value) || value < 0) errors.push(`${path} must be a non-negative number`);
    };
    const validatePercent = (value, path) => {
        if (!Number.isFinite(value) || value < 0 || value > 100) errors.push(`${path} must be between 0 and 100`);
    };
    const validateCount = (value, path) => {
        if (!Number.isFinite(value) || value < 1) errors.push(`${path} must be at least 1`);
    };
    const validateWindow = (value, path) => {
        if (!Number.isFinite(value) || value < 1 || value > 24 * 60) {
            errors.push(`${path} must be between 1 and 1440 minutes`);
        }
    };

    for (const groupKey of ATTENTION_GROUP_ORDER) {
        const group = config[groupKey] || {};
        for (const [criterionKey, criterion] of Object.entries(group)) {
            if (!criterion || typeof criterion !== 'object') continue;
            const base = `${groupKey}.${criterionKey}`;

            if (criterion.minutes != null) validateMinutes(Number(criterion.minutes), `${base}.minutes`);
            if (criterion.below != null) validatePercent(Number(criterion.below), `${base}.below`);
            if (criterion.belowExpectedPercent != null) {
                validatePercent(Number(criterion.belowExpectedPercent), `${base}.belowExpectedPercent`);
            }
            if (criterion.differencePercent != null) {
                validatePercent(Number(criterion.differencePercent), `${base}.differencePercent`);
            }
            if (criterion.count != null) validateCount(Number(criterion.count), `${base}.count`);
            if (criterion.windowMinutes != null) validateWindow(Number(criterion.windowMinutes), `${base}.windowMinutes`);
            if (criterion.durationMinutes != null) validateMinutes(Number(criterion.durationMinutes), `${base}.durationMinutes`);
        }
    }

    return errors;
}

function normalizeMachineAttentionConfig(savedConfig) {
    const defaults = cloneDefaults();
    const source = savedConfig && typeof savedConfig === 'object' ? savedConfig : {};

    return {
        enabled: typeof source.enabled === 'boolean' ? source.enabled : defaults.enabled,
        fixnow: normalizeGroupCriteria(source.fixnow, defaults.fixnow),
        needsattention: normalizeGroupCriteria(source.needsattention, defaults.needsattention),
        watch: normalizeGroupCriteria(source.watch, defaults.watch),
    };
}

function mergeMachineAttentionUpdates(baseConfig = {}, updates = {}) {
    const normalizedBase = normalizeMachineAttentionConfig(baseConfig);
    const merged = JSON.parse(JSON.stringify(normalizedBase));

    if (typeof updates.enabled === 'boolean') {
        merged.enabled = updates.enabled;
    }

    for (const groupKey of ATTENTION_GROUP_ORDER) {
        if (!updates[groupKey] || typeof updates[groupKey] !== 'object') continue;
        for (const [criterionKey, criterion] of Object.entries(updates[groupKey])) {
            if (!criterion || typeof criterion !== 'object') continue;
            merged[groupKey][criterionKey] = {
                ...merged[groupKey][criterionKey],
                ...criterion,
            };
        }
    }

    return normalizeMachineAttentionConfig(merged);
}

function evaluateCurrentStop(machineLog, criterion, now) {
    if (!criterion?.enabled) return null;

    const durationMinutes = getCurrentStopDurationMinutes(machineLog, now);
    if (durationMinutes < criterion.minutes) return null;

    return {
        code: ATTENTION_REASON_CODE.LONG_CURRENT_STOP,
        label: `Stopped for ${durationMinutes} min`,
        metric: 'currentStopDuration',
        value: durationMinutes,
        threshold: criterion.minutes,
    };
}

function evaluateEfficiency(machineLog, criterion) {
    if (!criterion?.enabled) return null;
    if (!shouldEvaluateMachineAttention(machineLog)) return null;

    const efficiency = Number(machineLog.efficiencyPercent);
    if (!Number.isFinite(efficiency) || efficiency >= criterion.below) return null;

    return {
        code: ATTENTION_REASON_CODE.LOW_EFFICIENCY,
        label: `Efficiency ${Math.round(efficiency)}%`,
        metric: 'efficiency',
        value: Math.round(efficiency),
        threshold: criterion.below,
    };
}

function evaluateRepeatedStops(machineLog, criterion, now) {
    if (!criterion?.enabled) return null;

    const machineType = machineLog.machineId?.machineType || machineLog.machineType || 'rapier';
    const stopKeys = getStopKeys(machineType);
    const stopsData = getStopsData(machineLog);

    let bestMatch = null;
    for (const key of stopKeys) {
        const count = countEventsInWindow(stopsData[key], criterion.windowMinutes, now);
        if (count < criterion.count) continue;

        const labelKey = STOP_KEY_LABELS[key] || key;
        const candidate = {
            code: ATTENTION_REASON_CODE.REPEATED_STOP,
            label: `${labelKey} stopped ${count} times in last ${criterion.windowMinutes} min`,
            metric: `${key}StopCount`,
            value: count,
            threshold: criterion.count,
        };

        if (!bestMatch || candidate.value > bestMatch.value) {
            bestMatch = candidate;
        }
    }

    return bestMatch;
}

function evaluateDowntime(machineLog, criterion, now) {
    if (!criterion?.enabled) return null;

    const machineType = machineLog.machineId?.machineType || machineLog.machineType || 'rapier';
    const stopKeys = getStopKeys(machineType);
    const stopsData = getStopsData(machineLog);
    const downtimeMinutes = getDowntimeMinutesInWindow(stopsData, stopKeys, criterion.windowMinutes, now);

    if (downtimeMinutes < criterion.minutes) return null;

    return {
        code: ATTENTION_REASON_CODE.HIGH_RECENT_DOWNTIME,
        label: `${downtimeMinutes} min downtime in last ${criterion.windowMinutes} min`,
        metric: 'recentDowntimeMinutes',
        value: downtimeMinutes,
        threshold: criterion.minutes,
    };
}

function evaluateLowSpeed(machineLog, criterion, now) {
    if (!criterion?.enabled) return null;
    if (Number(machineLog.stop) !== 0) return null;

    const maxSpeedLimit = Number(machineLog.machineId?.maxSpeedLimit ?? machineLog.maxSpeedLimit);
    if (!Number.isFinite(maxSpeedLimit) || maxSpeedLimit <= 0) return null;

    const speedRpm = Number(machineLog.speedRpm);
    if (!Number.isFinite(speedRpm) || speedRpm <= 0) return null;

    const expectedSpeed = maxSpeedLimit * (criterion.belowExpectedPercent / 100);
    if (speedRpm >= expectedSpeed) return null;

    const runningMinutes = getRunningDurationMinutes(machineLog, now);
    if (runningMinutes < criterion.durationMinutes) return null;

    const belowPercent = Math.round(((maxSpeedLimit - speedRpm) / maxSpeedLimit) * 100);
    return {
        code: ATTENTION_REASON_CODE.LOW_SPEED,
        label: `Speed ${belowPercent}% below expected`,
        metric: 'speedBelowExpectedPercent',
        value: belowPercent,
        threshold: 100 - criterion.belowExpectedPercent,
    };
}

function evaluateBelowFactoryAverage(machineLog, criterion, factoryStats) {
    if (!criterion?.enabled) return null;
    if (!shouldEvaluateMachineAttention(machineLog)) return null;

    const factoryAverage = Number(factoryStats?.averageEfficiency);
    const efficiency = Number(machineLog.efficiencyPercent);
    if (!Number.isFinite(factoryAverage) || factoryAverage <= 0 || !Number.isFinite(efficiency)) return null;

    const difference = factoryAverage - efficiency;
    if (difference < criterion.differencePercent) return null;

    return {
        code: ATTENTION_REASON_CODE.BELOW_FACTORY_AVERAGE,
        label: `Efficiency ${Math.round(efficiency)}% vs factory ${Math.round(factoryAverage)}%`,
        metric: 'efficiencyVsFactoryAverage',
        value: Math.round(difference),
        threshold: criterion.differencePercent,
    };
}

function evaluateGroupCriteria(machineLog, groupKey, groupConfig, factoryStats, now) {
    const reasons = [];
    const evaluators = [
        () => evaluateCurrentStop(machineLog, groupConfig.currentStop, now),
        () => evaluateEfficiency(machineLog, groupConfig.efficiency),
        () => evaluateRepeatedStops(machineLog, groupConfig.repeatedSameStop, now),
        () => evaluateDowntime(machineLog, groupConfig.downtime, now),
        () => evaluateLowSpeed(machineLog, groupConfig.lowSpeed, now),
        () => evaluateBelowFactoryAverage(machineLog, groupConfig.belowFactoryAverage, factoryStats),
    ];

    for (const evaluate of evaluators) {
        const reason = evaluate();
        if (reason) {
            reasons.push({ ...reason, group: groupKey });
        }
    }

    return reasons;
}

function computeFactoryStats(machineLogs = []) {
    let efficiencySum = 0;
    let efficiencyCount = 0;

    for (const log of machineLogs) {
        if (!shouldEvaluateMachineAttention(log)) continue;
        const efficiency = Number(log.efficiencyPercent);
        if (Number.isFinite(efficiency) && efficiency > 0) {
            efficiencySum += efficiency;
            efficiencyCount += 1;
        }
    }

    return {
        averageEfficiency: efficiencyCount ? efficiencySum / efficiencyCount : 0,
        machineCount: machineLogs.length,
    };
}

function calculateMachineAttentionGroup({
    machineLog,
    attentionConfig,
    factoryStats = {},
    now = moment(),
}) {
    const resolvedNow = resolveNow(now);

    if (!attentionConfig?.enabled) {
        return {
            attentiongroup: MACHINE_ATTENTION_GROUP.GOOD,
            attentionReasons: [],
        };
    }

    if (!shouldEvaluateMachineAttention(machineLog)) {
        return {
            attentiongroup: MACHINE_ATTENTION_GROUP.GOOD,
            attentionReasons: [],
        };
    }

    for (const groupKey of ATTENTION_GROUP_ORDER) {
        const groupReasons = evaluateGroupCriteria(
            machineLog,
            groupKey,
            attentionConfig[groupKey] || {},
            factoryStats,
            resolvedNow
        );

        if (!groupReasons.length) continue;

        return {
            attentiongroup: groupKey,
            attentionReasons: sortReasons(
                groupReasons.map(({ group, ...reason }) => reason)
            ),
        };
    }

    return {
        attentiongroup: MACHINE_ATTENTION_GROUP.GOOD,
        attentionReasons: [],
    };
}

module.exports = {
    cloneDefaults,
    normalizeMachineAttentionConfig,
    mergeMachineAttentionUpdates,
    validateMachineAttentionConfig,
    computeFactoryStats,
    calculateMachineAttentionGroup,
    sortReasons,
    shouldEvaluateMachineAttention,
    getCurrentStopDurationMinutes,
    countEventsInWindow,
    getDowntimeMinutesInWindow,

    async resolveAttentionConfig(workspaceId) {
        const workspaceConfig = await alertConfigService.findOne(
            { workspaceId, userId: null },
            { useLean: true, projection: { machineAttention: 1 } }
        );
        return normalizeMachineAttentionConfig(workspaceConfig?.machineAttention);
    },

    async upsertWorkspaceMachineAttention(workspaceId, machineAttention) {
        const existing = await alertConfigService.findOne(
            { workspaceId, userId: null },
            { useLean: true, projection: { machineAttention: 1 } }
        );
        const merged = mergeMachineAttentionUpdates(existing?.machineAttention, machineAttention);
        const errors = validateMachineAttentionConfig(merged);
        if (errors.length) {
            const error = new Error(errors.join('; '));
            error.statusCode = 400;
            throw error;
        }

        await alertConfigModel.findOneAndUpdate(
            { workspaceId, userId: null, isDeleted: false },
            {
                $set: { machineAttention: merged },
                $setOnInsert: {
                    workspaceId,
                    userId: null,
                    isDeleted: false,
                    alerts: alertConfigService.defaultAlerts({ readOnly: false }),
                },
            },
            { upsert: true, new: true }
        ).lean();

        return merged;
    },

    shouldIncludeAttention(body = {}) {
        if (body.includeAttention === true) return true;
        if (String(body.includeAttention).toLowerCase() === 'true') return true;
        if (body.groupBy === 'attention') return true;
        return false;
    },

    async attachAttentionGroups(machineData, rawLogs, workspaceId) {
        if (!Array.isArray(machineData) || !machineData.length) return machineData;

        const attentionConfig = await this.resolveAttentionConfig(workspaceId);
        const factoryStats = computeFactoryStats(rawLogs || []);
        const now = moment();
        const attentionByCode = new Map();

        for (const logData of rawLogs || []) {
            const machineCode = logData.machineId?.machineCode;
            if (!machineCode) continue;

            attentionByCode.set(machineCode, calculateMachineAttentionGroup({
                machineLog: logData,
                attentionConfig,
                factoryStats,
                now,
            }));
        }

        for (const row of machineData) {
            const result = attentionByCode.get(row.machineCode) || {
                attentiongroup: MACHINE_ATTENTION_GROUP.GOOD,
                attentionReasons: [],
            };
            row.attentiongroup = result.attentiongroup;
            row.attentionReasons = result.attentionReasons;
        }

        return machineData;
    },
};
