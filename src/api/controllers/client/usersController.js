const usersService = require('../../services/usersService');
const authService = require('../../services/authService');
const { log, checkRequiredParams } = require('../../services/utilService');


module.exports = {
    getList: async (req, res, next) => {
        try {
            const conditions = {
                workspaceId: req.user.workspaceId
            };
            if (req.user.type !== global.config.USERS.TYPE.ADMIN) {
                conditions._id = req.user.id;
            }
            const users = await usersService.findV2(conditions, { useLean: true, projection: { password: 0, fcmToken: 0, userType: 0, plan: 0, updatedAt: 0, createdAt: 0 } });

            return res.ok(users, global.config.message.OK);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    },

    getById: async (req, res, next) => {
        try {
            checkRequiredParams(['id'], req.params);

            const users = await usersService.findById(req.params.id, { password: false, verification: false, isDeleted: false });

            return res.ok(users, global.config.message.OK);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    },

    create: async (req, res, next) => {
        try {
            checkRequiredParams(['data', 'date'], req.body);
            const reqBody = await authService.decryptData(req.body);
            checkRequiredParams(['fullname', 'userName', 'password'], reqBody);

            const reqUser = req.user;
            if (reqUser.type !== global.config.USERS.TYPE.ADMIN) {
                throw global.config.message.BAD_REQUEST;
            }

            await usersService.getUserPlan(reqUser.workspaceId, true);

            const existingUser = await usersService.findOneV2({ userName: { $regex: new RegExp(`^${reqBody.userName?.trim()}$`, 'i') } }, {
                useLean: true,
                projection: '_id'
            });
            if (existingUser) {
                throw global.config.message.USER_EXISTS;
            }

            await usersService.create({
                fullname: reqBody.fullname,
                userName: reqBody.userName,
                password: reqBody.password,
                email: reqBody.email || '',
                mobile: reqBody.mobile || '',
                userType: global.config.USERS.TYPE.MASTER,
                workspaceId: reqUser.workspaceId
            });

            return res.ok(null, global.config.message.CREATED);
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

            checkRequiredParams(['data', 'date'], req.body);
            const reqBody = await authService.decryptData(req.body);
            if (Object.keys(reqBody).length === 0) {
                throw global.config.message.BAD_REQUEST;
            }

            delete reqBody.fcmToken;
            delete reqBody.workspaceId;
            delete reqBody.userType;
            delete reqBody.plan;
            delete reqBody.isDeleted;

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

            return res.ok(updatedUser, global.config.message.OK);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    }
}