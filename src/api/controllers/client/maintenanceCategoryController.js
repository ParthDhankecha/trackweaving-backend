const maintenanceCategoryService = require('../../services/maintenanceCategoryService');
const machineService = require('../../services/machineService');
const utilService = require('../../services/utilService');
const { log } = require('../../services/utilService');

const toCategoryType = (name = '') => {
    const words = String(name)
        .trim()
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .split(/\s+/)
        .filter(Boolean);

    if (!words.length) return '';

    return words
        .map((word, index) => {
            const lower = word.toLowerCase();
            return index === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join('');
};

const buildUniqueCategoryType = async (workspaceId, name, excludeId = null) => {
    let baseType = toCategoryType(name);
    if (!baseType) {
        baseType = 'customCategory';
    }

    let categoryType = baseType;
    let suffix = 1;

    while (true) {
        const query = { workspaceId, categoryType, isDeleted: false };
        if (excludeId) {
            query._id = { $ne: excludeId };
        }

        const existing = await maintenanceCategoryModel.findOne(query).select('_id').lean();
        if (!existing) break;

        suffix += 1;
        categoryType = `${baseType}${suffix}`;
    }

    return categoryType;
};

const bootstrapMaintenanceData = async (workspaceId, category) => {
    const machines = await machineService.find(
        { workspaceId, isDeleted: false },
        { projection: '_id', useLean: true }
    );

    if (!machines.length) return;

    const now = new Date();
    const scheduleDays = Number(category.scheduleDays) || 0;
    const nextMaintenanceDate = new Date(now);
    nextMaintenanceDate.setDate(nextMaintenanceDate.getDate() + scheduleDays);

    const records = machines.map(machine => ({
        maintenanceCategoryId: category._id,
        workspaceId,
        machineId: machine._id,
        lastMaintenanceDate: now,
        nextMaintenanceDate,
        remarks: ''
    }));

    await maintenanceDataModel.insertMany(records);
};

module.exports = {
    getMaintenanceCategories: async (req, res, next) => {
        try {
            const workspaceId = req.user.workspaceId;
            const maintenanceCategories = await maintenanceCategoryService.find(
                { workspaceId },
                { sort: { createdAt: 1 } }
            );

            return res.ok(maintenanceCategories, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    createMaintenanceCategory: async (req, res, next) => {
        try {
            utilService.checkRequiredParams(['name', 'scheduleDays', 'alertDays'], req.body);

            const workspaceId = req.user.workspaceId;
            const name = String(req.body.name || '').trim();
            const scheduleDays = Number(req.body.scheduleDays);
            const alertDays = Number(req.body.alertDays);
            const alertMessage = String(req.body.alertMessage || '').trim();

            if (!name) {
                throw global.config.message.BAD_REQUEST;
            }
            if (!Number.isFinite(scheduleDays) || scheduleDays <= 0) {
                throw global.config.message.BAD_REQUEST;
            }
            if (!Number.isFinite(alertDays) || alertDays < 0) {
                throw global.config.message.BAD_REQUEST;
            }

            const existingCategory = await maintenanceCategoryModel.findOne({
                workspaceId,
                name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
                isDeleted: false
            }).lean();

            if (existingCategory) {
                return res.conflict(null, {
                    code: 'CONFLICT',
                    message: 'Maintenance category with this name already exists.'
                });
            }

            const categoryType = await buildUniqueCategoryType(workspaceId, name);
            const category = await maintenanceCategoryService.create({
                name,
                categoryType,
                scheduleDays,
                alertDays,
                alertMessage,
                workspaceId,
                isActive: req.body.isActive !== false
            });

            await bootstrapMaintenanceData(workspaceId, category);

            return res.created(category, global.config.message.CREATED);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    updateMaintenanceCategory: async (req, res, next) => {
        try {
            const categoryId = req.params.id;
            if (!categoryId) {
                throw global.config.message.BAD_REQUEST;
            }

            const workspaceId = req.user.workspaceId;
            const category = await maintenanceCategoryService.findOne({ _id: categoryId, workspaceId });
            if (!category) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            const updateData = {};
            const allowedFields = ['name', 'scheduleDays', 'alertDays', 'alertMessage', 'isActive'];

            allowedFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    updateData[field] = req.body[field];
                }
            });

            if (updateData.name !== undefined) {
                updateData.name = String(updateData.name).trim();
                if (!updateData.name) {
                    throw global.config.message.BAD_REQUEST;
                }

                const existingCategory = await maintenanceCategoryModel.findOne({
                    workspaceId,
                    _id: { $ne: categoryId },
                    name: { $regex: new RegExp(`^${updateData.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
                    isDeleted: false
                }).lean();

                if (existingCategory) {
                    return res.conflict(null, {
                        code: 'CONFLICT',
                        message: 'Maintenance category with this name already exists.'
                    });
                }
            }

            if (updateData.scheduleDays !== undefined) {
                updateData.scheduleDays = Number(updateData.scheduleDays);
                if (!Number.isFinite(updateData.scheduleDays) || updateData.scheduleDays <= 0) {
                    throw global.config.message.BAD_REQUEST;
                }
            }

            if (updateData.alertDays !== undefined) {
                updateData.alertDays = Number(updateData.alertDays);
                if (!Number.isFinite(updateData.alertDays) || updateData.alertDays < 0) {
                    throw global.config.message.BAD_REQUEST;
                }
            }

            if (updateData.alertMessage !== undefined) {
                updateData.alertMessage = String(updateData.alertMessage || '').trim();
            }

            const updatedCategory = await maintenanceCategoryService.findByIdAndUpdate(categoryId, updateData);
            if (!updatedCategory) {
                throw global.config.message.NOT_UPDATED;
            }

            return res.ok(updatedCategory, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    deleteMaintenanceCategory: async (req, res, next) => {
        try {
            const categoryId = req.params.id;
            if (!categoryId) {
                throw global.config.message.BAD_REQUEST;
            }

            const workspaceId = req.user.workspaceId;
            const category = await maintenanceCategoryService.findOne({ _id: categoryId, workspaceId });
            if (!category) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            const deletedCategory = await maintenanceCategoryService.findByIdAndDelete(categoryId);
            if (!deletedCategory) {
                throw global.config.message.NOT_DELETED;
            }

            return res.ok(deletedCategory, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    }
};
