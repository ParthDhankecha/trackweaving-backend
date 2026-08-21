const machineGroupService = require("../../services/machineGroupService");
const utilService = require("../../services/utilService")


module.exports = {
    getMachineGroupsList: async (req, res, next) => {
        try {
            const { workspaceId } = req.user;
            const list = await machineGroupService.find({ workspaceId }, {
                projection: { groupName: 1 },
                useLean: true
            });

            return res.ok(list, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    getMachineGroupById: async (req, res, next) => {
        try {
            const { id } = req.params;
            if (!utilService.isValidObjectId(id)) throw global.config.message.BAD_REQUEST;

            const { workspaceId } = req.user;
            const machineGroup = await machineGroupService.findOne({ _id: id, workspaceId: workspaceId }, {
                useLean: true
            });
            if (!machineGroup) throw global.config.message.RECORD_NOT_FOUND;

            return res.ok(machineGroup, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    createMachineGroup: async (req, res, next) => {
        try {
            const groupNameObj = utilService.escapeRegex(req.body.groupName, { throwError: true });
            if (!groupNameObj?.normalized) {
                throw global.config.message.BAD_REQUEST;
            }

            const user = req.user;
            const duplicate = await machineGroupService.findOne({
                workspaceId: user.workspaceId,
                groupName: { $regex: `^${groupNameObj.escaped}$`, $options: 'i' },
            }, { useLean: true, projection: { _id: 1 } });
            if (duplicate) {
                throw global.config.message.MACHINE_GROUP_ALREADY_EXIST;
            }

            const entry = await machineGroupService.create({
                groupName: groupNameObj.normalized,
                createdBy: user.id,
                workspaceId: user.workspaceId
            });

            return res.created(entry, global.config.message.CREATED);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    updateMachineGroup: async (req, res, next) => {
        try {
            const { id } = req.params;
            if (!utilService.isValidObjectId(id)) {
                throw global.config.message.BAD_REQUEST;
            }
            const groupNameObj = utilService.escapeRegex(req.body.groupName, { throwError: true });
            if (!groupNameObj?.normalized) {
                throw global.config.message.BAD_REQUEST;
            }

            const user = req.user;
            const duplicate = await machineGroupService.findOne({
                workspaceId: user.workspaceId,
                $or: [{
                    _id: { $ne: id },
                    groupName: { $regex: `^${groupNameObj.escaped}$`, $options: 'i' }
                }, {
                    _id: id,
                }]
            }, {
                useLean: true,
                projection: { groupName: 1 }
            });
            if (!duplicate) throw global.config.message.RECORD_NOT_FOUND;
            if (duplicate._id.toString() !== id) {
                throw global.config.message.MACHINE_GROUP_ALREADY_EXIST;
            }

            const entry = await machineGroupService.findByIdAndUpdate(id, {
                groupName: groupNameObj.normalized
            });

            return res.ok(entry, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    }
}