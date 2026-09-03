const alertConfigService = require('../../services/alertConfigService');
const workspaceService = require('../../services/workspaceService');
const { ALERT_CONFIG_SCHEMA } = require('../../../config/constant/alert');
const utilService = require('../../services/utilService');

const { ALERT_KEYS } = alertConfigService;
const CONFIG_FIELDS = {
    beamLeft: ['thresholds'],
    machineStopped: ['minutes']
};

function pickAlertBody(body = {}) {
    const alerts = body.alerts && typeof body.alerts === 'object' ? body.alerts : body;
    const picked = {};

    for (const key of ALERT_KEYS) {
        const entry = alerts[key];
        if (entry == null || typeof entry !== 'object') continue;

        const normalized = {};
        if (typeof entry.notification === 'boolean') {
            normalized.notification = entry.notification;
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

function toClientAlerts(alerts = {}) {
    const normalized = alertConfigService.normalizeAlerts(alerts, { readOnly: false });
    const clientAlerts = {};
    for (const key of ALERT_KEYS) {
        const { whatsapp, ...rest } = normalized[key] || {};
        clientAlerts[key] = rest;
    }
    return clientAlerts;
}


module.exports = {
    getDetails: async (req, res) => {
        try {
            const { workspaceId, id: userId } = req.user;
            const workspace = await workspaceService.findOne(
                { _id: workspaceId, userId: userId },
                { projection: { firmName: 1 }, useLean: true }
            );
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

            const overrideMap = new Map(userOverrides.map(o => [String(o.userId), o]));
            const workspaceAlerts = toClientAlerts(workspaceConfig.alerts);
            const userConfigs = users.map(user => {
                const override = overrideMap.get(String(user._id));
                return {
                    user,
                    hasOverride: !!override,
                    alerts: toClientAlerts(alertConfigService.resolveEffectiveAlerts(
                        workspaceConfig.alerts,
                        override?.alerts,
                        { readOnly: false }
                    ))
                };
            });

            const data = {
                schema: ALERT_CONFIG_SCHEMA,
                workspaceAlerts,
                userConfigs
            };

            return res.ok(data, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },
    upsertWorkspace: async (req, res) => {
        try {
            const alerts = pickAlertBody(req.body);
            if (!Object.keys(alerts).length) {
                throw global.config.message.BAD_REQUEST;
            }

            const { workspaceId, id: userId } = req.user;
            const workspace = await workspaceService.findOne(
                { _id: workspaceId, userId: userId },
                { projection: { _id: 1 }, useLean: true }
            );
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
            const updated = await alertConfigService.upsertWorkspaceConfig(workspaceId, merged);

            return res.ok({ alerts: toClientAlerts(updated.alerts) }, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

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

            const { workspaceId } = req.user;
            const user = await userModel.findOne(
                { _id: userId, workspaceId, isDeleted: false },
                { _id: 1 }
            ).lean();
            if (!user) throw global.config.message.RECORD_NOT_FOUND;

            const [alertConfig, userAlertConfig] = await Promise.all([
                alertConfigService.findOne({ workspaceId, userId: null }, { useLean: true }),
                alertConfigService.findOne({ workspaceId, userId }, { useLean: true }),
            ]);
            if (!alertConfig?.alerts) throw global.config.message.BAD_REQUEST;

            const merged = alertConfigService.mergeAlertUpdates(
                userAlertConfig?.alerts || alertConfig.alerts,
                alerts,
                { returnNormalized: false }
            );
            const updated = await alertConfigService.upsertUserConfig(workspaceId, userId, merged);

            return res.ok(
                { alerts: toClientAlerts(updated.alerts) },
                global.config.message.OK
            );
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    deleteUserOverride: async (req, res) => {
        try {
            const { userId } = req.params;
            if (!utilService.isValidObjectId(userId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const { workspaceId } = req.user;
            const user = await userModel.findOne(
                { _id: userId, workspaceId, isDeleted: false },
                { _id: 1 }
            ).lean();
            if (!user) throw global.config.message.RECORD_NOT_FOUND;

            const entry = await alertConfigService.softDeleteUserConfig(workspaceId, userId);
            if (!entry) throw global.config.message.RECORD_NOT_FOUND;

            return res.ok(null, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },
};