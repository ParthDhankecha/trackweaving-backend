const jwtService = require('../services/jwtService');
const usersService = require('../services/usersService');
const utilService = require('../services/utilService');


module.exports = async (req, res, next) => {
    try {
        const token = req.headers?.authorization?.trim?.();
        if (!token) return res.unauthorized({}, global.config.message.UNAUTHORIZED);

        const payload = jwtService.verifyToken(token);
        if (payload?.expiredAt) {
            return res.unauthorized({}, global.config.message.TOKEN_EXPIRED);
        }
        if (!payload?.id || !payload?.workspaceId) {
            return res.unauthorized({}, global.config.message.UNAUTHORIZED);
        }

        await usersService.validateUserSessionAccess(payload);

        req.user = payload;
        next();
    } catch (error) {
        if (error?.code && error?.message && error?.status) {
            if (error.status === 401) return res.unauthorized({}, error);
            if (error.status === 403) return res.forbidden({}, error);
            if (error.status === 404) return res.notFound({}, error);
        }

        return res.unauthorized({}, global.config.message.UNAUTHORIZED);
    }
};