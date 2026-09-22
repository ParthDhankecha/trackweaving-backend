const accessService = require('../api/services/accessService');

function buildUserFromAuth(authInfo) {
    const extra = authInfo?.extra || {};
    if (!extra.userId || !extra.workspaceId) {
        throw new Error('OAuth token is missing workspace context');
    }
    return {
        id: extra.userId,
        workspaceId: extra.workspaceId,
        type: extra.type,
        isMaster: extra.isMaster === true,
        isOwner: extra.isOwner === true,
        machineIds: extra.machineIds || [],
        access: extra.access || null,
    };
}

function assertReadAccess(user, moduleKey) {
    const ADMIN = global.config.USERS.TYPE.ADMIN;
    if (user.type === ADMIN) {
        return;
    }
    const access = accessService.getStoredAccess(user);
    const { ACTION_KEYS } = accessService;
    if (!accessService.hasAccess(access, moduleKey, ACTION_KEYS.READ)) {
        throw global.config.message.ACCESS_DENIED;
    }
}

module.exports = {
    buildUserFromAuth,
    assertReadAccess,
};
