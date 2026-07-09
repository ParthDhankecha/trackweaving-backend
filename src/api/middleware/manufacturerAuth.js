const jwtService = require('../services/jwtService');
const { log } = require('../services/utilService');


module.exports = async (req, res, next) => {
    try {
        if (req.headers && req.headers.authorization) {
            const payload = await jwtService.verifyManufacturerToken(req.headers.authorization);

            if (payload && payload.id) {
                req.manufacturer = payload;
                return next();
            }

            return res.unauthorized({}, global.config.message.UNAUTHORIZED);
        } else {
            return res.unauthorized({}, global.config.message.UNAUTHORIZED);
        }
    } catch (error) {
        log(error);
        return res.unauthorized({}, global.config.message.TOKEN_EXPIRED);
    }
};
