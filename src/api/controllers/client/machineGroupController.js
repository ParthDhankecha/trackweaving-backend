const machineGroupService = require("../../services/machineGroupService");
const { log, checkRequiredParams } = require("../../services/utilService")


module.exports = {
    createMachineGroup: async (req, res, next) => {
        try {
            checkRequiredParams(['groupName'], req.body);
            const reqBody = req.body;

            const isGroupExist = await machineGroupService.findOne({ groupName: reqBody.groupName });
            if (isGroupExist) {
                return res.conflict(null, global.config.message.MACHINE_GROUP_ALREADY_EXIST);
            }
            reqBody.createdBy = req.user.id;

            const machineGroup = await machineGroupService.create(reqBody);

            return res.created(machineGroup, global.config.message.CREATED);
        } catch (error) {
            log(error)
            return res.serverError(error)
        }
    },

    getMachineGroupsList: async (req, res, next) => {
        try {
            const result = await machineGroupService.find({ createdBy: req.user.id });

            return res.ok(result, global.config.message.OK);
        } catch (error) {
            log(error)
            return res.serverError(error)
        }
    },

    getMachineGroupById: async (req, res, next) => {
        try {
            checkRequiredParams(['id'], req.params);

            const machineGroup = await machineGroupService.findOne({ _id: req.params.id, createdBy: req.user.id });
            if (!machineGroup) {
                return res.notFound(null, global.config.message.RECORD_NOT_FOUND);
            }

            return res.ok(machineGroup, global.config.message.OK);
        } catch (error) {
            log(error)
            return res.serverError(error)
        }
    },

    updateMachineGroup: async (req, res, next) => {
        try {
            checkRequiredParams(['id'], req.params);
            checkRequiredParams(['groupName'], req.body);

            const machineGroup = await machineGroupService.findOne({ _id: req.params.id, createdBy: req.user.id });
            if (!machineGroup) {
                return res.notFound(null, global.config.message.RECORD_NOT_FOUND);
            }

            const updateObj = {
                groupName: req.body.groupName
            };

            const updatedMachineGroup = await machineGroupService.findByIdAndUpdate(req.params.id, updateObj);
            return res.ok(updatedMachineGroup, global.config.message.OK);
        } catch (error) {
            log(error)
            return res.serverError(error)
        }
    }
}