const machineGroupService = require("../../services/machineGroupService");
const machineService = require("../../services/machineService");
const utilService = require("../../services/utilService");

const projection = 'serialNumber machineCode machineName ip machineGroupId isAlertActive maxSpeedLimit quality reed panna';


module.exports = {
    getMachineList: async (req, res, next) => {
        try {
            const { workspaceId } = req.user;
            const machines = await machineService.find({ workspaceId, isDeleted: false }, {
                populate: { path: 'machineGroupId', select: 'groupName' },
                projection: projection,
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

            const { workspaceId, type: userType } = req.user;
            const machine = await machineService.findOne({ _id: machineId, workspaceId }, { useLean: true });
            if (!machine) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            const updateObj = {}, body = req.body;
            // if (body.machineCode) {
            //     machineService.validateMachineCode(body.machineCode);
            //     updateObj.machineCode = body.machineCode;
            // }
            if (body.hasOwnProperty('machineGroupId')) {
                updateObj.machineGroupId = null;
                if (body.machineGroupId) {
                    if (!utilService.isValidObjectId(body.machineGroupId)) {
                        throw global.config.message.BAD_REQUEST;
                    }

                    const mg = await machineGroupService.findOne({ _id: body.machineGroupId, workspaceId }, {
                        useLean: true,
                        projection: '_id'
                    });
                    if (!mg) throw global.config.message.MACHINE_GROUP_NOT_FOUND;

                    updateObj.machineGroupId = mg._id;
                }
            }
            if (body?.hasOwnProperty('maxSpeedLimit')) {
                updateObj.maxSpeedLimit = null;
                if (utilService.isNumber(body.maxSpeedLimit, { min: 1 })) {
                    updateObj.maxSpeedLimit = body.maxSpeedLimit;
                }
            }
            if (typeof body.quality === 'string') {
                updateObj.quality = body.quality.trim();
            }
            if (typeof body.reed === 'string') {
                updateObj.reed = body.reed.trim();
            }
            if (body.hasOwnProperty('panna')) {
                updateObj.panna = utilService.parsePanna(body.panna);
            }
            if (userType === global.config.USERS.TYPE.ADMIN) {
                if (typeof body.isAlertActive === 'boolean') {
                    updateObj.isAlertActive = body.isAlertActive;
                }
            }

            // if (updateObj.machineCode) {
            //     const duplicate = await machineService.findOne({
            //         workspaceId,
            //         machineCode: updateObj.machineCode,
            //         _id: { $ne: machineId }
            //     }, {
            //         useLean: true,
            //         handleDeleted: false,
            //         projection: '_id'
            //     });
            //     if (duplicate) throw global.config.message.IS_DUPLICATE;
            // }

            const entry = await machineService.findOneAndUpdate({ _id: machineId, workspaceId }, updateObj, {
                populate: { path: 'machineGroupId', select: 'groupName' },
                projection: projection,
            });
            if (!entry) throw global.config.message.NOT_UPDATED;


            if (updateObj.hasOwnProperty('maxSpeedLimit')) {
                if (!entry.maxSpeedLimit) {
                    delete global.config.MACHINE_ALERT_CONFIG[machineId];
                } else if (entry.maxSpeedLimit && machine.maxSpeedLimit !== entry.maxSpeedLimit) {
                    if (!global.config.MACHINE_ALERT_CONFIG[machineId]) {
                        global.config.MACHINE_ALERT_CONFIG[machineId] = {
                            sendAlert: entry.isAlertActive ?? false
                        };
                    }

                    global.config.MACHINE_ALERT_CONFIG[machineId].speedLimit = entry.maxSpeedLimit;
                    delete global.config.MACHINE_ALERT_CONFIG[machineId].lastSpeedAlertTime;
                }
            }
            if (typeof updateObj.isAlertActive == 'boolean' && global.config.MACHINE_ALERT_CONFIG[machineId]) {
                global.config.MACHINE_ALERT_CONFIG[machineId].sendAlert = updateObj.isAlertActive;
            }


            return res.ok(entry, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    }
}