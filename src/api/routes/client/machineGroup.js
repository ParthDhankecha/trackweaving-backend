const router = require('express').Router();
const machineGroupController = require('../../controllers/client/machineGroupController');
const isAuth = require('../../middleware/auth');


router.get('/', isAuth, machineGroupController.getMachineGroupsList);

router.get('/:id', isAuth, machineGroupController.getMachineGroupById);

router.post('/', isAuth, machineGroupController.createMachineGroup);

router.put('/:id', isAuth, machineGroupController.updateMachineGroup);


module.exports = router;