const machineGroupService = require("../../services/machineGroupService");
const machineService = require("../../services/machineService");
const { log } = require("../../services/utilService");

module.exports = {
    getMachineList: async (req, res, next) => {
        try {
            const workspaceId = req.user.workspaceId;
            const machines = await machineService.find({ workspaceId, isDeleted: false }, { populate: 'machineGroupId', projection: 'machineCode machineName serialNumber ip machineGroupId isAlertActive' });

            return res.ok(machines, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    updateMachine: async (req, res, next) => {
        try {
            const machineId = req.params.id;
            const updateData = req.body;

            const machine = await machineService.findOne({ _id: machineId, isDeleted: false });
            if (!machine) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            if (updateData.machineGroupId) {
                const isGroupExist = await machineGroupService.findOne({ _id: updateData.machineGroupId });
                if (!isGroupExist) {
                    throw global.config.message.MACHINE_GROUP_NOT_FOUND;
                }
            }

            delete updateData._id; // Prevent updating the _id field
            delete updateData.createdBy; // Prevent updating the createdBy field
            delete updateData.workspaceId; // Prevent updating the workspaceId field
            delete updateData.isDeleted; // Prevent updating the isDeleted field
            delete updateData.ip; // Prevent updating the ip field
            delete updateData.lastStopTime; // Prevent updating the lastStopTime field
            delete updateData.lastStartTime; // Prevent updating the lastStartTime field
            delete updateData.stopsCount; // Prevent updating the stopsCount field
            delete updateData.stopsData; // Prevent updating the stopsData field

            const updatedMachine = await machineService.findByIdAndUpdate(machineId, updateData);

            return res.ok(updatedMachine, global.config.message.UPDATED);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    }
}