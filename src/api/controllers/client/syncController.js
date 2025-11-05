const { decryptData, encryptData } = require('../../services/authService');
const jwtService = require('../../services/jwtService');
const { log, generateRandomNumber } = require('../../services/utilService');


module.exports = {

    getSync: async (req, res, next) => {
        try {
            let body = req.body;
            const syncData = {
                publicUrl: global.config.SERVER_URL || '',
                clientUrl: global.config.CLIENT_URL || '',
                roles: {
                    SUPER_ADMIN: global.config.USERS.TYPE.SUPER_ADMIN,
                    ADMIN: global.config.USERS.TYPE.ADMIN,
                    SUB_USER: global.config.USERS.TYPE.SUB_USER,
                },
                refreshInterval: global.config.REFRESH_INTERVAL,
                efficiencyAveragePer: global.config.EFFICIENCY_AVERAGE_PER,
                efficiencyGoodPer: global.config.EFFICIENCY_GOOD_PER,
            };

            if (body.data && body.date) {

                body = await decryptData(body);
                if (body?.token) {

                    const detailOfUserToken = await jwtService.verifyToken(body.token);
                    if (detailOfUserToken && !jwtService.isJwtTokenExpiredError(detailOfUserToken)) {
                        // detailOfUserToken.id
                    }
                }
            }

            const encodeKey = generateRandomNumber(13);
            const data = {
                data: await encryptData(syncData, encodeKey),
                date: encodeKey
            };

            return res.ok(data, global.config.message.OK);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    }
}