const machineGroupService = require("../../services/machineGroupService");
const machineService = require("../../services/machineService");
const utilService = require("../../services/utilService");


module.exports = {
    getMachineList: async (req, res, next) => {
        try {
            const { workspaceId } = req.user;
            const machines = await machineService.find({ workspaceId, isDeleted: false }, {
                populate: 'machineGroupId',
                projection: 'serialNumber machineCode machineName quality reed ip machineGroupId maxSpeedLimit isAlertActive',
                useLean: true,
            });

            return res.ok(machines, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    optionList: async (req, res, next) => {
        try {
            const { workspaceId } = req.user;
            const machines = await machineService.find({ workspaceId }, {
                projection: 'machineCode machineName',
                useLean: true,
            });

            return res.ok(machines, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    updateMachine: async (req, res, next) => {
        try {
            const { id: machineId } = req.params;
            if (!utilService.isValidObjectId(machineId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const machine = await machineService.findOne({ _id: machineId, isDeleted: false }, {
                useLean: true,
            });
            if (!machine) throw global.config.message.RECORD_NOT_FOUND;

            const updateData = req.body;
            if (updateData.machineGroupId) {
                const machineGroup = await machineGroupService.findOne({ _id: updateData.machineGroupId }, {
                    useLean: true,
                    projection: '_id',
                });
                if (!machineGroup) throw global.config.message.MACHINE_GROUP_NOT_FOUND;
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

            const updatedMachine = await machineService.findByIdAndUpdate(machineId, updateData);

            return res.ok(updatedMachine, global.config.message.UPDATED);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    }
}