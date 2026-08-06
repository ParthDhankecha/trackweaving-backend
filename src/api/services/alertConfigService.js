const notificationService = require('./notificationService');
const whatsappService = require('./whatsappService');
const utilService = require('./utilService');

const ALERT_KEYS = ['pickChange', 'maxSpeed', 'lowSpeed', 'beamLeft', 'machineStopped'];
const CHANNEL_KEYS = ['notification', 'whatsapp'];
const CONFIG_FIELDS = {
    beamLeft: ['thresholds'],
    machineStopped: ['minutes']
};

/** workspaceId -> { workspaceAlerts, userAlerts: Map<userId, alerts> } */
const workspaceAlertCache = new Map();

function normalizeChannelValue(value, defaultValue = true) {
    return typeof value === 'boolean' ? value : defaultValue;
}

function normalizeCommaSeparated(value, fallback, { readOnly = true } = {}) {
    if (readOnly) {
        if (Array.isArray(value || fallback)) {
            return [...(value || fallback)];
        }

        return [...(new Set(String(value || fallback)
            .split(',')
            .map(part => Number(part.trim()))
            .filter(num => Number.isFinite(num))
        ))].sort((a, b) => b - a);
    }

    const source = typeof value === 'string' && value.trim() ? value : fallback;
    return [...new Set(String(source)
        .split(',')
        .map(part => part.trim())
        .filter(Boolean))
    ].join(',');
}

function normalizeAlertEntry(key, alerts = {}, defaults = {}, { readOnly = true } = {}) {
    const defEntry = defaults[key] || {};
    const entry = alerts[key];

    if (!entry || typeof entry !== 'object') {
        return {
            notification: defEntry.notification ?? true,
            whatsapp: defEntry.whatsapp ?? false,
            // ...(CONFIG_FIELDS[key] || []).reduce((acc, field) => {
            //     acc[field] = defEntry[field];
            //     return acc;
            // }, {})
        };
    }

    const normalized = {
        notification: normalizeChannelValue(entry.notification, defEntry.notification ?? true),
        whatsapp: normalizeChannelValue(entry.whatsapp, defEntry.whatsapp ?? false)
    };

    for (const field of CONFIG_FIELDS[key] || []) {
        normalized[field] = normalizeCommaSeparated(entry[field], defEntry[field], { readOnly });
    }

    return normalized;
}

module.exports = {
    ALERT_KEYS,
    CHANNEL_KEYS,

    /**
     * Sync workspace alerts to ensure all workspaces have a default alert config.
     * This function deletes any alert configs where pickChange is not a boolean,
     * then ensures each workspace has a default alert config.
     * @returns {Promise<void>}
     */
    async syncWorkspaceAlerts() {
        try {
            const del = await alertConfigModel.deleteMany({ 'alerts.pickChange': { $type: 'bool' } });
            console.log('Deleted old alert configs', del);

            const workspaceIds = await workspaceModel.distinct('_id', { isDeleted: false });
            for (const workspaceId of workspaceIds) {
                await this.ensureWorkspaceDefault(workspaceId);
            }
        } catch (error) {
            console.error(error);
            return null;
        }
    },

    defaultAlerts({ readOnly = true } = {}) {
        const alerts = JSON.parse(JSON.stringify(global.config.DEFAULT_ALERT_FLAGS || {}));
        if (!readOnly) {
            return alerts;
        }

        const normalized = {};
        for (const key of ALERT_KEYS) {
            normalized[key] = normalizeAlertEntry(key, alerts, undefined, { readOnly });
        }
        return normalized;
    },

    normalizeAlerts(alerts = {}, { readOnly = true } = {}) {
        const defaults = this.defaultAlerts({ readOnly });
        const normalized = {};
        for (const key of ALERT_KEYS) {
            normalized[key] = normalizeAlertEntry(key, alerts, defaults, { readOnly });
        }
        return normalized;
    },

    mergeAlertUpdates(baseAlerts = {}, updates = {}, { returnNormalized = true } = {}) {
        const merged = JSON.parse(JSON.stringify(
            this.normalizeAlerts(baseAlerts, { readOnly: false })
        ));

        for (const key of ALERT_KEYS) {
            const update = updates[key];
            if (!update || typeof update !== 'object') continue;

            merged[key] = {
                ...merged[key],
                ...update
            };
        }

        if (returnNormalized) {
            return this.normalizeAlerts(merged, { readOnly: false });
        }
        return merged;
    },

    parseCommaSeparatedNumbers(value, fallback = []) {
        const source = typeof value === 'string' && value.trim() ? value : fallback.map(Number).join(',');

        return [...new Set(String(source).split(',')
            .map(part => Number(part.trim()))
            .filter(num => Number.isFinite(num))
        )].sort((a, b) => b - a);
    },

    /**
     * Match an actual reading against comma-separated config tiers (not exact equality).
     * beamLeft: value 12 with tiers [1,10,20] matches users who configured 20 (below 20, not yet 10).
     */
    matchesConfigValue(configuredValues, value, alertType) {
        if (!configuredValues?.length) return false;

        if (alertType === 'beamLeft') {
            return configuredValues.some(t => {
                return value <= t && value > t - 5;// 5 meters threshold: 12 <= 20 && 12 > 15
            });
        }

        return configuredValues.includes(value);
    },

    /**
     * Stop alerts: logs arrive at imprecise intervals, so match elapsed time to a tier bucket.
     * tierMinute — checkpoint being fired (from union minutes loop, e.g. 10 or 20)
     * stoppedMinutes — actual elapsed stop duration (e.g. 12 when the log arrives late)
     *
     * User must have tierMinute configured AND stoppedMinutes must fall in that tier's window.
     * Descending tiers [20,10]: 12 min → 10-tier; 25 min → 20-tier (not 10-tier).
     */
    matchesStopTier(configuredValues, tierMinute, stoppedMinutes) {
        if (!configuredValues?.length) return false;

        return configuredValues.includes(tierMinute) && stoppedMinutes >= tierMinute;
        // if (!configuredValues?.length || !configuredValues.includes(tierMinute)) {
        //     return false;
        // }

        // const sorted = [...configuredValues].sort((a, b) => b - a);
        // for (let i = 0; i < sorted.length; i++) {
        //     if (stoppedMinutes >= sorted[i] && sorted[i] === tierMinute) {
        //         return true;
        //     }
        // }

        // // Delayed log: elapsed time skipped past this tier's window but checkpoint not yet sent
        // return stoppedMinutes >= tierMinute;
    },

    isChannelEnabled(alerts, alertType, channel = 'notification') {
        const entry = alerts?.[alertType];
        if (!entry || typeof entry !== 'object') {
            return true;
        }
        if (typeof entry[channel] !== 'boolean') {
            return true;
        }
        return entry[channel];
    },


    async getUsersForAlert(filter = {}, options = {}) {
        const query = userModel.find({
            ...filter,
            isDeleted: false,
            isActive: true,
        }, options);

        const {
            projection = { _id: 1, mobile: 1 },
            useLean = true,
        } = options;
        if (projection) query.select(projection);
        if (useLean) query.lean();

        return await query;
    },

    async getUnionBeamThresholds(workspaceId) {
        const cache = await this.ensureWorkspaceCache(workspaceId);
        const workspaceAlerts = cache?.workspaceAlerts || this.defaultAlerts();
        const thresholds = new Set(workspaceAlerts?.beamLeft?.thresholds);

        for (const userAlerts of (cache?.userAlerts || new Map()).values()) {
            const effectiveAlerts = this.resolveEffectiveAlerts(workspaceAlerts, userAlerts);
            effectiveAlerts?.beamLeft?.thresholds?.forEach(
                value => thresholds.add(value)
            );
        }

        return [...thresholds].sort((a, b) => b - a);// descending order: 20, 10, 1
    },

    async getUnionStopMinutes(workspaceId) {
        const cache = await this.ensureWorkspaceCache(workspaceId);
        const workspaceAlerts = cache?.workspaceAlerts || this.defaultAlerts();
        const minutes = new Set(workspaceAlerts?.machineStopped?.minutes);

        for (const userAlerts of (cache?.userAlerts || new Map()).values()) {
            const effectiveAlerts = this.resolveEffectiveAlerts(workspaceAlerts, userAlerts);
            effectiveAlerts?.machineStopped?.minutes?.forEach(
                value => minutes.add(value)
            );
        }

        return [...minutes].sort((a, b) => b - a);// descending order: 20, 10, 1
    },

    async filterUsersForBeamThreshold(workspaceId, users, threshold) {
        return this.filterUsersForConfigMatch({
            workspaceId: workspaceId,
            users: users,
            alertType: 'beamLeft',
            field: 'thresholds',
        }, {
            thresholdValue: threshold
        });
    },

    async filterUsersForStopMinute(workspaceId, users, tierMinute, stoppedMinutes) {
        return this.filterUsersForConfigMatch({
            workspaceId: workspaceId,
            users: users,
            alertType: 'machineStopped',
            field: 'minutes',
        }, {
            thresholdValue: stoppedMinutes,
            tierMinute: tierMinute,
        });
    },

    async filterUsersForConfigMatch({ workspaceId, users, alertType, field }, data = {}) {
        const recipients = { notification: [], whatsapp: [] };
        if (!users?.length) return recipients;
        if (!['beamLeft', 'machineStopped'].includes(alertType)) return recipients;

        const cache = await this.ensureWorkspaceCache(workspaceId);
        const workspaceAlerts = cache?.workspaceAlerts || this.defaultAlerts();
        const userAlerts = cache?.userAlerts || new Map();

        const { thresholdValue } = data;
        for (const user of users) {
            const key = String(user._id);
            const effectiveAlerts = this.resolveEffectiveAlerts(workspaceAlerts, userAlerts.get(key) ?? null);
            const values = effectiveAlerts?.[alertType]?.[field] ?? [];

            let shouldNotify = false;
            switch (alertType) {
                case 'beamLeft': shouldNotify = this.matchesConfigValue(values, thresholdValue, alertType);
                    break;
                case 'machineStopped': shouldNotify = this.matchesStopTier(values, data.tierMinute, thresholdValue);
                    break;
            }
            if (!shouldNotify) continue;

            if (this.isChannelEnabled(effectiveAlerts, alertType, 'notification')) {
                recipients.notification.push(user);
            }
            if (this.isChannelEnabled(effectiveAlerts, alertType, 'whatsapp')) {
                recipients.whatsapp.push(user);
            }
        }

        return recipients;
    },

    resolveEffectiveAlerts(workspaceAlerts, userAlerts, { readOnly = true } = {}) {
        const base = this.normalizeAlerts(workspaceAlerts || this.defaultAlerts({ readOnly }), { readOnly });
        if (!userAlerts) {
            return base;
        }

        const userConfig = this.normalizeAlerts(userAlerts, { readOnly });
        const resolved = {};
        for (const key of ALERT_KEYS) {
            resolved[key] = {
                notification: base[key].notification && userConfig[key].notification,
                whatsapp: base[key].whatsapp && userConfig[key].whatsapp
            };

            for (const field of CONFIG_FIELDS[key] || []) {
                resolved[key][field] = userConfig[key][field] ?? base[key][field];
            }
        }

        return resolved;
    },

    async create(body) {
        const doc = new alertConfigModel({
            ...body
        });
        return await doc.save();
    },

    async ensureWorkspaceDefault(workspaceId) {
        const alertConfig = await this.findOne({ workspaceId, userId: null }, { useLean: true });
        if (alertConfig) return alertConfig;

        try {
            return await this.create({
                workspaceId,
                userId: null,
                alerts: this.defaultAlerts({ readOnly: false })
            });
        } catch (err) {
            if (err?.code === 11000) {
                return await this.findOne({ workspaceId, userId: null }, { useLean: true });
            }
            throw err;
        }
    },

    async find(filter = {}, queryOptions = {}) {
        queryOptions = {
            sort: undefined,
            skip: undefined,
            limit: undefined,
            projection: undefined,
            populate: undefined,
            useLean: false,
            ...queryOptions
        };

        const query = alertConfigModel.find({ ...filter, isDeleted: false });

        if (queryOptions.sort) query.sort(queryOptions.sort);
        if (queryOptions.skip) query.skip(queryOptions.skip);
        if (queryOptions.limit) query.limit(queryOptions.limit);
        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async findOne(filter = {}, queryOptions = {}) {
        queryOptions = {
            projection: undefined,
            populate: undefined,
            useLean: false,
            ...queryOptions
        };

        const query = alertConfigModel.findOne({ ...filter, isDeleted: false });

        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async upsertWorkspaceConfig(workspaceId, alerts) {
        const normalized = this.normalizeAlerts(alerts, { readOnly: false });

        const updated = await alertConfigModel.findOneAndUpdate(
            { workspaceId, userId: null, isDeleted: false },
            { $set: { alerts: normalized }, $setOnInsert: { workspaceId, userId: null, isDeleted: false } },
            { new: true, upsert: true }
        ).lean();

        await this.refreshWorkspaceCache(workspaceId);
        return updated;
    },

    async upsertUserConfig(workspaceId, userId, alerts) {
        const normalized = this.normalizeAlerts(alerts, { readOnly: false });

        const updated = await alertConfigModel.findOneAndUpdate(
            { workspaceId, userId, isDeleted: false },
            { $set: { alerts: normalized }, $setOnInsert: { workspaceId, userId, isDeleted: false } },
            { new: true, upsert: true }
        ).lean();

        await this.refreshWorkspaceCache(workspaceId);
        return updated;
    },

    async softDeleteUserConfig(workspaceId, userId) {
        const deleted = await alertConfigModel.findOneAndUpdate(
            { workspaceId, userId, isDeleted: false },
            { $set: { isDeleted: true } },
            { new: true }
        );

        if (deleted) {
            await this.refreshWorkspaceCache(workspaceId);
        }
        return deleted;
    },

    async refreshWorkspaceCache(workspaceId) {
        if (!workspaceId) return null;

        const configs = await this.find({ workspaceId }, {
            projection: { userId: 1, alerts: 1 },
            useLean: true,
        });
        if (configs.length === 0) return null;

        const workspaceConfig = configs.find(c => !c.userId);
        const userAlerts = new Map(configs.filter(c => !!c.userId).map(
            c => [String(c.userId), this.normalizeAlerts(c.alerts, { readOnly: true })])
        );

        // // no user alerts, delete the cache for this workspace
        // if (userAlerts.size === 0) {
        //     workspaceAlertCache.delete(String(workspaceId));
        //     return null;
        // }

        workspaceAlertCache.set(String(workspaceId), {
            workspaceAlerts: this.normalizeAlerts(workspaceConfig?.alerts, { readOnly: true }),
            userAlerts
        });
        return workspaceAlertCache.has(String(workspaceId));
    },

    async ensureWorkspaceCache(workspaceId) {
        const key = String(workspaceId);
        if (!workspaceAlertCache.has(key)) {
            await this.refreshWorkspaceCache(workspaceId);
        }
        return workspaceAlertCache.get(key) || null;
    },

    /**
     * Load workspace default + user overrides from cache, then return recipients per channel.
     * Resolution: workspace master gate → then user override (can only further disable)
     *
     * @param {string} workspaceId
     * @param {Object[]} users
     * @param {string|string[]} alertTypes
     * @returns {Promise<{notification: ObjectId[], whatsapp: ObjectId[]}|{[key: string]: {notification: ObjectId[], whatsapp: ObjectId[]}}>}
     */
    async filterUsersForAlert(workspaceId, users, alertTypes) {
        const _alertTypes = Array.isArray(alertTypes) ? alertTypes.filter(Boolean) : [alertTypes].filter(Boolean);
        const returnMap = Array.isArray(alertTypes);
        const emptyRecipients = () => ({ notification: [], whatsapp: [] });

        if (!users?.length || !_alertTypes.length) {
            return returnMap ? Object.fromEntries(_alertTypes.map(t => [t, emptyRecipients()])) : emptyRecipients();
        }

        const cache = await this.ensureWorkspaceCache(workspaceId);
        const workspaceAlerts = cache?.workspaceAlerts || this.defaultAlerts();
        const userAlerts = cache?.userAlerts || new Map();

        const resolveForType = (type) => {
            const recipients = emptyRecipients();

            for (const user of users) {
                const key = String(user._id);
                const effectiveAlerts = this.resolveEffectiveAlerts(workspaceAlerts, userAlerts.get(key) ?? null);

                if (this.isChannelEnabled(effectiveAlerts, type, 'notification')) {
                    recipients.notification.push(user);
                }
                if (this.isChannelEnabled(effectiveAlerts, type, 'whatsapp')) {
                    recipients.whatsapp.push(user);
                }
            }

            return recipients;
        };

        if (!returnMap) {
            return resolveForType(_alertTypes[0]);
        }

        const recipientsByType = {};
        for (const type of _alertTypes) {
            recipientsByType[type] = resolveForType(type);
        }
        return recipientsByType;
    },

    async dispatchAlert({ title, description, machineId, workspaceId, recipients }) {
        try {
            await notificationService.createNotification({
                machineId,
                workspaceId,
                title,
                description
            }, recipients.notification);
        } catch (error) {
            utilService.log(error);
        }

        if (!recipients.whatsapp.length || !whatsappService.isEnabled()) {
            return;
        }
        const users = recipients.whatsapp.filter(user => user.mobile && user.mobile.trim());
        if (!users.length) {
            console.log('No whatsapp recipients with mobile number');
            return;
        }

        await Promise.allSettled(
            users.map(user => whatsappService.sendNotification({
                mobile: user.mobile,
                title: title,
                description: description
            }))
        );
    }
};