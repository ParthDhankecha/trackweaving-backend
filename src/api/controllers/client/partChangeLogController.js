const partChangeLogService = require('../../services/partChangeLogService');
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
            const fields = ['machineId', 'partName', 'changedBy', 'changeDate'];
            checkRequiredParams(fields, body);

            body.workspaceId = req.user.workspaceId;

            const partName = { $regex: new RegExp(`^${body.partName}$`, 'i') };
            const existingLog = await partChangeLogService.findOne({ partName }, { useLean: true });
            if (existingLog) {
                return res.badRequest(null, global.config.message.IS_DUPLICATE);
            }

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
            const updateData = req.body;

            delete updateData._id;
            delete updateData.workspaceId;
            delete updateData.machineId;
            delete updateData.createdAt;
            delete updateData.isDeleted;

            if (Object.keys(updateData).length === 0) {
                return res.badRequest(null, global.config.message.NOTHING_TO_UPDATE);
            }

            if (updateData.partName) {
                const partName = { $regex: new RegExp(`^${updateData.partName}$`, 'i') };
                const existingLog = await partChangeLogService.findOne({ partName, _id: { $ne: partChangeLogId } }, { useLean: true });
                if (existingLog) {
                    return res.badRequest(null, global.config.message.IS_DUPLICATE);
                }
            }

            const updatedPartChangeLog = await partChangeLogService.findByIdAndUpdate(partChangeLogId, updateData);
            if (!updatedPartChangeLog) {
                return res.badRequest(null, global.config.message.NOT_UPDATED);
            }

            return res.ok(updatedPartChangeLog, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    }
}