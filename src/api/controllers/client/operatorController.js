const operatorService = require('../../services/operatorService');
const utilService = require('../../services/utilService');

const _projection = { updatedAt: 0, createdAt: 0, workspaceId: 0, isDeleted: 0 };
const _populate = { path: 'machineIds', select: { machineCode: 1 } };

const getRequestBody = (req) => {
    try {
        const raw = req.body?.data;
        if (typeof raw === 'string') {
            return JSON.parse(raw);
        }
        if (raw && typeof raw === 'object') {
            return raw;
        }
        return req.body || {};
    } catch (error) {
        throw global.config.message.BAD_REQUEST;
    }
};


module.exports = {
    getList: async (req, res, next) => {
        try {
            const { workspaceId } = req.user;
            const filter = { workspaceId };
            const data = { count: 0, list: [] };

            data.count = await operatorService.countDocuments(filter);
            if (data.count > 0) {
                const pagination = utilService.getFilter(req.body);
                data.list = await operatorService.find(filter, {
                    projection: { ..._projection },
                    populate: { ..._populate },
                    ...pagination,
                    sort: { createdAt: -1 },
                });
            }

            return res.ok(data, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    create: async (req, res, next) => {
        let alreadyAssigned = [];
        const file = req.file;
        let pendingProfile = null;
        try {
            const body = getRequestBody(req);
            const nameObj = utilService.escapeRegex(body.operatorName, { throwError: true });
            if (!nameObj?.normalized) {
                throw global.config.message.BAD_REQUEST;
            }

            const { workspaceId } = req.user;
            const shift = operatorService.validateShift(body.shift);
            const machineIds = await operatorService.validateMachineIds(workspaceId, body.machineIds, {
                checkUniqueAssignment: true,
                shift,
                alreadyAssigned
            });

            const duplicate = await operatorService.findOne({
                workspaceId,
                operatorName: { $regex: `^${nameObj.escaped}$`, $options: 'i' }
            }, { useLean: true, projection: '_id' });
            if (duplicate) {
                throw global.config.message.OPERATOR_ALREADY_EXIST;
            }

            const createObj = {
                operatorName: nameObj.normalized,
                shift,
                machineIds,
                workspaceId
            };
            if (file) {
                createObj.profile = await operatorService.saveProfileImage(file);
                pendingProfile = operatorService.getProfilePath(createObj.profile);
            }

            await operatorService.create(createObj);
            pendingProfile = null;

            return res.created(null, global.config.message.CREATED);
        } catch (error) {
            utilService.log(error);
            if (pendingProfile) utilService.deleteLocalFile(pendingProfile);
            if (file?.path) utilService.deleteLocalFile(file.path);

            if (alreadyAssigned?.length > 0) {
                return res.serverError(error, { alreadyAssigned });
            }
            return res.serverError(error);
        }
    },

    update: async (req, res, next) => {
        let alreadyAssigned = [];
        const file = req.file;
        let pendingProfile = null;
        try {
            const operatorId = req.params.id;
            if (!utilService.isValidObjectId(operatorId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const body = getRequestBody(req);
            const { workspaceId } = req.user;
            const updateObj = {};

            const query = { _id: operatorId, workspaceId };
            if (body.hasOwnProperty('operatorName')) {
                const nameObj = utilService.escapeRegex(body.operatorName, { throwError: true });
                if (!nameObj?.normalized) {
                    throw global.config.message.BAD_REQUEST;
                }

                updateObj.operatorName = nameObj.normalized;
                delete query._id;
                Object.assign(query, {
                    $or: [{
                        operatorName: { $regex: `^${nameObj.escaped}$`, $options: 'i' },
                        _id: { $ne: operatorId }
                    }, {
                        _id: operatorId
                    }]
                });
            }
            if (body.hasOwnProperty('shift')) {
                updateObj.shift = operatorService.validateShift(body.shift);
            }
            if (body.hasOwnProperty('machineIds')) {
                if (!Array.isArray(body.machineIds) || body.machineIds.some((id) => !utilService.isValidObjectId(id))) {
                    throw global.config.message.BAD_REQUEST;
                }
                updateObj.machineIds = [...new Set(body.machineIds)];
            }

            const existing = await operatorService.findOne(query, {
                projection: { shift: 1, machineIds: 1, profile: 1 }
            });
            if (!existing) throw global.config.message.NOT_FOUND;
            if (String(existing._id) !== String(operatorId)) {
                throw global.config.message.OPERATOR_ALREADY_EXIST;
            }

            if (updateObj.hasOwnProperty('machineIds') || updateObj.hasOwnProperty('shift')) {
                const shift = updateObj.shift ?? existing.shift;
                const machineIds = updateObj.machineIds ?? (existing.machineIds || []).map((id) => String(id));
                updateObj.machineIds = await operatorService.validateMachineIds(workspaceId, machineIds, {
                    checkUniqueAssignment: true,
                    excludeOperatorId: operatorId,
                    shift,
                    alreadyAssigned
                });
            }

            let oldProfile = null;
            if (file) {
                oldProfile = existing.profile;
                updateObj.profile = await operatorService.saveProfileImage(file);
                pendingProfile = operatorService.getProfilePath(updateObj.profile);
            } else if (body.removeProfile) {
                oldProfile = existing.profile;
                updateObj.profile = null;
            }

            const entry = await operatorService.findOneAndUpdate({ _id: operatorId, workspaceId }, updateObj, {
                projection: { ..._projection },
                populate: { ..._populate },
            });
            if (!entry) throw global.config.message.NOT_UPDATED;

            pendingProfile = null;
            if (oldProfile) {
                utilService.deleteLocalFile(operatorService.getProfilePath(oldProfile));
            }

            return res.ok(entry, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            if (pendingProfile) utilService.deleteLocalFile(pendingProfile);
            if (file?.path) utilService.deleteLocalFile(file.path);

            if (alreadyAssigned?.length > 0) {
                return res.serverError(error, { alreadyAssigned });
            }
            return res.serverError(error);
        }
    },

    delete: async (req, res, next) => {
        try {
            const operatorId = req.params.id;
            if (!utilService.isValidObjectId(operatorId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const { workspaceId } = req.user;
            const entry = await operatorService.findOneAndDelete({ _id: operatorId, workspaceId }, {
                projection: { ..._projection },
                useLean: false,
            });
            if (!entry) throw global.config.message.NOT_DELETED;
            await operatorService.handleProfileAfterDeletion(entry);

            return res.ok(null, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    }
};