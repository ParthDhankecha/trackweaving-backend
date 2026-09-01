const operatorService = require('../../services/operatorService');
const utilService = require('../../services/utilService');

const _projection = { updatedAt: 0, createdAt: 0, workspaceId: 0, isDeleted: 0 };
const _populate = { path: 'machineIds', select: { machineCode: 1, machineName: 1 } };


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
        try {
            const body = req.body;
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

            await operatorService.create({
                operatorName: nameObj.normalized,
                shift,
                machineIds,
                workspaceId
            });

            return res.created(null, global.config.message.CREATED);
        } catch (error) {
            utilService.log(error);
            if (alreadyAssigned?.length > 0) {
                return res.serverError(error, { alreadyAssigned });
            }
            return res.serverError(error);
        }
    },

    update: async (req, res, next) => {
        let alreadyAssigned = [];
        try {
            const operatorId = req.params.id;
            if (!utilService.isValidObjectId(operatorId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const updateObj = {}, body = req.body;

            let nameObj = null;
            if (body.hasOwnProperty('operatorName')) {
                nameObj = utilService.escapeRegex(body.operatorName, { throwError: true });
                if (!nameObj?.normalized) {
                    throw global.config.message.BAD_REQUEST;
                }
                updateObj.operatorName = nameObj.normalized;
            }

            const { workspaceId } = req.user;
            const needsAssignmentCheck = body.hasOwnProperty('machineIds') || body.hasOwnProperty('shift');
            let existing = null;
            if (needsAssignmentCheck && (!body.hasOwnProperty('machineIds') || !body.hasOwnProperty('shift'))) {
                existing = await operatorService.findOne({ _id: operatorId, workspaceId }, {
                    useLean: true,
                    projection: 'shift machineIds'
                });
                if (!existing) throw global.config.message.NOT_UPDATED;
            }

            if (body.hasOwnProperty('shift')) {
                updateObj.shift = operatorService.validateShift(body.shift);
            }

            if (needsAssignmentCheck) {
                const shift = updateObj.hasOwnProperty('shift') ? updateObj.shift : existing.shift;
                const machineIds = body.hasOwnProperty('machineIds') ? body.machineIds : (existing.machineIds || []).map((id) => String(id));
                updateObj.machineIds = await operatorService.validateMachineIds(workspaceId, machineIds, {
                    checkUniqueAssignment: true,
                    excludeOperatorId: operatorId,
                    shift,
                    alreadyAssigned
                });
            }

            if (Object.keys(updateObj).length === 0) {
                throw global.config.message.BAD_REQUEST;
            }

            if (updateObj.operatorName) {
                const duplicate = await operatorService.findOne({
                    workspaceId,
                    operatorName: { $regex: `^${nameObj.escaped}$`, $options: 'i' },
                    _id: { $ne: operatorId },
                }, {
                    useLean: true,
                    projection: '_id'
                });
                if (duplicate) throw global.config.message.OPERATOR_ALREADY_EXIST;
            }

            const entry = await operatorService.findOneAndUpdate({ _id: operatorId, workspaceId }, updateObj, {
                projection: { ..._projection },
                populate: { ..._populate },
            });
            if (!entry) throw global.config.message.NOT_UPDATED;

            return res.ok(entry, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
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
            });
            if (!entry) throw global.config.message.NOT_DELETED;

            return res.ok(null, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    }
};