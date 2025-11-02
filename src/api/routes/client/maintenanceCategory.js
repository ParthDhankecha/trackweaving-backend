const router = require('express').Router();
const maintenanceCategoryController = require('../../controllers/client/maintenanceCategoryController');
const isAuth = require('../../middleware/auth');


router.get('/', isAuth, maintenanceCategoryController.getMaintenanceCategories);

router.put('/:id', isAuth, maintenanceCategoryController.updateMaintenanceCategory);


module.exports = router;