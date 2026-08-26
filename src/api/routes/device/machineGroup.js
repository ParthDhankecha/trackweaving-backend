const router = require('express').Router();

const auth = require('../../middleware/auth');
const requireAccess = require('../../middleware/requireAccess');
const controller = require('../../controllers/device/machineGroupController');

const { MODULE_KEYS, ACTION_KEYS } = require('../../services/accessService');


// Shared dropdown helper — auth only (used by reports, users, etc.)
router.get('/', auth, controller.getMachineGroupsList);

router.get('/:id', auth, requireAccess(MODULE_KEYS.MACHINE_GROUP, ACTION_KEYS.READ), controller.getMachineGroupById);

router.post('/', auth, requireAccess(MODULE_KEYS.MACHINE_GROUP, ACTION_KEYS.CREATE), controller.createMachineGroup);

router.put('/:id', auth, requireAccess(MODULE_KEYS.MACHINE_GROUP, ACTION_KEYS.UPDATE), controller.updateMachineGroup);


module.exports = router;