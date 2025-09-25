const router = require('express').Router();
const maintenanceCategoryController = require('../../controllers/device/maintenanceCategoryController');
const isAuth = require('../../middleware/auth');

router.get('/', isAuth, maintenanceCategoryController.getMaintenanceCategories);
router.put('/:id', isAuth, maintenanceCategoryController.updateMaintenanceCategory);

module.exports = router;