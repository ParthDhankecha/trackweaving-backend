const router = require('express').Router();

const auth = require('../../middleware/auth');
const requireAccess = require('../../middleware/requireAccess');
const controller = require('../../controllers/device/machineController');

const { MODULE_KEYS, ACTION_KEYS } = require('../../services/accessService');


router.get('/', auth, requireAccess(MODULE_KEYS.MACHINE_CONFIGURE, ACTION_KEYS.READ), controller.getMachineList);

// Shared dropdown helper
router.get('/option-list', auth, controller.optionList);

router.put('/:id', auth, requireAccess(MODULE_KEYS.MACHINE_CONFIGURE, ACTION_KEYS.UPDATE), controller.updateMachine);


module.exports = router;