const machineGroupService = require("../../services/machineGroupService");
const utilService = require("../../services/utilService")


module.exports = {
    createMachineGroup: async (req, res, next) => {
        try {
            const groupName = req.body.groupName?.trim();
            if (!groupName || typeof groupName !== 'string') {
                throw global.config.message.BAD_REQUEST;
            }

            const user = req.user
            const duplicate = await machineGroupService.findOne({
                workspaceId: user.workspaceId,
                groupName: { $regex: `^${utilService.escapeRegex(groupName)}$`, $options: 'i' },
            });
            if (duplicate) {
                throw global.config.message.MACHINE_GROUP_ALREADY_EXIST;
            }

            const machineGroup = await machineGroupService.create({
                groupName: groupName,
                createdBy: user.id,
                workspaceId: user.workspaceId
            });

            return res.created(machineGroup, global.config.message.CREATED);
        } catch (error) {
            utilService.log(error)
            return res.serverError(error)
        }
    },

    getMachineGroupsList: async (req, res, next) => {
        try {
            const { workspaceId } = req.user;
            const list = await machineGroupService.find({ workspaceId }, {
                projection: { groupName: 1 },
                useLean: true
            });

            return res.ok(list, global.config.message.OK);
        } catch (error) {
            utilService.log(error)
            return res.serverError(error)
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
            utilService.log(error)
            return res.serverError(error)
        }
    },

    updateMachineGroup: async (req, res, next) => {
        try {
            const { id } = req.params;
            const groupName = req.body.groupName?.trim();
            if (!utilService.isValidObjectId(id) || !groupName) {
                throw global.config.message.BAD_REQUEST;
            }

            const user = req.user
            const duplicate = await machineGroupService.findOne({
                $or: [{
                    workspaceId: user.workspaceId,
                    _id: { $ne: id },
                    groupName: { $regex: `^${utilService.escapeRegex(groupName)}$`, $options: 'i' }
                }, {
                    _id: id,
                    createdBy: user.id
                }]
            }, {
                useLean: true,
                projection: { groupName: 1 }
            });
            if (!duplicate) throw global.config.message.RECORD_NOT_FOUND;
            if (duplicate._id.toString() !== id) throw global.config.message.MACHINE_GROUP_ALREADY_EXIST;

            const entry = await machineGroupService.findByIdAndUpdate(id, {
                groupName: groupName
            });

            return res.ok(entry, global.config.message.OK);
        } catch (error) {
            utilService.log(error)
            return res.serverError(error)
        }
    }
}