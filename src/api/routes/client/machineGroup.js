const router = require('express').Router();

const auth = require('../../middleware/auth');
const controller = require('../../controllers/client/machineGroupController');


router.get('/', auth, controller.getMachineGroupsList);

router.get('/:id', auth, controller.getMachineGroupById);

router.post('/', auth, controller.createMachineGroup);

router.put('/:id', auth, controller.updateMachineGroup);


module.exports = router;