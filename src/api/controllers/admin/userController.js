const authService = require("../../services/authService");
const usersService = require("../../services/usersService");
const utilService = require("../../services/utilService");
const { checkRequiredParams, log } = require("../../services/utilService");
const workspaceService = require("../../services/workspaceService");


module.exports = {
    createUser: async (req, res, next) => {
        try {
            checkRequiredParams(['data', 'date'], req.body);
            const reqBody = await authService.decryptData(req.body);
            checkRequiredParams(['fullname', 'password', 'userName', 'workspaceId', 'isActive'], reqBody);

            const isUserExists = await usersService.findOne({ userName: reqBody.userName });
            if (isUserExists) {
                throw global.config.message.IS_DUPLICATE;
            }

            const newUser = await authService.createUser(reqBody);
            if (!newUser) {
                throw global.config.message.CREATE_FAILED;
            }

            return res.created(null, global.config.message.USER_REGISTERED);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    getUsers: async (req, res, next) => {
        try {
            const body = req.body || {};
            const pageObj = {
                page: parseInt(body.page) || 1,
                limit: parseInt(body.limit) || 10
            };

            const queryOption = utilService.getFilter(pageObj);

            const searchQuery = {};
            const search = body.search || {};
            if (Object.keys(search).length > 0) {
                searchQuery.$or = [];

                for (const [field, value] of Object.entries(search)) {
                    if (value && ['fullname', 'userName', 'email'].includes(field)) {
                        searchQuery.$or.push({
                            [field]: { $regex: value, $options: 'i' }
                        });
                    }
                }
                if (/[0-9]+/g.test(search.uid)) {
                    const workspaceData = await workspaceService.findOne({ uid: search.uid }, {
                        projection: 'uid userId'
                    });
                    if (workspaceData) {
                        searchQuery.$or.push({
                            workspaceId: workspaceData._id
                        });
                    }
                }
            }

            if (body?.workspaceId) {
                searchQuery.workspaceId = { $in: body.workspaceId };
            }

            queryOption.populate = { path: 'workspaceId', select: 'firmName uid' };
            const data = await usersService.getUserWithPagination(searchQuery, queryOption);
            const workspaceIds = new Set(data.list.map((user) => user.workspaceId?._id?.toString()).filter(Boolean));
            if (workspaceIds.size > 0) {
                const workspaceList = await workspaceService.find({ _id: { $in: [...workspaceIds] } }, { projection: 'userId' });
                const workspacesMap = Object.fromEntries(
                    workspaceList.map(ws => [ws._id.toString(), ws])
                );

                data.list.forEach(user => {
                    const ws = workspacesMap[user.workspaceId?._id?.toString()];
                    user.isOwner = ws?.userId?.toString() === user._id?.toString();
                });
            }

            return res.ok(data, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    getUserById: async (req, res, next) => {
        try {
            checkRequiredParams(['userId'], req.params);
            const userId = req.params.userId;

            const populate = { path: 'workspaceId', select: 'firmName' };
            const userDetails = await usersService.findOneV2({ _id: userId }, { populate });
            if (!userDetails) {
                throw global.config.message.USER_NOT_FOUND;
            }

            return res.ok(userDetails, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    updateUserById: async (req, res, next) => {
        try {
            checkRequiredParams(['userId'], req.params);
            const userId = req.params.userId;
            const body = req.body;
            if (Object.keys(body).length === 0) {
                throw global.config.message.BAD_REQUEST;
            }

            // const updateObj = {};
            // for(const [key, value] of Object.entries(body)){
            //     if(['fullname', 'userName', 'mobile', 'isActive', 'email'].includes(key)){
            //         updateObj[key] = value;
            //     }
            // }

            if (body?.userName || body?.email || body?.mobile) {
                const searchQuery = {
                    _id: { $ne: userId },
                    $or: []
                };
                if (body?.userName) {
                    searchQuery.$or.push({ userName: body.userName });
                }
                if (body?.email) {
                    searchQuery.$or.push({ email: body.email });
                }
                if (body?.mobile) {
                    searchQuery.$or.push({ mobile: body.mobile });
                }

                if (searchQuery.$or.length > 0) {
                    const isExists = await usersService.findOne(searchQuery);
                    if (isExists) {
                        throw global.config.message.IS_DUPLICATE;
                    }
                }
            }

            const updatedUser = await usersService.findByIdAndUpdate(userId, body, {
                populate: { path: 'workspaceId', select: 'firmName uid' }
            });
            if (!updatedUser) {
                throw global.config.message.USER_NOT_FOUND;
            }

            return res.ok(updatedUser, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    deleteUserById: async (req, res, next) => {
        try {
            checkRequiredParams(['userId'], req.params);
            const userId = req.params.userId;

            const userData = await usersService.findOneV2({ _id: userId });
            if (!userData) {
                throw global.config.message.USER_NOT_FOUND;
            }
            const owner = await workspaceService.findOne({
                _id: userData.workspaceId,
                userId: userId
            });
            if (owner) {
                throw global.config.message.OPERATION_NOT_PERMITTED;
            }

            const deletedUser = await usersService.findByIdAndDelete(userId);
            if (!deletedUser) {
                throw global.config.message.USER_NOT_FOUND;
            }

            return res.ok(null, global.config.message.USER_DELETED);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    }
}