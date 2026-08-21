const partChangeLogService = require("../../services/partChangeLogService");
const utilService = require('../../services/utilService');

const _projection = { workspaceId: 0, isDeleted: 0, createdAt: 0, updatedAt: 0 };

module.exports = {
    partsList: async (req, res, next) => {
        try {
            const { workspaceId } = req.user;
            const list = await partChangeLogService.getPartNamesList(workspaceId);

            return res.ok(list, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    list: async (req, res, next) => {
        try {
            const { machineIds, ...body } = req.body;
            const condition = {
                workspaceId: req.user.workspaceId
            };
            if (Array.isArray(machineIds) && machineIds.length) {
                if (machineIds.some(id => !utilService.isValidObjectId(id))) {
                    throw global.config.message.BAD_REQUEST;
                }
                condition['machineId'] = {
                    $in: machineIds
                };
            }

            const data = {
                partChangeLogs: [],
                count: 0,
                page: 0,
                limit: 0,
            };

            data.count = await partChangeLogService.countDocuments(condition);
            if (data.count > 0) {
                const pagination = utilService.getFilter(body);

                data.partChangeLogs = await partChangeLogService.find({ ...condition }, {
                    sort: { createdAt: -1 },
                    populate: { path: 'machineId', select: 'machineName machineCode' },
                    projection: _projection,
                    skip: pagination.skip,
                    limit: pagination.limit,
                    useLean: true
                });
            }

            return res.ok(data, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    create: async (req, res, next) => {
        try {
            const body = req.body;
            const createObj = {
                machineId: body.machineId,
                partName: body.partName?.trim?.(),
                changeDate: body.changeDate?.trim?.(),
                changedBy: body.changedBy?.trim?.(),
                changedByContact: body.changedByContact?.trim?.(),
                notes: body.notes?.trim?.(),
            };

            const fields = ['machineId', 'partName', 'changeDate'];
            utilService.checkRequiredParams(fields, createObj);
            if (!utilService.isValidObjectId(createObj.machineId)) {
                throw global.config.message.BAD_REQUEST;
            }

            createObj.workspaceId = req.user.workspaceId;
            await partChangeLogService.create(createObj);

            return res.ok(null, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    update: async (req, res, next) => {
        try {
            const pclId = req.params.id;
            if (!utilService.isValidObjectId(pclId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const updateData = {}, body = req.body;

            if (body?.hasOwnProperty('partName')) {
                updateData.partName = body.partName;
            }
            if (body?.hasOwnProperty('machineId')) {
                if (!utilService.isValidObjectId(body.machineId)) {
                    throw global.config.message.BAD_REQUEST;
                }
                updateData.machineId = body.machineId;
            }
            if (body?.hasOwnProperty('changeDate')) {
                updateData.changeDate = body.changeDate;
            }
            if (body?.hasOwnProperty('changedBy')) {
                updateData.changedBy = body.changedBy;
            }
            if (body?.hasOwnProperty('changedByContact')) {
                updateData.changedByContact = body.changedByContact;
            }
            if (body?.hasOwnProperty('notes')) {
                updateData.notes = body.notes;
            }

            if (Object.keys(updateData).length === 0) {
                throw global.config.message.BAD_REQUEST;
            }

            const entry = await partChangeLogService.findOneAndUpdate({ _id: pclId }, updateData, {
                projection: _projection,
                populate: { path: 'machineId', select: 'machineName machineCode' },
                useLean: true
            });
            if (!entry) {
                throw global.config.message.NOT_UPDATED;
            }

            return res.ok(entry, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    delete: async (req, res, next) => {
        try {
            const pclId = req.params.id;
            if (!utilService.isValidObjectId(pclId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const deleted = await partChangeLogService.findOneAndUpdate({ _id: pclId, isDeleted: false }, { isDeleted: true }, {
                projection: '_id',
                useLean: true
            });
            if (!deleted) {
                throw global.config.message.NOT_DELETED;
            }

            return res.ok(null, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    }
}