const router = require('express').Router();

const auth = require('../../middleware/auth');
const requireAccess = require('../../middleware/requireAccess');
const controller = require('../../controllers/device/alertController');

const { MODULE_KEYS, ACTION_KEYS } = require('../../services/accessService');


router.get('/', auth, requireAccess(MODULE_KEYS.MAINTENANCE_ENTRY, ACTION_KEYS.READ), controller.getAlertList);

router.post('/history', auth, requireAccess(MODULE_KEYS.MAINTENANCE_HISTORY, ACTION_KEYS.READ), controller.getMaintenanceHistory);

router.put('/:id', auth, requireAccess(MODULE_KEYS.MAINTENANCE_ENTRY, ACTION_KEYS.UPDATE), controller.updateAlert);


module.exports = router;