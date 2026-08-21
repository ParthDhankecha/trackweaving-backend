const maintenanceCategoryService = require("../../services/maintenanceCategoryService");
const maintenanceDataService = require("../../services/maintenanceDataService");
const utilService = require("../../services/utilService");

const _projection = { updatedAt: 0, createdAt: 0, workspaceId: 0, isDeleted: 0 };


module.exports = {
    getList: async (req, res, next) => {
        try {
            const { workspaceId } = req.user;
            const list = await maintenanceCategoryService.find({ workspaceId },{
                projection: { ..._projection },
                sort: { createdAt: 1 },
                useLean: true
            });

            return res.ok(list, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    getOptionList: async (req, res, next) => {
        try {
            const { workspaceId } = req.user;
            const list = await maintenanceCategoryService.find(
                { workspaceId },
                { sort: { createdAt: 1 }, projection: 'name', useLean: true }
            );

            return res.ok(list, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    create: async (req, res, next) => {
        try {
            const body = req.body;
            utilService.checkRequiredParams(['name', 'scheduleDays', 'alertDays'], body);

            const mcNameObj = utilService.escapeRegex(body.name, { throwError: true });
            if (!mcNameObj?.normalized) {
                throw global.config.message.BAD_REQUEST;
            }
            const scheduleDays = Number(body.scheduleDays);
            if (!utilService.isNumber(scheduleDays, { min: 1 })) {
                throw global.config.message.BAD_REQUEST;
            }
            const alertDays = Number(body.alertDays);
            if (!utilService.isNumber(alertDays, { min: 0 })) {
                throw global.config.message.BAD_REQUEST;
            }

            const { workspaceId } = req.user;
            const duplicate = await maintenanceCategoryService.findOne({
                workspaceId,
                name: { $regex: `^${mcNameObj.escaped}$`, $options: 'i' }
            }, {
                useLean: true,
                projection: '_id'
            });
            if (duplicate) {
                throw global.config.message.DUPLICATE_MAINTENANCE_CATEGORY;
            }

            const category = await maintenanceCategoryService.create({
                name: mcNameObj.normalized,
                scheduleDays,
                alertDays,
                alertMessage: body.alertMessage?.trim?.() ?? '',
                workspaceId
            });

            await maintenanceCategoryService.bootstrapMaintenanceData(workspaceId, category);

            const data = category?.toObject?.() || category;
            Object.keys(_projection).forEach(key => {
                if (data?.hasOwnProperty?.(key)) delete data[key];
            });

            return res.created(data, global.config.message.CREATED);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    update: async (req, res, next) => {
        try {
            const mcId = req.params.id;
            if (!utilService.isValidObjectId(mcId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const updateObj = {}, body = req.body;

            let mcNameObj = null;
            if (body.hasOwnProperty('name')) {
                mcNameObj = utilService.escapeRegex(body.name, { throwError: true });
                if (!mcNameObj?.normalized) {
                    throw global.config.message.BAD_REQUEST;
                }
                updateObj.name = mcNameObj.normalized;
            }
            if (body.hasOwnProperty('scheduleDays')) {
                if (!utilService.isNumber(body.scheduleDays, { min: 1 })) {
                    throw global.config.message.BAD_REQUEST;
                }
                updateObj.scheduleDays = body.scheduleDays;
            }
            if (body.hasOwnProperty('alertDays')) {
                if (!utilService.isNumber(body.alertDays, { min: 0 })) {
                    throw global.config.message.BAD_REQUEST;
                }
                updateObj.alertDays = body.alertDays;
            }
            if (body.hasOwnProperty('alertMessage')) {
                updateObj.alertMessage = String(body.alertMessage || '').trim();
            }
            if (body.hasOwnProperty('isActive')) {
                if (typeof body.isActive !== 'boolean') {
                    throw global.config.message.BAD_REQUEST;
                }
                updateObj.isActive = body.isActive;
            }

            if (Object.keys(updateObj).length === 0) {
                throw global.config.message.BAD_REQUEST;
            }


            const { workspaceId } = req.user;
            if (updateObj?.name) {
                const duplicate = await maintenanceCategoryService.findOne({
                    workspaceId,
                    name: { $regex: `^${mcNameObj.escaped}$`, $options: 'i' },
                    _id: { $ne: mcId },
                }, {
                    useLean: true,
                    projection: '_id'
                });
                if (duplicate) throw global.config.message.DUPLICATE_MAINTENANCE_CATEGORY;
            }

            const entry = await maintenanceCategoryService.findOneAndUpdate({ _id: mcId, workspaceId }, updateObj, {
                useLean: true,
                projection: { ..._projection },
            });
            if (!entry) throw global.config.message.NOT_UPDATED;

            return res.ok(entry, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    delete: async (req, res, next) => {
        try {
            const mcId = req.params.id;
            if (!utilService.isValidObjectId(mcId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const { workspaceId } = req.user;
            const entry = await maintenanceCategoryService.findOneAndDelete({ _id: mcId, workspaceId }, {
                projection: { ..._projection },
                useLean: true,
            });
            if (!entry) throw global.config.message.NOT_DELETED;

            const status = await maintenanceDataService.deleteReferences(workspaceId, mcId);
            if (status) {
                console.log('Maintenance data deleted successfully', status);
            }

            return res.ok(entry, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    }
}