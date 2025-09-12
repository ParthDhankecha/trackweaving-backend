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
            checkRequiredParams(['fullname', 'password', 'userName', 'firmName'], reqBody);

            const isUserExists = await usersService.findOne({ userName: reqBody.userName });
            if (isUserExists) {
                throw global.config.message.IS_DUPLICATE;
            }

            const newUser = await authService.createUser(reqBody);
            const userWorkspace = await workspaceService.create({ firmName: reqBody.firmName, userId: newUser._id });
            newUser.workspaceId = userWorkspace._id;
            await newUser.save();

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
                searchQuery.$and = [];

                for (const [field, value] of Object.entries(search)) {
                    if (value && ['email', 'fullname', 'userName'].includes(field)) {
                        searchQuery.$and.push({
                            [field]: { $regex: value, $options: 'i' }
                        });
                    }
                }
            }

            if (body?.workspaceId) {
                searchQuery.workspaceId = { $in: body.workspaceId };
            }
            console.log(searchQuery);

            queryOption.populate = { path: 'workspaceId', select: 'firmName' };
            const usersList = await usersService.getUserWithPagination(searchQuery, queryOption);

            return res.ok(usersList, global.config.message.OK);
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

            const updatedUser = await usersService.findByIdAndUpdate(userId, body);
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