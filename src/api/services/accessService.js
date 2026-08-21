const { USERS } = require('../../config/constant/user');


const MODULE_KEYS = Object.freeze({
    MACHINE_GROUP: 'machine_group',
    MACHINE_CONFIGURE: 'machine_configure',
    MAINTENANCE_CATEGORY: 'maintenance_category',
    MAINTENANCE_ENTRY: 'maintenance_entry',
    PART_CHANGE_ENTRY: 'part_change_entry',
    USER: 'user',
    REPORT: 'report',
});
const ACTION_KEYS = Object.freeze({
    READ: 'read',
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    HISTORY: 'history',
    EXPORT: 'export',
});
const _MODULE_WISE_ACCESS = Object.freeze({
    [MODULE_KEYS.MACHINE_GROUP]: Object.freeze([ACTION_KEYS.READ, ACTION_KEYS.CREATE, ACTION_KEYS.UPDATE]),
    [MODULE_KEYS.MACHINE_CONFIGURE]: Object.freeze([ACTION_KEYS.READ, ACTION_KEYS.UPDATE]),
    [MODULE_KEYS.MAINTENANCE_CATEGORY]: Object.freeze([ACTION_KEYS.READ, ACTION_KEYS.CREATE, ACTION_KEYS.UPDATE, ACTION_KEYS.DELETE]),
    [MODULE_KEYS.MAINTENANCE_ENTRY]: Object.freeze([ACTION_KEYS.READ, ACTION_KEYS.UPDATE, ACTION_KEYS.HISTORY]),
    [MODULE_KEYS.PART_CHANGE_ENTRY]: Object.freeze([ACTION_KEYS.READ, ACTION_KEYS.CREATE, ACTION_KEYS.UPDATE, ACTION_KEYS.DELETE]),
    [MODULE_KEYS.USER]: Object.freeze([ACTION_KEYS.READ, ACTION_KEYS.UPDATE]),
    [MODULE_KEYS.REPORT]: Object.freeze([ACTION_KEYS.READ, ACTION_KEYS.EXPORT]),
});


/**
 * Empty access matrix (all false). Used as MASTER default / missing keys.
 */
function getFullAccess() {
    const access = {};
    for (const module in _MODULE_WISE_ACCESS) {
        access[module] = [..._MODULE_WISE_ACCESS[module]];
    }
    return access;
}

/**
 * Normalize an incoming access object to the known schema.
 * Unknown modules/actions are dropped; missing keys default to false.
 */
function sanitizeAccess(rawAccess, throwError = false) {
    if (!rawAccess || typeof rawAccess !== 'object' || Array.isArray(rawAccess) ||
        Object.values(rawAccess).some((m) => !Array.isArray(m))) {
        if (throwError) throw global.config.message.BAD_REQUEST;
        return null;
    }

    const accessObj = {};
    for (const module in _MODULE_WISE_ACCESS) {
        const moduleAccess = rawAccess?.[module];
        if (!moduleAccess || !Array.isArray(moduleAccess)) {
            if (throwError) throw global.config.message.BAD_REQUEST;
            continue;
        }

        accessObj[module] = [];
        const access = _MODULE_WISE_ACCESS[module];
        for (const action of moduleAccess) {
            if (typeof action === 'string' && access.includes(action)) {
                accessObj[module].push(action);
            } else if (throwError) throw global.config.message.BAD_REQUEST;
        }
    }
    return accessObj;
}

/**
 * Effective access used at login / API checks.
 * ADMIN → full; MASTER with null access → full (legacy); else stored.
 */
function resolveAccess(user) {
    if (!user) return null;

    const userType = user.userType ?? user.type;
    if (userType === USERS.TYPE.ADMIN) {
        return null;
    }
    // Legacy MASTER users without access config keep full access until admin configures them
    if (!user.access) {
        return getFullAccess();
    }
    return sanitizeAccess(user.access);
}

/**
 * Check whether a module has access to an action.
 * 
 * @param {Object} access - The access matrix.
 * @param {string} module - The module to check. Should be a string from the module map.
 * @param {string} action - The action to check. Should be a string from the action map.
 * @returns {boolean} True if the module has access to the action, false otherwise.
 */
function hasAccess(access, module, action) {
    if (!access || !module || !action) return false;
    return access[module]?.includes?.(action) ?? false;
}

/**
 * Stored access matrix as persisted on the user record (no legacy full-access fallback).
 */
function getStoredAccess(user) {
    if (!user?.access) return null;
    return sanitizeAccess(user.access);
}


module.exports = {
    MODULE_WISE_ACCESS: _MODULE_WISE_ACCESS,
    MODULE_KEYS,
    ACTION_KEYS,


    getFullAccess,
    sanitizeAccess,
    resolveAccess,
    hasAccess,
    getStoredAccess,
};