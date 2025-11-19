

const appVersionService = require('../../services/appVersionService');
const usersService = require('../../services/usersService');
const { log, checkRequiredParams } = require('../../services/utilService');


module.exports = {
    getById: async (req, res, next) => {
        try {
            checkRequiredParams(['id'], req.params);

            const user = await usersService.findById(req.params.id);
            if (!user) {
                return res.notFound(null, global.config.message.USER_NOT_FOUND);
            }

            return res.ok(user, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    syncData: async (req, res, next) => {
        try {
            let iosVersionData = await appVersionService.findOne({ appType: 'ios' }, { sort: { createdAt: -1 }, useLean: true });
            let androidVersionData = await appVersionService.findOne({ appType: 'android' }, { sort: { createdAt: -1 }, useLean: true });
            let syncData = {
                refreshInterval: global.config.REFRESH_INTERVAL,
                efficiencyAveragePer: global.config.EFFICIENCY_AVERAGE_PER,
                efficiencyGoodPer: global.config.EFFICIENCY_GOOD_PER,
                androidVersion: androidVersionData?.version || '',
                androidShowPopup: androidVersionData?.showPopup || false,
                androidForceUpdate: androidVersionData?.hardUpdate || false,
                iosVersion: iosVersionData?.version || '',
                iosShowPopup: iosVersionData?.showPopup || false,
                iosForceUpdate: iosVersionData?.hardUpdate || false
            };

            return res.ok(syncData, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    updateFcmToken: async (req, res, next) => {
        try {
            checkRequiredParams(['fcmToken'], req.body);

            await usersService.updateOne({ _id: req.user.id }, { fcmToken: req.body.fcmToken });

            return res.ok({}, global.config.message.OK);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    },

    removeFcmToken: async (req, res, next) => {
        try {
            await usersService.updateOne({ _id: req.user.id }, { fcmToken: '' });

            return res.ok({}, global.config.message.OK);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    },

    create: async (req, res, next) => {
        try {
            const body = req.body;
            checkRequiredParams(['fullname', 'userName', 'password'], body);

            if (req.user.type !== global.config.USERS.TYPE.ADMIN) {
                throw global.config.message.BAD_REQUEST;
            }

            await usersService.getUserPlan(req.user.workspaceId, true);

            const existingUser = await usersService.findOneV2({ userName: { $regex: new RegExp(`^${body.userName?.trim()}$`, 'i') } }, {
                useLean: true,
                projection: '_id'
            });
            if (existingUser) {
                throw global.config.message.USER_EXISTS;
            }
            let shift = body.shift;
            if(shift !== global.config.SHIFT_TYPE.DAY && shift !== global.config.SHIFT_TYPE.NIGHT) {
                shift = global.config.SHIFT_TYPE.DAY;
            }

            await usersService.create({
                fullname: body.fullname,
                userName: body.userName,
                password: body.password,
                email: body.email || '',
                mobile: body.mobile || '',
                userType: req.body.userType || global.config.USERS.TYPE.MASTER,
                workspaceId: req.user.workspaceId,
                shift: shift
            });

            return res.ok(null, global.config.message.CREATED);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    },

    list: async (req, res, next) => {
        try {
            const conditions = {
                workspaceId: req.user.workspaceId
            };
            if (req.user.type !== global.config.USERS.TYPE.ADMIN) {
                conditions._id = req.user.id;
            }

            const users = await usersService.findV2(conditions, { useLean: true, projection: { password: 0, fcmToken: 0, userType: 0 } });

            return res.ok(users, global.config.message.OK);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    },

    update: async (req, res, next) => {
        try {
            const userId = req.params.id;
            if (req.user.type !== global.config.USERS.TYPE.ADMIN && req.user.id != userId) {
                throw global.config.message.BAD_REQUEST;
            }
            const reqBody = req.body;
            if (Object.keys(reqBody).length === 0) {
                throw global.config.message.BAD_REQUEST;
            }

            delete reqBody.fcmToken;
            delete reqBody.workspaceId;
            delete reqBody.plan;
            delete reqBody.isDeleted;
            if(req.user.type !== global.config.USERS.TYPE.ADMIN) {
                delete reqBody.userType;
            }

            if (req.user.id == userId) {
                delete reqBody.isActive;
            }
            if (reqBody?.userName) {
                const existingUser = await usersService.findOneV2({ _id: { $ne: userId }, userName: { $regex: new RegExp(`^${reqBody.userName?.trim()}$`, 'i') } }, {
                    useLean: true,
                    projection: '_id'
                });
                if (existingUser) {
                    throw global.config.message.USER_EXISTS;
                }
            }

            const updatedUser = await usersService.findByIdAndUpdate(userId, reqBody, { projection: { password: 0, fcmToken: 0, userType: 0, plan: 0, updatedAt: 0, createdAt: 0 } });
            if (!updatedUser) {
                throw global.config.message.NOT_UPDATED;
            }

            return res.ok({}, global.config.message.OK);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    }
}