const machineService = require("../../services/machineService");
const utilService = require("../../services/utilService");
const { log, checkRequiredParams } = require("../../services/utilService")



module.exports = {
    getMachineCode: async (req, res, next) => {
        try {
            checkRequiredParams(['workspaceId'], req.params);
            const machineCode = await machineService.getNextMachineCode(req.params.workspaceId);
            if (!machineCode) {
                throw global.config.message.RECORD_NOT_FOUND;
            }
            return res.ok({ machineCode }, global.config.message.OK);
        } catch (error) {
            log(error)
            return res.serverError(error)
        }
    },

    create: async (req, res, next) => {
        try {
            checkRequiredParams(['machineCode', 'machineName', 'workspaceId', 'ip'], req.body);
            const reqBody = req.body;

            const isMachineExist = await machineService.findOne({
                workspaceId: reqBody.workspaceId,
                $or: [
                    { machineCode: { $regex: reqBody.machineCode, $options: 'i' } },
                    { ip: { $regex: reqBody.ip, $options: 'i' } }
                ]
            });
            if (isMachineExist) {
                throw global.config.message.IS_DUPLICATE;
            }

            await machineService.create(reqBody);

            return res.created(null, global.config.message.CREATED);
        } catch (error) {
            log(error)
            return res.serverError(error)
        }
    },

    getList: async (req, res, next) => {
        try {
            const body = req.body;
            const pageObj = {
                page: parseInt(body.page) || 1,
                limit: parseInt(body.limit) || 10
            };

            const queryOption = utilService.getFilter(pageObj);
            queryOption.populate = { path: 'workspaceId', select: 'firmName' };
            queryOption.projection = { machineCode: 1, machineName: 1, workspaceId: 1, ip: 1, deviceType: 1, displayType: 1 };

            const searchQuery = {};
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

            const machines = await machineService.find(searchQuery, queryOption);
            const totalCount = await machineService.countDocuments(searchQuery);

            const result = {
                list: machines,
                totalCount
            };

            return res.ok(result, global.config.message.OK);
        } catch (error) {
            log(error)
            return res.serverError(error)
        }
    },

    getById: async (req, res, next) => {
        try {
            checkRequiredParams(['id'], req.params);
            const machine = await machineService.findOne({ _id: req.params.id });
            if (!machine) {
                throw global.config.message.RECORD_NOT_FOUND;
            }
            return res.ok(machine, global.config.message.OK);
        } catch (error) {
            log(error)
            return res.serverError(error)
        }
    },

    update: async (req, res, next) => {
        try {
            checkRequiredParams(['id'], req.params);
            const reqBody = req.body;
            if (Object.keys(reqBody).length === 0) {
                throw global.config.message.BAD_REQUEST;
            }

            const machineId = req.params.id;

            if (reqBody.machineCode || reqBody.ip) {
                checkRequiredParams(['workspaceId'], req.body);

                const existObj = { workspaceId: reqBody.workspaceId, $or: [] };
                if (reqBody.machineCode) {
                    existObj.$or.push({ machineCode: { $regex: reqBody.machineCode, $options: 'i' } });
                }
                if (reqBody.ip) {
                    existObj.$or.push({ ip: { $regex: reqBody.ip.replace(/\./g, '\\.'), $options: 'i' } });
                }

                const machineData = await machineService.findOne({ _id: { $ne: machineId }, ...existObj });
                if (machineData) {
                    throw global.config.message.IS_DUPLICATE;
                }
            }

            const result = await machineService.findByIdAndUpdate(machineId, reqBody, {
                projection: { machineCode: 1, machineName: 1, workspaceId: 1, ip: 1, deviceType: 1, displayType: 1 },
                populate: { path: 'workspaceId', select: 'firmName' }
            });
            if (!result) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            return res.ok(result, global.config.message.UPDATED);
        } catch (error) {
            log(error)
            return res.serverError(error)
        }
    },

    delete: async (req, res, next) => {
        try {
            checkRequiredParams(['id'], req.params);

            const result = await machineService.findByIdAndDelete(req.params.id);
            if (!result) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            return res.ok(result, global.config.message.OK);
        } catch (error) {
            log(error)
            return res.serverError(error)
        }
    }
}