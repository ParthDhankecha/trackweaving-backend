const machineGroupService = require('../../services/machineGroupService');
const machineService = require('../../services/machineService');
const { log } = require('../../services/utilService');


module.exports = {
    optionList: async (req, res, next) => {
        try {
            const workspaceId = req.user.workspaceId;
            const projection = 'machineCode machineName machineGroupId';
            const machines = await machineService.find({ workspaceId, isDeleted: false }, { projection: projection });

            return res.ok(machines, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    getMachineList: async (req, res, next) => {
        try {
            const workspaceId = req.user.workspaceId;
            const projection = 'serialNumber machineCode machineName ip machineGroupId isAlertActive';
            const machines = await machineService.find({ workspaceId, isDeleted: false }, { populate: 'machineGroupId', projection: projection });

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

            const machine = await machineService.findOne({ _id: machineId, isDeleted: false }, { useLean: true });
            if (!machine) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            if (updateData.machineGroupId) {
                const isGroupExist = await machineGroupService.findOne({ _id: updateData.machineGroupId }, { useLean: true });
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
            if (updateData.maxSpeedLimit <= 0) {
                updateData.maxSpeedLimit = null;
            }
            if (updateData.maxSpeedLimit && machine.maxSpeedLimit !== updateData.maxSpeedLimit) {
                if (!global.config.MACHINE_ALERT_CONFIG[machineId]) {
                    global.config.MACHINE_ALERT_CONFIG[machineId] = {
                        sendAlert: machine.isAlertActive || false
                    };
                }
                global.config.MACHINE_ALERT_CONFIG[machineId].speedLimit = updateData.maxSpeedLimit;
                delete global.config.MACHINE_ALERT_CONFIG[machineId].lastSpeedAlertTime;
            } else if (updateData.maxSpeedLimit === null) {
                if (global.config.MACHINE_ALERT_CONFIG[machineId]) {
                    delete global.config.MACHINE_ALERT_CONFIG[machineId];
                }
            }
            if (typeof updateData.isAlertActive == 'boolean' && global.config.MACHINE_ALERT_CONFIG[machineId]) {
                global.config.MACHINE_ALERT_CONFIG[machineId].sendAlert = updateData.isAlertActive;
            }
            if (updateData.hasOwnProperty('machineGroupId')) {
                updateData.machineGroupId = updateData.machineGroupId || null;
            }

            const projection = 'serialNumber machineCode machineName ip machineGroupId isAlertActive';
            const updatedMachine = await machineService.findByIdAndUpdate(machineId, updateData, { populate: 'machineGroupId', projection });
            if (!updatedMachine) {
                throw global.config.message.NOT_UPDATED;
            }

            return res.ok(updatedMachine, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    }
}