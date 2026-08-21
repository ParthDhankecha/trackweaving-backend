const router = require('express').Router();

const auth = require('../../middleware/auth');
const controller = require('../../controllers/device/machineGroupController');


// Shared dropdown helper — auth only (used by reports, users, etc.)
router.get('/', auth, controller.getMachineGroupsList);

router.get('/:id', auth, controller.getMachineGroupById);

router.post('/', auth, controller.createMachineGroup);

router.put('/:id', auth, controller.updateMachineGroup);


module.exports = router;