const maintenanceCategoryService = require("../../services/maintenanceCategoryService");
const { log } = require("../../services/utilService");


module.exports = {
    create: async (req, res, next) => {
        try {
            let maintenanceCategories = await maintenanceCategoryService.find({ workspaceId: req.user.workspaceId });

            return res.ok(maintenanceCategories, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    updateMaintenanceCategory: async (req, res, next) => {
        try {
            const categoryId = req.params.id;
            const updateData = req.body;

            const category = await maintenanceCategoryService.findOne({ _id: categoryId, workspaceId: req.user.workspaceId });
            if (!category) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            delete updateData._id; // Prevent updating the _id field
            delete updateData.createdBy; // Prevent updating the createdBy field
            delete updateData.workspaceId; // Prevent updating the workspaceId field
            delete updateData.isDeleted; // Prevent updating the isDeleted field

            const updatedCategory = await maintenanceCategoryService.findByIdAndUpdate(categoryId, updateData);

            return res.ok(updatedCategory, global.config.message.UPDATED);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    }
}