const router = require('express').Router();
const machineGroupController = require('../../controllers/device/machineGroupController');
const isAuth = require('../../middleware/auth');

router.post('/', isAuth, machineGroupController.createMachineGroup);
router.get('/', isAuth, machineGroupController.getMachineGroupsList);
router.get('/:id', isAuth, machineGroupController.getMachineGroupById);
router.put('/:id', isAuth, machineGroupController.updateMachineGroup);

module.exports = router;