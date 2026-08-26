const userService = require('../../services/userService');
const authService = require('../../services/authService');
const machineService = require('../../services/machineService');
const accessService = require('../../services/accessService');
const utilService = require('../../services/utilService');

const _commonProjection = { _id: 1, fullname: 1, userName: 1, email: 1, mobile: 1, userType: 1, isActive: 1, shift: 1, machineIds: 1, access: 1 };


module.exports = {
    getList: async (req, res, next) => {
        try {
            const user = req.user;
            const conditions = {
                workspaceId: user.workspaceId
            };
            if (!user.isOwner) {
                conditions._id = user.id;
            }

            const list = await userService.findV2(conditions, {
                projection: { ..._commonProjection },
                useLean: true,
            });

            // Return stored access matrix so workspace owner can edit what is on the master record
            const normalized = (list ?? []).map((u) => ({
                ...u,
                // null = never configured on record; object = stored master access
                access: !u.access ? null : accessService.resolveAccess(u),
            }));

            return res.ok(normalized, global.config.message.OK);
        } catch (error) {
            utilService.log(error);

            return res.serverError(error);
        }
    },

    getAccessMatrix: async (req, res, next) => {
        try {
            if (!req.user.isOwner) {
                throw global.config.message.OPERATION_NOT_PERMITTED;
            }

            const data = {
                moduleWiseAccess: accessService.MODULE_WISE_ACCESS,
            };

            return res.ok(data, global.config.message.OK);
        } catch (error) {
            utilService.log(error);

            return res.serverError(error);
        }
    },

    create: async (req, res, next) => {
        try {
            const user = req.user;
            if (!user.isOwner) {
                throw global.config.message.OPERATION_NOT_PERMITTED;
            }

            utilService.checkRequiredParams(['data', 'date'], req.body);
            const body = await authService.decryptData(req.body);

            const createObj = {
                fullname: body.fullname?.trim?.(),
                userName: userService.validateUserName(body.userName),
                password: body.password?.trim?.(),
            };
            utilService.checkRequiredParams(['fullname', 'password'], createObj);

            if (!createObj.userName?.normalized) {
                throw global.config.message.BAD_REQUEST;
            }
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
            if (typeof body.isActive === 'boolean') {
                createObj.isActive = body.isActive;
            }

            const USERS = global.config.USERS;
            if (!USERS || !USERS?.TYPE_OPTIONS?.some?.((type) => type.value === body.userType)) {
                throw global.config.message.BAD_REQUEST;
            }

            await userService.getUserPlan(user.workspaceId, true);

            const duplicate = await userService.findOneV2({
                userName: {
                    $regex: `^${createObj.userName.escaped}$`,
                    $options: 'i',
                }
            }, {
                useLean: true,
                projection: '_id'
            });
            if (duplicate) throw global.config.message.USER_EXISTS;

            createObj.userType = body.userType;
            switch (createObj.userType) {
                case USERS.TYPE.MASTER: {
                    createObj.shift = userService.validateShift(body.shift);

                    if (!Array.isArray(body.machineIds)) {
                        throw global.config.message.BAD_REQUEST;
                    }
                    const machineIds = [...new Set(
                        body.machineIds.filter((id) => typeof id === 'string' && utilService.isValidObjectId(id))
                    )];
                    if (!machineIds.length) throw global.config.message.MASTER_MACHINES_REQUIRED;
                    if (machineIds.length !== body.machineIds.length) {
                        throw global.config.message.INVALID_MACHINE_IDS;
                    }

                    const machineCount = await machineService.countDocuments({
                        _id: { $in: machineIds },
                        workspaceId: user.workspaceId
                    });
                    if (machineCount !== machineIds.length) throw global.config.message.INVALID_MACHINE_IDS;

                    createObj.machineIds = machineIds;
                    createObj.access = accessService.getReadOnlyAccess();
                    break;
                }
                case USERS.TYPE.ADMIN: {
                    break;
                }
                default: throw global.config.message.BAD_REQUEST;
            }

            await userService.create({
                ...createObj,
                userName: createObj.userName.normalized,
                workspaceId: user.workspaceId
            });

            return res.ok(null, global.config.message.CREATED);
        } catch (error) {
            utilService.log(error);

            return res.serverError(error);
        }
    },

    update: async (req, res, next) => {
        try {
            const { id: userId } = req.params;
            if (!utilService.isValidObjectId(userId)) {
                throw global.config.message.BAD_REQUEST;
            }

            utilService.checkRequiredParams(['data', 'date'], req.body);
            const body = await authService.decryptData(req.body);
            if (Object.keys(body).length === 0) {
                throw global.config.message.BAD_REQUEST;
            }

            const user = req.user;
            const USERS_TYPE = global.config.USERS.TYPE;
            const isOwner = !!user.isOwner;
            const isSelf = user.id === userId;

            // workspace owner can update any user, rest can only update their own record
            if (!isOwner && !isSelf) {
                throw global.config.message.UNAUTHORIZED;
            }

            const targetUser = await userService.findOneV2({ _id: userId, workspaceId: user.workspaceId }, {
                useLean: true,
                projection: { userType: 1, access: 1 }
            });
            if (!targetUser) throw global.config.message.NOT_FOUND;

            const updateObj = {};
            if (typeof body.fullname === 'string' && body.fullname.trim()) {
                updateObj.fullname = body.fullname.trim();
            }
            if (typeof body.userName === 'string' && body.userName.trim()) {
                const userNameObj = userService.validateUserName(body.userName);
                if (!userNameObj?.normalized) {
                    throw global.config.message.BAD_REQUEST;
                }
                updateObj.userName = userNameObj;
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

            if (isOwner && !isSelf && typeof body.isActive === 'boolean') {
                updateObj.isActive = body.isActive;
            }

            let nextUserType = targetUser.userType;
            if (isOwner && !isSelf && body.userType !== undefined && body.userType !== null) {
                if (!global.config.USERS?.TYPE_OPTIONS?.some?.((type) => type.value === body.userType)) {
                    throw global.config.message.BAD_REQUEST;
                }
                nextUserType = body.userType;
                if (nextUserType !== targetUser.userType) {
                    updateObj.userType = nextUserType;
                }
            }

            // Master-only fields: workspace owner updating a master user (including admin → master)
            if (isOwner && nextUserType === USERS_TYPE.MASTER) {
                const isBecomingMaster = targetUser.userType !== USERS_TYPE.MASTER;

                if (Array.isArray(body.shift)) {
                    updateObj.shift = userService.validateShift(body.shift);
                } else if (isBecomingMaster) {
                    throw global.config.message.INVALID_SHIFT;
                }

                if (Array.isArray(body.machineIds)) {
                    const machineIds = [...new Set(
                        body.machineIds.filter((id) => typeof id === 'string' && utilService.isValidObjectId(id))
                    )];
                    if (!machineIds?.length) throw global.config.message.MASTER_MACHINES_REQUIRED;
                    if (machineIds.length !== body.machineIds.length) throw global.config.message.INVALID_MACHINE_IDS;

                    const machineCount = await machineService.countDocuments({
                        _id: { $in: machineIds },
                        workspaceId: user.workspaceId
                    });
                    if (machineCount !== machineIds.length) throw global.config.message.INVALID_MACHINE_IDS;

                    updateObj.machineIds = machineIds;
                } else if (isBecomingMaster) {
                    throw global.config.message.MASTER_MACHINES_REQUIRED;
                }

                if (body.access && typeof body.access === 'object') {
                    updateObj.access = accessService.sanitizeAccess(body.access, true);
                } else if (isBecomingMaster && !targetUser.access) {
                    updateObj.access = accessService.getReadOnlyAccess();
                }
            }

            if (isOwner && updateObj.userType === USERS_TYPE.ADMIN) {
                updateObj.shift = null;
                updateObj.machineIds = null;
                updateObj.access = null;
            }

            if (Object.keys(updateObj).length === 0) {
                throw global.config.message.BAD_REQUEST;
            }

            if (updateObj.userName) {
                const duplicate = await userService.findOneV2({
                    _id: { $ne: userId },
                    userName: {
                        $regex: `^${updateObj.userName.escaped}$`,
                        $options: 'i'
                    }
                }, {
                    useLean: true,
                    projection: '_id'
                });
                if (duplicate) throw global.config.message.USER_EXISTS;

                updateObj.userName = updateObj.userName.normalized;
            }

            const entry = await userService.findByIdAndUpdate(userId, updateObj, {
                projection: { ..._commonProjection },
                useLean: true,
            });
            if (!entry) throw global.config.message.NOT_UPDATED;

            return res.ok(entry, global.config.message.OK);
        } catch (error) {
            utilService.log(error);

            return res.serverError(error);
        }
    },

    delete: async (req, res, next) => {
        try {
            const user = req.user;
            // only workspace owner can delete any user except themselves
            if (!user.isOwner) {
                throw global.config.message.OPERATION_NOT_PERMITTED;
            }

            const { id: userId } = req.params;
            if (!utilService.isValidObjectId(userId)) {
                throw global.config.message.BAD_REQUEST;
            }
            if (user.id === userId) {
                throw global.config.message.OPERATION_NOT_PERMITTED;
            }

            const targetUser = await userService.findOneV2({ _id: userId, workspaceId: user.workspaceId }, {
                useLean: true,
                projection: '_id'
            });
            if (!targetUser) throw global.config.message.RECORD_NOT_FOUND;

            const entry = await userService.findByIdAndDelete(userId);
            if (!entry) throw global.config.message.NOT_DELETED;

            return res.ok(null, global.config.message.OK);
        } catch (error) {
            utilService.log(error);

            return res.serverError(error);
        }
    }
}