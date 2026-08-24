const authService = require('../../services/authService');
const jwtService = require('../../services/jwtService');
const accessService = require('../../services/accessService');
const userService = require('../../services/userService');
const workspaceService = require('../../services/workspaceService');
const utilService = require('../../services/utilService');


module.exports = {
    getSync: async (req, res, next) => {
        try {
            const syncData = {
                publicUrl: global.config.SERVER_URL || '',
                clientUrl: global.config.CLIENT_URL || '',
                roles: {
                    SUPER_ADMIN: global.config.USERS.TYPE.SUPER_ADMIN,
                    ADMIN: global.config.USERS.TYPE.ADMIN,
                    MASTER: global.config.USERS.TYPE.MASTER,
                },
                userTypeOptions: global.config.USERS.TYPE_OPTIONS,
                access: null,
                isOwner: false,

                refreshInterval: global.config.REFRESH_INTERVAL,
                efficiencyAveragePer: global.config.EFFICIENCY_AVERAGE_PER,
                efficiencyGoodPer: global.config.EFFICIENCY_GOOD_PER,
                beamLeftMin: global.config.BEAM_LEFT_MIN,
            };

            const token = req.headers?.authorization?.trim?.();
            if (token && typeof token === 'string') {
                try {
                    const tokenUser = await jwtService.verifyToken(token);
                    if (tokenUser && !jwtService.isJwtTokenExpiredError(tokenUser)) {
                        const user = await userService.findOneV2({ _id: tokenUser.id }, {
                            projection: { access: 1, userType: 1 },
                            useLean: true,
                        });
                        if (user) {
                            syncData.access = accessService.resolveAccess(user);
                            if (tokenUser.workspaceId) {
                                const workspace = await workspaceService.findOne({
                                    _id: tokenUser.workspaceId, userId: user._id
                                }, { projection: 'userId', useLean: true });
                                syncData.isOwner = !!workspace?._id;
                            }
                        }
                    }
                } catch (error) {
                    utilService.log(error);
                }
            }

            const encodeKey = utilService.generateRandomNumber(13);
            const data = {
                data: await authService.encryptData(syncData, encodeKey),
                date: encodeKey
            };

            return res.ok(data, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    }
}