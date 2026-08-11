const jwtService = require('../services/jwtService');
const utilService = require('../services/utilService');


module.exports = async (req, res, next) => {
    try {
        const token = req.headers?.authorization?.trim?.();
        if (!token) return res.unauthorized({}, global.config.message.UNAUTHORIZED);

        const payload = jwtService.verifyManufacturerToken(token);
        if (payload?.expiredAt) {
            return res.unauthorized({}, global.config.message.TOKEN_EXPIRED);
        }
        if (!payload.manufacturerId || !payload.id) {
            return res.unauthorized({}, global.config.message.UNAUTHORIZED);
        }

        req.mfrUser = payload;
        next();
    } catch (error) {
        return res.unauthorized({}, global.config.message.UNAUTHORIZED);
    }
};