const router = require('express').Router();

const auth = require('../../middleware/auth');
const requireAccess = require('../../middleware/requireAccess');
const controller = require('../../controllers/device/operatorController');

const { MODULE_KEYS, ACTION_KEYS } = require('../../services/accessService');


router.post('/list', auth, requireAccess(MODULE_KEYS.OPERATOR, ACTION_KEYS.READ), controller.getList);

router.post('/', auth, requireAccess(MODULE_KEYS.OPERATOR, ACTION_KEYS.CREATE), controller.create);

router.put('/:id', auth, requireAccess(MODULE_KEYS.OPERATOR, ACTION_KEYS.UPDATE), controller.update);

router.delete('/:id', auth, requireAccess(MODULE_KEYS.OPERATOR, ACTION_KEYS.DELETE), controller.delete);


module.exports = router;