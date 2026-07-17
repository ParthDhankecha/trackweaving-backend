module.exports = {

    defaultAlerts() {
        return { ...global.config.DEFAULT_ALERT_FLAGS };
    },

    normalizeAlerts(alerts = {}) {
        const defaults = this.defaultAlerts();
        return {
            pickChange: typeof alerts.pickChange === 'boolean' ? alerts.pickChange : defaults.pickChange,
            maxSpeed: typeof alerts.maxSpeed === 'boolean' ? alerts.maxSpeed : defaults.maxSpeed,
            lowSpeed: typeof alerts.lowSpeed === 'boolean' ? alerts.lowSpeed : defaults.lowSpeed,
            beamLeft: typeof alerts.beamLeft === 'boolean' ? alerts.beamLeft : defaults.beamLeft
        };
    },

    isAlertEnabled(alerts, alertType) {
        if (!alerts || typeof alerts[alertType] !== 'boolean') {
            return true;
        }
        return alerts[alertType];
    },

    async create(body) {
        const doc = new alertConfigModel({
            ...body,
            alerts: this.normalizeAlerts(body.alerts)
        });
        return await doc.save();
    },

    async ensureWorkspaceDefault(workspaceId) {
        const existing = await this.findOne({ workspaceId, userId: null }, { useLean: true });
        if (existing) return existing;

        try {
            return await this.create({
                workspaceId,
                userId: null,
                alerts: this.defaultAlerts()
            });
        } catch (err) {
            // Race: another request may have created it
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
        const normalized = this.normalizeAlerts(alerts);

        return await alertConfigModel.findOneAndUpdate(
            { workspaceId, userId: null, isDeleted: false },
            { $set: { alerts: normalized }, $setOnInsert: { workspaceId, userId: null, isDeleted: false } },
            { new: true, upsert: true }
        ).lean();
    },

    async upsertUserConfig(workspaceId, userId, alerts) {
        const normalized = this.normalizeAlerts(alerts);

        return await alertConfigModel.findOneAndUpdate(
            { workspaceId, userId, isDeleted: false },
            { $set: { alerts: normalized }, $setOnInsert: { workspaceId, userId, isDeleted: false } },
            { new: true, upsert: true }
        ).lean();
    },

    async softDeleteUserConfig(workspaceId, userId) {
        return await alertConfigModel.findOneAndUpdate(
            { workspaceId, userId, isDeleted: false },
            { $set: { isDeleted: true } },
            { new: true }
        );
    },

    /**
     * Load workspace default + user overrides, then return recipients for alert type(s).
     * Resolution: workspace master gate → then user override (can only further disable)
     *
     * @param {string|string[]} alertType - one type string, or array of types
     * @returns {Promise<ObjectId[]|{[key: string]: ObjectId[]}>}
     *   - single type  → userId[]
     *   - multiple types → { pickChange: [], maxSpeed: [], ... }
     */
    async filterUserIdsForAlert(workspaceId, userIds, alertType) {
        const alertTypes = Array.isArray(alertType) ? alertType.filter(Boolean) : [alertType].filter(Boolean);
        const returnMap = Array.isArray(alertType);

        if (!userIds?.length || !alertTypes.length) {
            return returnMap ? Object.fromEntries(alertTypes.map(t => [t, []])) : [];
        }

        const configs = await this.find({
            workspaceId,
            $or: [
                { userId: null },
                { userId: { $in: userIds } }
            ]
        }, {
            useLean: true,
            projection: { userId: 1, alerts: 1 }
        });

        const workspaceConfig = configs.find(c => !c.userId);
        const userConfigMap = new Map(configs
            .filter(c => !!c.userId)
            .map(c => [String(c.userId), c.alerts])
        );

        const resolveForType = (type) => userIds.filter(uid => {
            // Workspace is master: if disabled there, nobody receives this alert.
            if (workspaceConfig && !this.isAlertEnabled(workspaceConfig.alerts, type)) {
                return false;
            }

            const key = String(uid);
            if (userConfigMap.has(key)) {
                return this.isAlertEnabled(userConfigMap.get(key), type);
            }
            return true;
        });

        if (!returnMap) {
            return resolveForType(alertTypes[0]);
        }

        const recipientsByType = {};
        for (const type of alertTypes) {
            recipientsByType[type] = resolveForType(type);
        }
        return recipientsByType;
    },

    /**
     * Effective alerts for one user.
     * Workspace is master — user override can only further disable, not re-enable.
     */
    resolveEffectiveAlerts(workspaceAlerts, userAlerts) {
        const base = this.normalizeAlerts(workspaceAlerts || this.defaultAlerts());
        if (!userAlerts) return base;

        const userConfig = this.normalizeAlerts(userAlerts);
        return {
            pickChange: base.pickChange && userConfig.pickChange,
            maxSpeed: base.maxSpeed && userConfig.maxSpeed,
            lowSpeed: base.lowSpeed && userConfig.lowSpeed,
            beamLeft: base.beamLeft && userConfig.beamLeft
        };
    }
};