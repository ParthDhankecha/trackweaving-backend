const machineService = require("../../services/machineService");
const utilService = require("../../services/utilService");
const { log, checkRequiredParams } = require("../../services/utilService")



module.exports = {
    create: async (req, res, next) => {
        try {
            checkRequiredParams(['machineCode', 'machineName', 'workspaceId', 'ip'], req.body);
            const reqBody = req.body;

            const isMachineExist = await machineService.findOne({ $or: [{ machineCode: reqBody.machineCode }, { ip: reqBody.ip }], workspaceId: reqBody.workspaceId });
            if (isMachineExist) {
                throw global.config.message.IS_DUPLICATE;
            }
            const machine = await machineService.create(reqBody);

            return res.created(machine, global.config.message.CREATED);
        } catch (error) {
            log(error)
            return res.serverError(error)
        }
    },

    getList: async (req, res, next) => {
        try {
            const body = req.body || {};
            const pageObj = {
                page: parseInt(body.page) || 1,
                limit: parseInt(body.limit) || 10
            };

            const queryOption = utilService.getFilter(pageObj);
            queryOption.populate = { path: 'workspaceId', select: 'firmName' };
            queryOption.projection = 'machineCode machineName ip workspaceId';

            const searchQuery = {};
            if (body?.workspaceId) {
                searchQuery.workspaceId = { $in: body.workspaceId };
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
            const updateData = req.body;
            if (Object.keys(updateData).length === 0) {
                throw global.config.message.BAD_REQUEST;
            }

            if (updateData.machineCode || updateData.ip) {
                if (!updateData?.workspaceId) {
                    const machineData = await machineService.findOne({ _id: req.params.id }, { projection: 'workspaceId' });
                    if (!machineData) {
                        throw global.config.message.RECORD_NOT_FOUND;
                    }
                    updateData.workspaceId = machineData.workspaceId;
                }
                const existObj = { _id: { $ne: req.params.id }, workspaceId: updateData.workspaceId, $or: [] };
                if (updateData?.machineCode) {
                    existObj.$or.push({ machineCode: updateData.machineCode.trim() });
                }
                if (updateData?.ip) {
                    existObj.$or.push({ ip: updateData.ip.trim() });
                }

                const isMachineExist = await machineService.findOne({ ...existObj });
                if (isMachineExist) {
                    throw global.config.message.IS_DUPLICATE;
                }
            }

            const populate = { path: 'workspaceId', select: 'firmName' };
            const projection = 'machineCode machineName ip workspaceId';
            const result = await machineService.findOneAndUpdate({ _id: req.params.id }, updateData, { populate, projection });
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