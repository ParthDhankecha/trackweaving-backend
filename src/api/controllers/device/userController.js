const userService = require('../../services/userService');
const appVersionService = require('../../services/appVersionService');
const machineService = require('../../services/machineService');
const utilService = require('../../services/utilService');

const _commonProjection = { _id: 1, fullname: 1, userName: 1, email: 1, mobile: 1, userType: 1, isActive: 1, shift: 1, machineIds: 1 };


module.exports = {
    getList: async (req, res, next) => {
        try {
            const user = req.user;
            const conditions = {
                workspaceId: user.workspaceId
            };
            if (user.type !== global.config.USERS.TYPE.ADMIN) {
                conditions._id = user.id;
            }

            const list = await userService.findV2(conditions, {
                projection: { ..._commonProjection },
                useLean: true,
            });

            return res.ok(list, global.config.message.OK);
        } catch (error) {
            utilService.log(error);

            return res.serverError(error);
        }
    },

    getProfile: async (req, res, next) => {
        try {
            const { id } = req.user;
            if (!utilService.isValidObjectId(id)) {
                throw global.config.message.BAD_REQUEST;
            }

            const userdata = await userService.findOneV2({ _id: id }, {
                projection: { fullname: 1, userName: 1, mobile: 1, email: 1, userType: 1, workspaceId: 1 },
                useLean: true
            });
            if (!userdata) throw global.config.message.USER_NOT_FOUND;

            const workspace = await userService.validatePlanForSignIn(userdata.workspaceId);
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
                beamLeftMin: global.config.BEAM_LEFT_MIN,

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
            const user = req.user;
            if (user.type !== global.config.USERS.TYPE.ADMIN) {
                throw global.config.message.BAD_REQUEST;
            }

            const body = req.body;
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

            createObj.shift = userService.validateShift(body.shift);

            if (!Array.isArray(body.machineIds)) {
                throw global.config.message.BAD_REQUEST;
            }
            const machineIds = [...new Set(
                body.machineIds.filter((id) => typeof id === 'string' && utilService.isValidObjectId(id))
            )];
            if (!machineIds.length) throw global.config.message.MASTER_MACHINES_REQUIRED;
            if (machineIds.length !== body.machineIds.length) throw global.config.message.INVALID_MACHINE_IDS;

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

            const machineCount = await machineService.countDocuments({
                _id: { $in: machineIds },
                workspaceId: user.workspaceId
            });
            if (machineCount !== machineIds.length) throw global.config.message.INVALID_MACHINE_IDS;

            await userService.create({
                ...createObj,
                userName: createObj.userName.normalized,
                machineIds: machineIds,
                userType: global.config.USERS.TYPE.MASTER,
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

            const body = req.body;
            if (Object.keys(body).length === 0) {
                throw global.config.message.BAD_REQUEST;
            }

            const user = req.user;
            const USERS_TYPE = global.config.USERS.TYPE;
            const isAdmin = user.type === USERS_TYPE.ADMIN;
            const isSelf = user.id === userId;

            // Non-admin can only update their own profile
            if (!isAdmin && !isSelf) {
                throw global.config.message.UNAUTHORIZED;
            }

            const targetUser = await userService.findOneV2({ _id: userId, workspaceId: user.workspaceId }, {
                useLean: true,
                projection: 'userType'
            });
            if (!targetUser) throw global.config.message.NOT_FOUND;

            const updateObj = {};
            if (typeof body.fullname === 'string' && body.fullname.trim()) {
                updateObj.fullname = body.fullname.trim();
            }
            if (typeof body.userName === 'string' && body.userName.trim()) {
                updateObj.userName = userService.validateUserName(body.userName);
                if (!updateObj.userName?.normalized) {
                    throw global.config.message.BAD_REQUEST;
                }
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

            // Master-only fields: admin updating a master user
            if (isAdmin && targetUser.userType === USERS_TYPE.MASTER) {
                if (Array.isArray(body.shift)) {
                    updateObj.shift = userService.validateShift(body.shift);
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
                }

                if (typeof body.isActive === 'boolean') {
                    updateObj.isActive = body.isActive;
                }
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
                }, { useLean: true, projection: '_id' });
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
    }
}