const jwtService = require('../services/jwtService');
const SUPER_ADMIN_TYPE = require('../../config/constant/user').USERS.TYPE.SUPER_ADMIN;
const utilService = require('../services/utilService');


module.exports = async (req, res, next) => {
    try {
        const token = req.headers?.authorization?.trim?.();
        if (!token) return res.unauthorized({}, global.config.message.UNAUTHORIZED);

        const payload = jwtService.verifyToken(token);
        if (payload?.expiredAt) {
            return res.unauthorized({}, global.config.message.TOKEN_EXPIRED);
        }
        if (!payload.id || payload.type !== SUPER_ADMIN_TYPE) {
            return res.unauthorized({}, global.config.message.UNAUTHORIZED);
        }

        req.user = payload;
        next();
    } catch (error) {
        console.log('error', error);
        return res.unauthorized({}, global.config.message.UNAUTHORIZED);
    }
};