const partChangeLogService = require("../../services/partChangeLogService");
const { log, checkRequiredParams } = require("../../services/utilService");


module.exports = {
    create: async (req, res, next) => {
        try {
            const fields = ['machineId', 'partName', 'changedBy', 'changeDate'];
            checkRequiredParams(fields, req.body);
            
            req.body.workspaceId = req.user.workspaceId;
            let partChangeLog = await partChangeLogService.create(req.body);

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
            
            if(Object.keys(updateData).length === 0){
                return res.badRequest(null, global.config.message.NOTHING_TO_UPDATE);
            }
            const updatedPartChangeLog = await partChangeLogService.findByIdAndUpdate(partChangeLogId, updateData);

            return res.ok(updatedPartChangeLog, global.config.message.UPDATED);
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

            let condition = {
                workspaceId: req.user.workspaceId
            };
            if(machineIds && machineIds.length) {
                condition['machineId'] = {
                    $in: machineIds
                };
            }
            let partChangeLogs = await partChangeLogService.find({ ...condition }, { sort: { createdAt: -1 }, populate: { path: 'machineId', select: 'machineName machineCode' }, projection: { isDeleted: 0, createdAt: 0, updatedAt: 0 }, skip, limit, useLean: true });

            return res.ok({ partChangeLogs, page, limit  }, global.config.message.OK);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    },

    partsList: async (req, res, next) => {
        try {
            let partsList = await partChangeLogService.getPartNamesList(req.user.workspaceId);

            return res.ok(partsList, global.config.message.OK);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    }
}