const maintenanceCategoryService = require('../../services/maintenanceCategoryService');
const { log } = require('../../services/utilService');


module.exports = {
    getMaintenanceCategories: async (req, res, next) => {
        try {
            const workspaceId = req.user.workspaceId;
            const maintenanceCategories = await maintenanceCategoryService.find({ workspaceId: workspaceId });

            return res.ok(maintenanceCategories, global.config.message.OK);
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
            const category = await maintenanceCategoryService.findOne({ _id: categoryId, workspaceId: workspaceId });
            if (!category) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            const updateData = req.body;
            delete updateData._id; // Prevent updating the _id field
            delete updateData.createdBy; // Prevent updating the createdBy field
            delete updateData.workspaceId; // Prevent updating the workspaceId field
            delete updateData.isDeleted; // Prevent updating the isDeleted field

            const updatedCategory = await maintenanceCategoryService.findByIdAndUpdate(categoryId, updateData);
            if (!updatedCategory) {
                throw global.config.message.NOT_UPDATED;
            }

            return res.ok(updatedCategory, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    }
}