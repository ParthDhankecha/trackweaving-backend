const machineGroupService = require('../../services/machineGroupService');
const utilService = require('../../services/utilService')


module.exports = {
    getMachineGroupsList: async (req, res, next) => {
        try {
            const { workspaceId } = req.user;
            const list = await machineGroupService.find({ workspaceId: workspaceId }, {
                useLean: true,
                projection: { _id: 1, groupName: 1 }
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
                useLean: true,
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
            const groupName = req.body.groupName?.trim();
            if (!groupName || typeof groupName !== 'string') {
                throw global.config.message.BAD_REQUEST;
            }

            const user = req.user;
            const duplicate = await machineGroupService.findOne({
                workspaceId: user.workspaceId,
                groupName: { $regex: `^${utilService.escapeRegex(groupName)}$`, $options: 'i' },
            }, { useLean: true, projection: { _id: 1 } });
            if (duplicate) {
                throw global.config.message.MACHINE_GROUP_ALREADY_EXIST;
            }

            const entry = await machineGroupService.create({
                groupName: groupName,
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
            const groupName = req.body.groupName?.trim();
            if (!utilService.isValidObjectId(id) || !groupName) {
                throw global.config.message.BAD_REQUEST;
            }

            const user = req.user;
            const duplicate = await machineGroupService.findOne({
                workspaceId: user.workspaceId,
                $or: [{
                    _id: { $ne: id },
                    groupName: { $regex: `^${utilService.escapeRegex(groupName)}$`, $options: 'i' }
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
                groupName: groupName
            });

            return res.ok(entry, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    }
}