const machineService = require('../../services/machineService');
const userService = require('../../services/userService');
const machineEnums = require('../../../config/constant/scoped/machine');
const utilService = require('../../services/utilService');


module.exports = {
    getConfigurations: async (req, res, next) => {
        try {
            const data = {
                machineNames: machineEnums.MACHINE_NAMES,
                deviceTypes: machineEnums.DEVICE_TYPE,
                displayTypes: machineEnums.DISPLAY_TYPE,
                machineTypes: machineEnums.MACHINE_TYPE,
            };

            return res.ok(data, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    getMachineCode: async (req, res, next) => {
        try {
            const { workspaceId } = req.params;
            if (!utilService.isValidObjectId(workspaceId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const machineCode = await machineService.getNextMachineCode(workspaceId);
            if (!machineCode) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            return res.ok({ machineCode }, global.config.message.OK);
        } catch (error) {
            utilService.log(error)
            return res.serverError(error)
        }
    },

    optionList: async (req, res, next) => {
        try {
            const { workspaceId } = req.params;
            if (!utilService.isValidObjectId(workspaceId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const machines = await machineService.find({ workspaceId, isDeleted: false }, {
                projection: 'machineCode machineName',
                useLean: true
            });

            return res.ok({ list: machines }, global.config.message.OK);
        } catch (error) {
            utilService.log(error)
            return res.serverError(error)
        }
    },

    create: async (req, res, next) => {
        try {
            const body = req.body;
            utilService.checkRequiredParams(['workspaceId', 'machineCode', 'machineName', 'ip'], body);
            if (!utilService.isValidObjectId(body.workspaceId)) {
                throw global.config.message.BAD_REQUEST;
            }
            machineService.validateMachineCode(body.machineCode);
            machineService.validateIp(body.ip);

            const keyMap = {
                deviceType: 'DEVICE_TYPE',
                displayType: 'DISPLAY_TYPE',
                machineType: 'MACHINE_TYPE'
            };
            for (const field in keyMap) {
                if (typeof body[field] !== 'string' || !body[field]) throw global.config.message.BAD_REQUEST;
                if (!machineEnums[keyMap[field]].includes(body[field])) {
                    throw global.config.message.BAD_REQUEST;
                }
            }

            const duplicate = await machineService.findOne({
                workspaceId: body.workspaceId,
                $or: [
                    { machineCode: body.machineCode },
                    { ip: body.ip }
                ]
            }, { useLean: true, handleDeleted: false, projection: '_id' });
            if (duplicate) throw global.config.message.IS_DUPLICATE;

            await machineService.create(body);

            return res.created(null, global.config.message.CREATED);
        } catch (error) {
            utilService.log(error)
            return res.serverError(error)
        }
    },

    getList: async (req, res, next) => {
        try {
            const searchQuery = {}, body = req.body;
            if (body?.workspaceId) {
                searchQuery.workspaceId = { $in: body.workspaceId };
            }

            if (body?.machineName) {
                searchQuery.machineName = { $regex: body.machineName, $options: 'i' };
            }
            for (const field of ['machineCode', 'ip']) {
                if (body?.[field]?.trim?.()) {
                    if (!searchQuery.$or) searchQuery['$or'] = [];
                    searchQuery['$or'].push({ [field]: { $regex: body[field], $options: 'i' } });
                }
            }

            const data = {
                list: [],
                totalCount: 0
            };

            data.totalCount = await machineService.countDocuments(searchQuery);
            if (data.totalCount > 0) {
                const pagination = utilService.getFilter({
                    page: body.page,
                    limit: body.limit
                });

                data.list = await machineService.find(searchQuery, {
                    ...pagination,
                    populate: { path: 'workspaceId', select: 'firmName' },
                    projection: { machineCode: 1, machineName: 1, workspaceId: 1, ip: 1, deviceType: 1, displayType: 1, machineType: 1, quality: 1, reed: 1 },
                    useLean: true,
                });
            }

            return res.ok(data, global.config.message.OK);
        } catch (error) {
            utilService.log(error)
            return res.serverError(error)
        }
    },

    getById: async (req, res, next) => {
        try {
            const { id } = req.params;
            if (!utilService.isValidObjectId(id)) {
                throw global.config.message.BAD_REQUEST;
            }

            const machine = await machineService.findOne({ _id: id }, { useLean: true });
            if (!machine) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            return res.ok(machine, global.config.message.OK);
        } catch (error) {
            utilService.log(error)
            return res.serverError(error)
        }
    },

    update: async (req, res, next) => {
        try {
            const { id: machineId } = req.params;
            if (!utilService.isValidObjectId(machineId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const body = req.body;
            if (Object.keys(body).length === 0) {
                throw global.config.message.BAD_REQUEST;
            }

            const machine = await machineService.findOne({ _id: machineId }, { useLean: true, projection: 'workspaceId' });
            if (!machine) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            if (body.workspaceId && !utilService.isValidObjectId(body.workspaceId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const keyMap = {
                deviceType: 'DEVICE_TYPE',
                displayType: 'DISPLAY_TYPE',
                machineType: 'MACHINE_TYPE'
            };
            for (const field in keyMap) {
                if (typeof body[field] !== 'string') continue;
                if (!body[field] || !machineEnums[keyMap[field]].includes(body[field])) {
                    throw global.config.message.BAD_REQUEST;
                }
            }

            if (body.machineCode || body.ip) {
                if (!body.workspaceId) throw global.config.message.BAD_REQUEST;

                const query = {
                    workspaceId: body.workspaceId,
                    _id: { $ne: machineId },
                    $or: []
                };
                if (body.machineCode) {
                    machineService.validateMachineCode(body.machineCode);
                    query.$or.push({ machineCode: body.machineCode });
                }
                if (body.ip) {
                    machineService.validateIp(body.ip);
                    query.$or.push({ ip: body.ip });
                }

                const duplicate = await machineService.findOne(query, {
                    useLean: true, handleDeleted: false, projection: '_id'
                });
                if (duplicate) throw global.config.message.IS_DUPLICATE;
            }

            const result = await machineService.findByIdAndUpdate(machineId, body, {
                projection: { machineCode: 1, machineName: 1, workspaceId: 1, ip: 1, deviceType: 1, displayType: 1, machineType: 1, quality: 1, reed: 1 },
                populate: { path: 'workspaceId', select: 'firmName' },
            });
            if (!result) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            // refresh machine list for master users
            if (String(machine.workspaceId) !== String(result.workspaceId)) {
                const refreshed = await userService.updateMany({
                    workspaceId: machine.workspaceId,
                    machineIds: { $in: [machine._id] }
                }, {
                    $pull: { machineIds: machineId }
                });
                console.log(`UPDATED: master users for machine ${machineId} refreshed:`, refreshed);
            }

            return res.ok(result, global.config.message.UPDATED);
        } catch (error) {
            utilService.log(error)
            return res.serverError(error)
        }
    },

    delete: async (req, res, next) => {
        try {
            const { id } = req.params;
            if (!utilService.isValidObjectId(id)) {
                throw global.config.message.BAD_REQUEST;
            }

            const entry = await machineService.softDeleteOne({ _id: id }, {
                useLean: true,
                projection: 'workspaceId'
            });
            if (!entry) throw global.config.message.RECORD_NOT_FOUND;

            if (entry.workspaceId) {
                const refreshed = await userService.updateMany({
                    workspaceId: entry.workspaceId,
                    machineIds: { $in: [entry._id] }
                }, {
                    $pull: { machineIds: entry._id }
                });
                console.log(`DELETED: master users for machine ${entry._id} refreshed:`, refreshed);
            }

            return res.ok(entry, global.config.message.OK);
        } catch (error) {
            utilService.log(error)
            return res.serverError(error)
        }
    }
}