const moment = require('moment');

const authService = require('../../services/authService');
const usersService = require('../../services/usersService');
const workspaceService = require('../../services/workspaceService');
const machineService = require('../../services/machineService');
const utilService = require('../../services/utilService');


module.exports = {
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
            utilService.log(error);
            return res.serverError(error);
        }
    },

    createUser: async (req, res, next) => {
        try {
            utilService.checkRequiredParams(['data', 'date'], req.body);
            const body = await authService.decryptData(req.body);

            const createObj = {
                fullname: body.fullname?.trim?.(),
                userName: body.userName?.trim?.(),
                password: body.password?.trim?.(),
            };
            if (utilService.isValidObjectId(body?.workspaceId)) {
                createObj.workspaceId = body.workspaceId;
            }
            utilService.checkRequiredParams(['fullname', 'userName', 'password', 'workspaceId'], createObj);

            if (typeof body.email === 'string' && body.email.trim()) {
                if (!utilService.validateEmail(body.email)) {
                    throw global.config.message.BAD_REQUEST;
                }
                createObj.email = body.email.trim().toLowerCase();
            }
            if (typeof body.mobile === 'string' && body.mobile.trim()) {
                if (!utilService.validateMobile(body.mobile)) {
                    throw global.config.message.BAD_REQUEST;
                }
                createObj.mobile = body.mobile.trim();
            }
            if (typeof body.receiveWhatsappReport === 'boolean') {
                createObj.receiveWhatsappReport = createObj.mobile && body.receiveWhatsappReport;
            }
            if (typeof body.isActive === 'boolean') {
                createObj.isActive = body.isActive;
            }

            createObj.shift = usersService.validateShift(body.shift);

            if (!Array.isArray(body.machineIds)) {
                throw global.config.message.BAD_REQUEST;
            }
            const machineIds = [...new Set(
                body.machineIds.filter((id) => typeof id === 'string' && utilService.isValidObjectId(id))
            )];
            if (!machineIds.length) throw global.config.message.MASTER_MACHINES_REQUIRED;
            if (machineIds.length !== body.machineIds.length) throw global.config.message.INVALID_MACHINE_IDS;

            const duplicate = await usersService.findOneV2({
                userName: {
                    $regex: `^${utilService.escapeRegex(createObj.userName, { throwError: true })}$`,
                    $options: 'i'
                }
            }, {
                useLean: true,
                projection: '_id'
            });
            if (duplicate) throw global.config.message.USER_EXISTS;

            const machineCount = await machineService.countDocuments({
                _id: { $in: machineIds },
                workspaceId: createObj.workspaceId
            });
            if (machineCount !== machineIds.length) throw global.config.message.INVALID_MACHINE_IDS;

            await authService.createUser({
                ...createObj,
                machineIds: machineIds,
                userType: global.config.USERS.TYPE.MASTER,
            });

            return res.created(null, global.config.message.USER_REGISTERED);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    updateUser: async (req, res, next) => {
        try {
            const { userId } = req.params;
            if (!utilService.isValidObjectId(userId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const body = req.body;
            if (Object.keys(body).length === 0) throw global.config.message.BAD_REQUEST;

            const updateObj = {};
            if (typeof body.fullname === 'string' && body.fullname.trim()) {
                updateObj.fullname = body.fullname.trim();
            }
            const dupQuery = { _id: userId };
            if (typeof body.userName === 'string' && body.userName.trim()) {
                updateObj.userName = body.userName.trim();
                delete dupQuery._id;
                Object.assign(dupQuery, {
                    $or: [{
                        _id: { $ne: userId },
                        userName: {
                            $regex: `^${utilService.escapeRegex(updateObj.userName, { throwError: true })}$`,
                            $options: 'i'
                        }
                    }, {
                        _id: userId
                    }]
                });
            }
            if (typeof body.password === 'string' && body.password.trim()) {
                updateObj.password = body.password.trim();
            }
            if (typeof body.email === 'string') {
                const email = body.email.trim();
                if (!email) {
                    updateObj.email = '';
                } else if (!utilService.validateEmail(email)) {
                    throw global.config.message.BAD_REQUEST;
                } else {
                    updateObj.email = email.toLowerCase();
                }
            }
            if (typeof body.mobile === 'string') {
                const mobile = body.mobile.trim();
                if (!mobile) {
                    updateObj.mobile = '';
                } else if (!utilService.validateMobile(mobile)) {
                    throw global.config.message.BAD_REQUEST;
                } else {
                    updateObj.mobile = mobile;
                }
            }

            const targetUser = await usersService.findOneV2(dupQuery, {
                useLean: true,
                projection: 'userType mobile workspaceId'
            });
            if (!targetUser) throw global.config.message.RECORD_NOT_FOUND;
            if (targetUser._id.toString() !== userId) throw global.config.message.USER_EXISTS;

            if (typeof body.receiveWhatsappReport === 'boolean') {
                updateObj.receiveWhatsappReport = body.receiveWhatsappReport;

                if (updateObj.receiveWhatsappReport && !(updateObj.mobile || targetUser.mobile)) {
                    throw global.config.message.BAD_REQUEST;
                }
            }

            const USERS_TYPE = global.config.USERS.TYPE;
            switch (targetUser.userType) {
                case USERS_TYPE.MASTER: {
                    if (Array.isArray(body.shift)) {
                        updateObj.shift = usersService.validateShift(body.shift);
                    }
                    if (Array.isArray(body.machineIds)) {
                        const machineIds = [...new Set(
                            body.machineIds.filter((id) => typeof id === 'string' && utilService.isValidObjectId(id))
                        )];
                        if (!machineIds.length) throw global.config.message.MASTER_MACHINES_REQUIRED;
                        if (machineIds.length !== body.machineIds.length) {
                            throw global.config.message.INVALID_MACHINE_IDS;
                        }

                        const machineCount = await machineService.countDocuments({
                            _id: { $in: machineIds },
                            workspaceId: targetUser.workspaceId
                        });
                        if (machineCount !== machineIds.length) throw global.config.message.INVALID_MACHINE_IDS;

                        updateObj.machineIds = machineIds;
                    }
                    break;
                }
                case USERS_TYPE.ADMIN: {
                    const planBody = body.plan;
                    if (typeof planBody === 'object') {
                        if (!planBody?.startDate || !planBody?.endDate || !planBody?.subUserLimit) {
                            updateObj.plan = {
                                startDate: null,
                                endDate: null,
                                subUserLimit: null
                            };
                        } else {
                            const startDate = planBody?.startDate ? moment(planBody.startDate) : null;
                            const endDate = planBody?.endDate ? moment(planBody.endDate) : null;
                            if (!startDate.isValid() || !endDate.isValid()) throw global.config.message.BAD_REQUEST;
                            if (startDate.isAfter(endDate)) throw global.config.message.BAD_REQUEST;
                            if (!utilService.isNumber(planBody.subUserLimit, { min: 0 })) throw global.config.message.BAD_REQUEST;

                            updateObj.plan = {
                                startDate: startDate.toDate(),
                                endDate: endDate.toDate(),
                                subUserLimit: planBody.subUserLimit
                            };
                        }
                    }
                    break;
                }
            }

            if (typeof body.isActive === 'boolean') {
                updateObj.isActive = body.isActive;
            }

            if (Object.keys(updateObj).length === 0) {
                throw global.config.message.BAD_REQUEST;
            }

            const entry = await usersService.findByIdAndUpdate(userId, updateObj, {
                populate: { path: 'workspaceId', select: 'firmName uid' }
            });
            if (!entry) throw global.config.message.NOT_UPDATED;

            return res.ok(entry, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    deleteUser: async (req, res, next) => {
        try {
            const { userId } = req.params;
            if (!utilService.isValidObjectId(userId)) throw global.config.message.BAD_REQUEST;

            const user = await usersService.findOneV2({ _id: userId }, {
                useLean: true,
                projection: '_id workspaceId',
                populate: { path: 'workspaceId', select: 'userId' }
            });
            if (!user) throw global.config.message.RECORD_NOT_FOUND;
            if (!user.workspaceId?.userId || user.workspaceId.userId?.toString() === userId) {
                throw global.config.message.OPERATION_NOT_PERMITTED;
            }

            const entry = await usersService.findByIdAndDelete(userId);
            if (!entry) throw global.config.message.NOT_UPDATED;

            return res.ok(null, global.config.message.USER_DELETED);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    }
}