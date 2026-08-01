const partChangeLogService = require('../../services/partChangeLogService');
const utilService = require('../../services/utilService');
const { log, checkRequiredParams } = require('../../services/utilService');


module.exports = {
    partsList: async (req, res, next) => {
        try {
            const partsList = await partChangeLogService.getPartNamesList(req.user.workspaceId);

            return res.ok(partsList, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    list: async (req, res, next) => {
        try {
            let { page, limit, machineIds } = req.body;
            page = parseInt(page) || 1;
            limit = parseInt(limit) || 10;
            const skip = (page - 1) * limit;

            const condition = {
                workspaceId: req.user.workspaceId
            };
            if (machineIds && machineIds.length) {
                condition['machineId'] = {
                    $in: machineIds
                };
            }

            const partChangeLogs = await partChangeLogService.find({ ...condition }, {
                sort: { createdAt: -1 },
                populate: { path: 'machineId', select: 'machineName machineCode' },
                projection: { isDeleted: 0, createdAt: 0, updatedAt: 0 },
                skip,
                limit,
                useLean: true
            });
            const totalCount = await partChangeLogService.countDocuments(condition);

            return res.ok({ partChangeLogs, totalCount }, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    create: async (req, res, next) => {
        try {
            const body = req.body;
            const fields = ['machineId', 'partName', 'changeDate'];
            checkRequiredParams(fields, body);

            body.workspaceId = req.user.workspaceId;
            const partChangeLog = await partChangeLogService.create(body);

            return res.ok(partChangeLog, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    update: async (req, res, next) => {
        try {
            const partChangeLogId = req.params.id;
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
                return res.badRequest(null, global.config.message.NOTHING_TO_UPDATE);
            }

            const updated = await partChangeLogService.findByIdAndUpdate(partChangeLogId, updateData);
            if (!updated) {
                return res.badRequest(null, global.config.message.NOT_UPDATED);
            }

            return res.ok(updated, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    }
}