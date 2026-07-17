const alertConfigService = require('../../services/alertConfigService');
const { log, checkRequiredParams } = require('../../services/utilService');

const ALERT_KEYS = ['pickChange', 'maxSpeed', 'lowSpeed', 'beamLeft'];

function pickAlertBody(body = {}) {
    const alerts = body.alerts && typeof body.alerts === 'object' ? body.alerts : body;
    const picked = {};
    for (const key of ALERT_KEYS) {
        if (typeof alerts[key] === 'boolean') {
            picked[key] = alerts[key];
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
            checkRequiredParams(['workspaceId'], req.params);
            const { workspaceId } = req.params;

            const workspace = await workspaceModel.findOne(
                { _id: workspaceId, isDeleted: false },
                { firmName: 1, isActive: 1 }
            ).lean();
            if (!workspace) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            let workspaceConfig = await alertConfigService.findOne(
                { workspaceId, userId: null },
                { useLean: true }
            );
            if (!workspaceConfig) {
                workspaceConfig = await alertConfigService.ensureWorkspaceDefault(workspaceId);
            }

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

            const overrideMap = new Map(
                userOverrides.map(o => [String(o.userId), o])
            );

            const userConfigs = users.map(user => {
                const override = overrideMap.get(String(user._id));
                return {
                    user,
                    hasOverride: !!override,
                    alerts: alertConfigService.resolveEffectiveAlerts(
                        workspaceConfig.alerts,
                        override?.alerts
                    ),
                    overrideAlerts: override?.alerts || null,
                    configId: override?._id || null
                };
            });

            return res.ok({
                workspace,
                workspaceConfig: {
                    _id: workspaceConfig._id,
                    alerts: alertConfigService.normalizeAlerts(workspaceConfig.alerts)
                },
                alertTypes: global.config.ALERT_TYPES,
                userConfigs
            }, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    /**
     * PUT /workspace/:workspaceId
     * Body: { alerts: { pickChange, maxSpeed, lowSpeed, beamLeft } }
     */
    upsertWorkspace: async (req, res) => {
        try {
            checkRequiredParams(['workspaceId'], req.params);
            const { workspaceId } = req.params;
            const alerts = pickAlertBody(req.body);

            if (!Object.keys(alerts).length) {
                throw global.config.message.BAD_REQUEST;
            }

            const workspace = await workspaceModel.findOne(
                { _id: workspaceId, isDeleted: false },
                { _id: 1 }
            ).lean();
            if (!workspace) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            const existing = await alertConfigService.findOne(
                { workspaceId, userId: null },
                { useLean: true }
            );
            const merged = alertConfigService.normalizeAlerts({
                ...(existing?.alerts || alertConfigService.defaultAlerts()),
                ...alerts
            });

            const updated = await alertConfigService.upsertWorkspaceConfig(workspaceId, merged);
            return res.ok(updated, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    /**
     * PUT /user/:userId
     * Body: { alerts: { pickChange, maxSpeed, lowSpeed, beamLeft } }
     */
    upsertUser: async (req, res) => {
        try {
            checkRequiredParams(['userId'], req.params);
            const { userId } = req.params;
            const alerts = pickAlertBody(req.body);

            if (!Object.keys(alerts).length) {
                throw global.config.message.BAD_REQUEST;
            }

            const user = await userModel.findOne(
                { _id: userId, isDeleted: false },
                { workspaceId: 1 }
            ).lean();
            if (!user?.workspaceId) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            const existing = await alertConfigService.findOne(
                { workspaceId: user.workspaceId, userId },
                { useLean: true }
            );
            const workspaceConfig = await alertConfigService.findOne(
                { workspaceId: user.workspaceId, userId: null },
                { useLean: true }
            );

            const base = existing?.alerts || alertConfigService.resolveEffectiveAlerts(workspaceConfig?.alerts, null);

            const merged = alertConfigService.normalizeAlerts({ ...base, ...alerts });
            const updated = await alertConfigService.upsertUserConfig(
                user.workspaceId,
                userId,
                merged
            );

            return res.ok(updated, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    /**
     * DELETE /user/:userId
     * Removes user override so workspace defaults apply again.
     */
    deleteUserOverride: async (req, res) => {
        try {
            checkRequiredParams(['userId'], req.params);
            const { userId } = req.params;

            const user = await userModel.findOne(
                { _id: userId, isDeleted: false },
                { workspaceId: 1 }
            ).lean();
            if (!user?.workspaceId) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            const deleted = await alertConfigService.softDeleteUserConfig(
                user.workspaceId,
                userId
            );
            if (!deleted) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            return res.ok(null, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    }
};
