const usersService = require('../../services/usersService');
const appVersionService = require('../../services/appVersionService');
const utilService = require('../../services/utilService');


module.exports = {
    getById: async (req, res, next) => {
        try {
            utilService.checkRequiredParams(['id'], req.params);

            const user = await usersService.findById(req.params.id);
            if (!user) {
                return res.notFound(null, global.config.message.USER_NOT_FOUND);
            }

            return res.ok(user, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    getProfile: async (req, res, next) => {
        try {
            if (!utilService.isValidObjectId(req.user.id)) {
                throw global.config.message.BAD_REQUEST;
            }

            const userdata = await usersService.findOneV2({ _id: req.user.id }, {
                projection: { fullname: 1, userName: 1, mobile: 1, email: 1, userType: 1, workspaceId: 1 },
                useLean: true
            });
            if (!userdata) throw global.config.message.USER_NOT_FOUND;

            const workspace = await usersService.validatePlanForSignIn(userdata.workspaceId);
            if (!workspace) throw global.config.message.BAD_REQUEST;

            userdata.userId = workspace.uid;
            delete userdata.workspaceId;

            return res.ok(userdata, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    syncData: async (req, res, next) => {
        try {
            const forceVersion = await appVersionService.getForceVersion();
            const syncData = {
                refreshInterval: global.config.REFRESH_INTERVAL,
                efficiencyAveragePer: global.config.EFFICIENCY_AVERAGE_PER,
                efficiencyGoodPer: global.config.EFFICIENCY_GOOD_PER,
                forceVersion: forceVersion,

                // TODO: Remove this after app update in all devices
                iosVersion: '1.0.2',
                iosShowPopup: false,
                iosForceUpdate: false,
                androidVersion: '1.0.2',
                androidShowPopup: false,
                androidForceUpdate: false
            };

            return res.ok(syncData, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    create: async (req, res, next) => {
        try {
            const body = req.body;
            utilService.checkRequiredParams(['fullname', 'userName', 'password'], body);

            if (req.user.type !== global.config.USERS.TYPE.ADMIN) {
                throw global.config.message.BAD_REQUEST;
            }

            await usersService.getUserPlan(req.user.workspaceId, true);

            const duplicate = await usersService.findOneV2({ userName: { $regex: new RegExp(`^${body.userName?.trim()}$`, 'i') } }, {
                useLean: true,
                projection: '_id'
            });
            if (duplicate) throw global.config.message.USER_EXISTS;

            let shift = body.shift;
            if (shift !== global.config.SHIFT_TYPE.DAY && shift !== global.config.SHIFT_TYPE.NIGHT) {
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
            utilService.log(error);

            return res.serverError(error);
        }
    },

    list: async (req, res, next) => {
        try {
            const user = req.user;
            const conditions = {
                workspaceId: user.workspaceId
            };
            if (user.type !== global.config.USERS.TYPE.ADMIN) {
                conditions._id = user.id;
            }

            const users = await usersService.findV2(conditions, {
                projection: { password: 0 },
                useLean: true,
            });

            return res.ok(users, global.config.message.OK);
        } catch (error) {
            utilService.log(error);

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

            delete reqBody.workspaceId;
            delete reqBody.plan;
            delete reqBody.isDeleted;
            delete reqBody.receiveWhatsappReport;
            if (req.user.type !== global.config.USERS.TYPE.ADMIN) {
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

            const updatedUser = await usersService.findByIdAndUpdate(userId, reqBody, { projection: { password: 0, userType: 0, plan: 0, updatedAt: 0, createdAt: 0 } });
            if (!updatedUser) {
                throw global.config.message.NOT_UPDATED;
            }

            return res.ok({}, global.config.message.OK);
        } catch (error) {
            utilService.log(error);

            return res.serverError(error);
        }
    }
}