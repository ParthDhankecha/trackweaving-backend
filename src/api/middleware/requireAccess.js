const accessService = require('../services/accessService');
const userService = require('../services/userService');
const utilService = require('../services/utilService');


/**
 * Middleware factory: requireAccess(module, action)
 * ADMIN always passes. MASTER checked against User.access from DB.
 * 
 * @param {string} moduleKey - The module key to check. Should be a string from the module map.
 * @param {string} actionKey - The action key to check. Should be a string from the action map.
 */
module.exports = (moduleKey, actionKey) => {
    return async (req, res, next) => {
        try {
            const user = req.user;
            const ADMIN = global.config.USERS.TYPE.ADMIN;
            if (user.type === ADMIN) {
                if (!user.isOwner) {
                    const { MODULE_KEYS, ACTION_KEYS } = accessService;
                    if (MODULE_KEYS.USER === moduleKey && ![ACTION_KEYS.READ, ACTION_KEYS.UPDATE].includes(actionKey)) {
                        return res.forbidden(null, global.config.message.ACCESS_DENIED);
                    }
                }
                return next();
            }

            const access = accessService.getStoredAccess(user);
            if (!accessService.hasAccess(access, moduleKey, actionKey)) {
                return res.forbidden(null, global.config.message.ACCESS_DENIED);
            }

            return next();
        } catch (error) {
            utilService.log(error);
            return res.forbidden(null, global.config.message.ACCESS_DENIED);
        }
    };
};