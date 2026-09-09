const alertConfigService = require('../../services/alertConfigService');
const { ALERT_CONFIG_SCHEMA_WEB, CHANNEL_SCHEMA } = require('../../../config/constant/alert');
const utilService = require('../../services/utilService');

const { ALERT_KEYS, CHANNEL_KEYS } = alertConfigService;
const CONFIG_FIELDS = Object.fromEntries(
    Object.entries(ALERT_CONFIG_SCHEMA_WEB).map(([key, obj]) => [key, Object.keys(obj.fields || {})])
);

function pickAlertBody(body = {}) {
    const alerts = body.alerts && typeof body.alerts === 'object' ? body.alerts : body;
    const picked = {};

    for (const key of ALERT_KEYS) {
        const entry = alerts[key];
        if (entry == null || typeof entry !== 'object') continue;

        const normalized = {};
        for (const channel of CHANNEL_KEYS) {
            if (typeof entry[channel] === 'boolean') {
                normalized[channel] = entry[channel];
            }
        }

        for (const field of CONFIG_FIELDS[key] || []) {
            if (typeof entry[field] === 'string') {
                normalized[field] = entry[field];
            }
        }

        if (Object.keys(normalized).length) {
            picked[key] = normalized;
        }
    }

    return picked;
}


module.exports = {
    /**
     * GET /workspace/:workspaceId
     * Returns workspace defaults + per-user overrides (with user info).
     */
    getByWorkspace: async (req, res) => {
        try {
            const { workspaceId } = req.params;
            if (!utilService.isValidObjectId(workspaceId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const workspace = await workspaceModel.findOne(
                { _id: workspaceId, isDeleted: false },
                { firmName: 1, isActive: 1 }
            ).lean();
            if (!workspace) throw global.config.message.RECORD_NOT_FOUND;

            let workspaceConfig = await alertConfigService.ensureWorkspaceDefault(workspaceId);
            if (workspaceConfig?.toObject) workspaceConfig = workspaceConfig.toObject();

            const [userOverrides, users] = await Promise.all([
                alertConfigService.find(
                    { workspaceId, userId: { $ne: null } },
                    { useLean: true, sort: { updatedAt: -1 } }
                ),
                userModel.find(
                    { workspaceId, isDeleted: false },
                    { fullname: 1, userName: 1, isActive: 1 }
                ).lean()
            ]);

            const readOnly = false, overrideMap = new Map(
                userOverrides.map(o => [String(o.userId), o])
            );
            const userConfigs = users.map(user => {
                const override = overrideMap.get(String(user._id));
                return {
                    user,
                    hasOverride: !!override,
                    alerts: alertConfigService.resolveEffectiveAlerts(
                        workspaceConfig.alerts,
                        override?.alerts,
                        { readOnly }
                    ),
                    overrideAlerts: override?.alerts || null,
                    configId: override?._id || null
                };
            });

            const data = {
                schema: ALERT_CONFIG_SCHEMA_WEB,
                workspace,
                workspaceConfig: {
                    _id: workspaceConfig._id,
                    alerts: alertConfigService.normalizeAlerts(workspaceConfig.alerts, { readOnly })
                },
                channelKeys: CHANNEL_SCHEMA,
                userConfigs
            };

            return res.ok(data, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    /**
     * PUT /workspace/:workspaceId
     * Body: { alerts: { pickChange: { notification, whatsapp }, beamLeft: { thresholds }, ... } }
     */
    upsertWorkspace: async (req, res) => {
        try {
            const { workspaceId } = req.params;
            if (!utilService.isValidObjectId(workspaceId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const alerts = pickAlertBody(req.body);
            if (!Object.keys(alerts).length) {
                throw global.config.message.BAD_REQUEST;
            }

            const workspace = await workspaceModel.findOne(
                { _id: workspaceId, isDeleted: false },
                { _id: 1 }
            ).lean();
            if (!workspace) throw global.config.message.RECORD_NOT_FOUND;

            const existing = await alertConfigService.findOne(
                { workspaceId, userId: null },
                { useLean: true }
            );
            const merged = alertConfigService.mergeAlertUpdates(
                existing?.alerts || alertConfigService.defaultAlerts({ readOnly: false }),
                alerts,
                { returnNormalized: false }
            );

            await alertConfigService.upsertWorkspaceConfig(workspaceId, merged);

            return res.ok(null, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    /**
     * PUT /user/:userId
     * Body: { alerts: { pickChange: { notification, whatsapp }, ... } }
     */
    upsertUser: async (req, res) => {
        try {
            const { userId } = req.params;
            if (!utilService.isValidObjectId(userId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const alerts = pickAlertBody(req.body);
            if (!Object.keys(alerts).length) {
                throw global.config.message.BAD_REQUEST;
            }

            const user = await userModel.findOne(
                { _id: userId, isDeleted: false },
                { workspaceId: 1 }
            ).lean();
            if (!user?.workspaceId) throw global.config.message.RECORD_NOT_FOUND;

            const [alertConfig, userAlertConfig] = await Promise.all([
                alertConfigService.findOne({ workspaceId: user.workspaceId, userId: null }, { useLean: true }),
                alertConfigService.findOne({ workspaceId: user.workspaceId, userId }, { useLean: true }),
            ]);
            if (!alertConfig?.alerts) throw global.config.message.BAD_REQUEST;

            const merged = alertConfigService.mergeAlertUpdates(
                userAlertConfig?.alerts || alertConfig.alerts,
                alerts,
                { returnNormalized: false }
            );
            await alertConfigService.upsertUserConfig(
                user.workspaceId,
                userId,
                merged
            );

            return res.ok(null, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    /**
     * DELETE /user/:userId
     * Removes user override so workspace defaults apply again.
     */
    deleteUserOverride: async (req, res) => {
        try {
            const { userId } = req.params;
            if (!utilService.isValidObjectId(userId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const user = await userModel.findOne(
                { _id: userId, isDeleted: false },
                { workspaceId: 1 }
            ).lean();
            if (!user?.workspaceId) throw global.config.message.RECORD_NOT_FOUND;

            const entry = await alertConfigService.softDeleteUserConfig(
                user.workspaceId,
                userId
            );
            if (!entry) throw global.config.message.RECORD_NOT_FOUND;

            return res.ok(null, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },
};
