const router = require('express').Router();
const maintenanceCategoryController = require('../../controllers/client/maintenanceCategoryController');
const isAuth = require('../../middleware/auth');


router.get('/', isAuth, maintenanceCategoryController.getMaintenanceCategories);

router.post('/', isAuth, maintenanceCategoryController.createMaintenanceCategory);

router.put('/:id', isAuth, maintenanceCategoryController.updateMaintenanceCategory);

router.delete('/:id', isAuth, maintenanceCategoryController.deleteMaintenanceCategory);


module.exports = router;