const enTranslation = require('../../public/translation/en.json');

const MACHINE_ATTENTION_GROUP = {
    FIX_NOW: 'fixnow',
    NEEDS_ATTENTION: 'needsattention',
    WATCH: 'watch',
    GOOD: 'good',
};

const ATTENTION_REASON_CODE = {
    LONG_CURRENT_STOP: 'LONG_CURRENT_STOP',
    LOW_EFFICIENCY: 'LOW_EFFICIENCY',
    REPEATED_STOP: 'REPEATED_STOP',
    HIGH_RECENT_DOWNTIME: 'HIGH_RECENT_DOWNTIME',
    LOW_SPEED: 'LOW_SPEED',
    BELOW_FACTORY_AVERAGE: 'BELOW_FACTORY_AVERAGE',
};

const ATTENTION_GROUP_ORDER = [
    MACHINE_ATTENTION_GROUP.FIX_NOW,
    MACHINE_ATTENTION_GROUP.NEEDS_ATTENTION,
    MACHINE_ATTENTION_GROUP.WATCH,
];

const DEFAULT_MACHINE_ATTENTION_CONFIG = {
    enabled: true,
    fixnow: {
        currentStop: { enabled: true, minutes: 10 },
        efficiency: { enabled: true, below: 70 },
        repeatedSameStop: { enabled: true, count: 5, windowMinutes: 15 },
        downtime: { enabled: true, minutes: 20, windowMinutes: 30 },
    },
    needsattention: {
        currentStop: { enabled: true, minutes: 3 },
        efficiency: { enabled: true, below: 85 },
        repeatedSameStop: { enabled: true, count: 3, windowMinutes: 15 },
        downtime: { enabled: true, minutes: 10, windowMinutes: 30 },
        lowSpeed: { enabled: true, belowExpectedPercent: 85, durationMinutes: 5 },
    },
    watch: {
        efficiency: { enabled: true, below: 90 },
        repeatedSameStop: { enabled: true, count: 2, windowMinutes: 15 },
        lowSpeed: { enabled: true, belowExpectedPercent: 92, durationMinutes: 5 },
        belowFactoryAverage: { enabled: false, differencePercent: 10 },
    },
};

const MACHINE_ATTENTION_SCHEMA_WEB = {
    fixnow: {
        title: enTranslation.machineAttentionFixNow || 'Fix Now',
        criteria: {
            currentStop: {
                title: 'Current Stop',
                description: 'Machine stopped for more than',
                unit: 'minutes',
                fields: ['minutes'],
            },
            efficiency: {
                title: 'Efficiency',
                description: 'Efficiency below',
                unit: '%',
                fields: ['below'],
            },
            repeatedSameStop: {
                title: 'Repeated Stop',
                description: 'Same stop happens',
                unit: 'times within',
                unit2: 'minutes',
                fields: ['count', 'windowMinutes'],
            },
            downtime: {
                title: 'Downtime',
                description: 'More than',
                unit: 'minutes downtime within',
                unit2: 'minutes',
                fields: ['minutes', 'windowMinutes'],
            },
        },
    },
    needsattention: {
        title: enTranslation.machineAttentionNeedsAttention || 'Needs Attention',
        criteria: {
            currentStop: {
                title: 'Current Stop',
                description: 'Machine stopped for more than',
                unit: 'minutes',
                fields: ['minutes'],
            },
            efficiency: {
                title: 'Efficiency',
                description: 'Efficiency below',
                unit: '%',
                fields: ['below'],
            },
            repeatedSameStop: {
                title: 'Repeated Stop',
                description: 'Same stop happens',
                unit: 'times within',
                unit2: 'minutes',
                fields: ['count', 'windowMinutes'],
            },
            downtime: {
                title: 'Downtime',
                description: 'More than',
                unit: 'minutes downtime within',
                unit2: 'minutes',
                fields: ['minutes', 'windowMinutes'],
            },
            lowSpeed: {
                title: 'Low Speed',
                description: 'Speed below',
                unit: '% of expected for',
                unit2: 'minutes',
                fields: ['belowExpectedPercent', 'durationMinutes'],
            },
        },
    },
    watch: {
        title: enTranslation.machineAttentionWatch || 'Watch',
        criteria: {
            efficiency: {
                title: 'Efficiency',
                description: 'Efficiency below',
                unit: '%',
                fields: ['below'],
            },
            repeatedSameStop: {
                title: 'Repeated Stop',
                description: 'Same stop happens',
                unit: 'times within',
                unit2: 'minutes',
                fields: ['count', 'windowMinutes'],
            },
            lowSpeed: {
                title: 'Low Speed',
                description: 'Speed below',
                unit: '% of expected for',
                unit2: 'minutes',
                fields: ['belowExpectedPercent', 'durationMinutes'],
            },
            belowFactoryAverage: {
                title: 'Below Factory Average',
                description: 'Efficiency more than',
                unit: '% below factory average',
                fields: ['differencePercent'],
            },
        },
    },
};

module.exports = {
    MACHINE_ATTENTION_GROUP,
    ATTENTION_REASON_CODE,
    ATTENTION_GROUP_ORDER,
    DEFAULT_MACHINE_ATTENTION_CONFIG,
    MACHINE_ATTENTION_SCHEMA_WEB,
};
