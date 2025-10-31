const machineGroupService = require('../../services/machineGroupService');
const utilService = require('../../services/utilService')


module.exports = {
    getMachineGroupsList: async (req, res, next) => {
        try {
            const { workspaceId } = req.user;
            const result = await machineGroupService.find({ workspaceId: workspaceId });

            return res.ok(result, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    getMachineGroupById: async (req, res, next) => {
        try {
            const machineGroupId = req.params?.id;
            if (!machineGroupId) {
                throw global.config.message.BAD_REQUEST;
            }

            const { workspaceId } = req.user;
            const machineGroup = await machineGroupService.findOne({ _id: machineGroupId, workspaceId: workspaceId });
            if (!machineGroup) {
                return res.notFound(null, global.config.message.RECORD_NOT_FOUND);
            }

            return res.ok(machineGroup, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    createMachineGroup: async (req, res, next) => {
        try {
            utilService.checkRequiredParams(['groupName'], req.body);
            const reqBody = req.body;

            const isGroupExist = await machineGroupService.findOne({ groupName: reqBody.groupName });
            if (isGroupExist) {
                return res.conflict(null, global.config.message.MACHINE_GROUP_ALREADY_EXIST);
            }

            reqBody.createdBy = req.user.id;
            reqBody.workspaceId = req.user.workspaceId;

            const machineGroup = await machineGroupService.create(reqBody);

            console.log('machineGroup', machineGroup);

            return res.created(machineGroup, global.config.message.CREATED);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    updateMachineGroup: async (req, res, next) => {
        try {
            utilService.checkRequiredParams(['id'], req.params);
            const body = req.body;
            utilService.checkRequiredParams(['groupName'], body);

            const machineGroupId = req.params.id;
            const machineGroup = await machineGroupService.findOne({ _id: machineGroupId, createdBy: req.user.id });
            if (!machineGroup) {
                return res.notFound(null, global.config.message.RECORD_NOT_FOUND);
            }

            const updateObj = {
                groupName: body.groupName
            };

            const updatedMachineGroup = await machineGroupService.findByIdAndUpdate(machineGroupId, updateObj);
            return res.ok(updatedMachineGroup, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    }
}