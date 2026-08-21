const workspaceService = require('../../services/workspaceService');
const authService = require('../../services/authService');
const userService = require('../../services/userService');
const manufacturerService = require('../../services/manufacturerService');
const utilService = require('../../services/utilService');


module.exports = {
    create: async (req, res, next) => {
        let adminUser = null, workspace = null;
        try {
            utilService.checkRequiredParams(['data', 'date'], req.body);
            const body = await authService.decryptData(req.body);

            const userNameObj = userService.validateUserName(body.userName);
            if (!userNameObj?.normalized) {
                throw global.config.message.BAD_REQUEST;
            }
            const workspaceNameObj = utilService.escapeRegex(body.workspaceName);
            if (!workspaceNameObj?.normalized) {
                throw global.config.message.BAD_REQUEST;
            }

            const userObj = {
                fullname: body.name?.trim?.() || '',
                userName: userNameObj.normalized,
                email: body.userEmail?.trim?.()?.toLowerCase?.(),
                mobile: body.mobile?.trim?.()?.toLowerCase?.(),
                password: body.password?.trim?.(),
            };
            utilService.checkRequiredParams(['fullname', 'userName', 'password'], userObj);

            const duplicate = await userService.findOneV2({
                userName: {
                    $regex: `^${userNameObj.escaped}$`,
                    $options: 'i'
                }
            }, {
                useLean: true,
                projection: { _id: 1 }
            });
            if (duplicate) throw global.config.message.IS_DUPLICATE;

            const wDuplicate = await workspaceService.findOne({
                firmName: {
                    $regex: `^${workspaceNameObj.escaped}$`,
                    $options: 'i'
                }
            }, { useLean: true, projection: { _id: 1 } });
            if (wDuplicate) throw global.config.message.IS_DUPLICATE;


            const { workspaceName, GSTNo, isActive, startTime, endTime } = body;
            const workspaceObj = {
                firmName: workspaceNameObj.normalized,
                userId: null, // will be set after user creation
            };
            if (typeof body?.dayShift === 'object') {
                workspaceObj.dayShift = body.dayShift;
            }
            if (typeof body?.nightShift === 'object') {
                workspaceObj.nightShift = body.nightShift;
            }
            if (body?.GSTNo?.trim?.()) {
                workspaceObj.GSTNo = body.GSTNo.trim();
            }
            if (typeof body.isActive === 'boolean') {
                workspaceObj.isActive = body.isActive;
            }

            adminUser = await authService.createUser({
                ...userObj,
                userType: global.config.USERS.TYPE.ADMIN,
            });

            workspaceObj.userId = adminUser._id;
            workspace = await workspaceService.create(workspaceObj);
            adminUser.workspaceId = workspace._id;

            await adminUser.save();

            return res.created(null, global.config.message.CREATED);
        } catch (error) {
            utilService.log(error);
            try {
                if (adminUser?.deleteOne) await adminUser.deleteOne();
                if (workspace?.deleteOne) await workspace.deleteOne();
            } catch (error) {
                console.log('Error in rollback: ', error);
            }
            return res.serverError(error);
        }
    },

    getList: async (req, res, next) => {
        try {
            const queryObj = {};
            const body = req.body;
            if (body.hasOwnProperty('isActive') && typeof body.isActive === 'boolean') {
                queryObj.isActive = body.isActive;
            }
            if (body.firmName) {
                queryObj.firmName = { $regex: body.firmName, $options: "i" };
            }

            const pageObj = {
                page: parseInt(body.page) || 1,
                limit: parseInt(body.limit) || 10
            };
            const queryOptions = utilService.getFilter(pageObj);
            queryOptions.populate = { path: 'userId', select: 'fullname userName' };
            queryOptions.sort = { createdAt: -1 };
            queryOptions.useLean = true;

            const result = await workspaceService.find(queryObj, queryOptions);
            const totalCount = await workspaceService.countDocuments(queryObj);

            const response = {
                list: result,
                totalCount: totalCount
            };

            return res.ok(response, global.config.message.OK);
        } catch (error) {
            utilService.log(error)
            return res.serverError(error);
        }
    },

    getAllList: async (req, res, next) => {
        try {
            const projection = { firmName: 1 };
            const result = await workspaceService.find({}, { projection, useLean: true });

            return res.ok(result, global.config.message.OK);
        } catch (error) {
            utilService.log(error)
            return res.serverError(error);
        }
    },

    getById: async (req, res, next) => {
        try {
            const { id } = req.params;
            if (!utilService.isValidObjectId(id)) {
                throw global.config.message.BAD_REQUEST;
            }

            const populate = { path: 'userId', select: 'fullname userName' };
            const workspace = await workspaceService.findOne({ _id: req.params.id }, { populate, useLean: true });
            if (!workspace) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            return res.ok(workspace, global.config.message.OK);
        } catch (error) {
            utilService.log(error)
            return res.serverError(error);
        }
    },

    updateById: async (req, res, next) => {
        try {
            const { id: workspaceId } = req.params;
            if (!utilService.isValidObjectId(workspaceId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const body = req.body;
            if (Object.keys(body).length === 0) {
                throw global.config.message.BAD_REQUEST;
            }

            const updateObj = {}, query = {};
            if (body?.workspaceName) {
                const obj = utilService.escapeRegex(body.workspaceName);
                if (!obj?.normalized) {
                    throw global.config.message.BAD_REQUEST;
                }

                updateObj.firmName = obj.normalized;
                query.$or = [{
                    firmName: {
                        $regex: `^${obj.escaped}$`,
                        $options: 'i'
                    },
                    _id: { $ne: workspaceId }
                }, {
                    _id: workspaceId
                }];
            } else {
                query._id = workspaceId;
            }

            const duplicate = await workspaceService.findOne(query, {
                projection: { _id: 1 },
                useLean: true,
            });
            if (!duplicate) throw global.config.message.RECORD_NOT_FOUND;
            if (String(duplicate._id) !== workspaceId) {
                throw global.config.message.IS_DUPLICATE;
            }

            if (typeof body?.GSTNo === 'string') {
                updateObj.GSTNo = body.GSTNo.trim();
            }
            if (typeof body.isActive === 'boolean') {
                updateObj.isActive = body.isActive;
            }
            if (body?.dayShift) {
                updateObj.dayShift = body.dayShift;
            }
            if (body?.nightShift) {
                updateObj.nightShift = body.nightShift;
            }

            // manufacturerId assignment (null to remove, string/ObjectId to assign)
            const manufacturerChanged = body.hasOwnProperty('manufacturerId');
            if (manufacturerChanged) {
                const newManufacturerId = body.manufacturerId || null;
                if (newManufacturerId) {
                    if (!utilService.isValidObjectId(newManufacturerId)) {
                        throw global.config.message.BAD_REQUEST;
                    }

                    const mfr = await manufacturerService.findOne(
                        { _id: newManufacturerId },
                        { useLean: true, projection: { _id: 1 } }
                    );
                    if (!mfr) throw global.config.message.RECORD_NOT_FOUND;
                }

                updateObj.manufacturerId = newManufacturerId;
            }

            if (Object.keys(updateObj).length === 0) {
                throw global.config.message.BAD_REQUEST;
            }

            const entry = await workspaceService.findByIdAndUpdate(duplicate._id, updateObj, {
                populate: { path: 'userId', select: 'fullname userName' },
                useLean: true
            });

            // Cascade manufacturerId to all machines in this workspace
            if (manufacturerChanged) {
                await machineModel.updateMany(
                    { workspaceId: duplicate._id, isDeleted: false },
                    { $set: { manufacturerId: updateObj.manufacturerId } }
                );
            }

            return res.ok(entry, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    }
}