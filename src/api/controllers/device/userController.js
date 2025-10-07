

const usersService = require("../../services/usersService");
const { log, checkRequiredParams, generateHashValue } = require("../../services/utilService")

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
            let syncData = {
                refreshInterval: global.config.REFRESH_INTERVAL,
                efficiencyAveragePer: global.config.EFFICIENCY_AVERAGE_PER,
                efficiencyGoodPer: global.config.EFFICIENCY_GOOD_PER,
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
            checkRequiredParams(['fullname', 'userName', 'password'], req.body);

            if(req.user.type !== global.config.USERS.TYPE.ADMIN) {
                throw global.config.message.BAD_REQUEST;
            }

            let userCount = await usersService.count({ workspaceId: req.user.workspaceId, isDeleted: false });
            if(userCount >= (req.user.subUserLimit || 4)) {
                throw global.config.message.USER_LIMIT_EXCEEDED;
            }
            
            const isUserExists = await usersService.findOne({ userName: req.body.userName });
            if (isUserExists) {
                throw global.config.message.USER_EXISTS;
            }

            await usersService.create({
                fullname: req.body.fullname,
                userName: req.body.userName,
                password: req.body.password,
                email: req.body.email || '',
                mobile: req.body.mobile || '',
                userType: global.config.USERS.TYPE.SUB_USER,
                workspaceId: req.user.workspaceId
            });

            return res.ok(null, global.config.message.USER_CREATED);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    },

    list: async (req, res, next) => {
        try {
            let conditions = {
                workspaceId: req.user.workspaceId
            };
            if(req.user.type !== global.config.USERS.TYPE.ADMIN) {
                conditions._id = req.user.id;
            }
            let users = await usersService.find(conditions, { useLean: true, projection: { password: 0, fcmToken: 0, userType: 0 } });

            return res.ok(users, global.config.message.OK);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    },

    update: async (req, res, next) => {
        try {
            if(req.user.type !== global.config.USERS.TYPE.ADMIN && req.user.id != req.params.id) {
                throw global.config.message.BAD_REQUEST;
            }
            const body = req.body;
            if (Object.keys(body).length === 0) {
                throw global.config.message.BAD_REQUEST;
            }

            delete body.fcmToken;
            delete body.workspaceId;
            delete body.userType;
            delete body.plan;
            delete body.isDeleted;

            if(body?.userName) {
                const isExists = await usersService.findOne({ _id: { $ne: req.params.id }, userName: body.userName });
                if (isExists) {
                    throw global.config.message.USER_EXISTS;
                }
            }

            if(body.password) {
                body.password = await generateHashValue(body.password);
            }

            await usersService.updateOne({ _id: req.params.id }, body);

            return res.ok({}, global.config.message.OK);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    }
}