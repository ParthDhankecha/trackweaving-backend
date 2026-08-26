const router = require('express').Router();

const auth = require('../../middleware/auth');
const requireAccess = require('../../middleware/requireAccess');
const controller = require('../../controllers/device/maintenanceCategoryController');

const { MODULE_KEYS, ACTION_KEYS } = require('../../services/accessService');


router.get('/', auth, requireAccess(MODULE_KEYS.MAINTENANCE_CATEGORY, ACTION_KEYS.READ), controller.getList);

// Shared dropdown helper
router.get('/option-list', auth, controller.getOptionList);

router.post('/', auth, requireAccess(MODULE_KEYS.MAINTENANCE_CATEGORY, ACTION_KEYS.CREATE), controller.create);

router.put('/:id', auth, requireAccess(MODULE_KEYS.MAINTENANCE_CATEGORY, ACTION_KEYS.UPDATE), controller.update);

router.delete('/:id', auth, requireAccess(MODULE_KEYS.MAINTENANCE_CATEGORY, ACTION_KEYS.DELETE), controller.delete);


module.exports = router;