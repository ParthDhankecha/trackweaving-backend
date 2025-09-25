const router = require('express').Router();
const machineController = require('../../controllers/device/machineController');
const isAuth = require('../../middleware/auth');

router.get('/', isAuth, machineController.getMachineList);
router.put('/:id', isAuth, machineController.updateMachine);

module.exports = router;