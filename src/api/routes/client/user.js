const router = require('express').Router();

const auth = require('../../middleware/auth');
const requireAccess = require('../../middleware/requireAccess');
const controller = require('../../controllers/client/userController');

const { MODULE_KEYS, ACTION_KEYS } = require('../../services/accessService');


router.get('/', auth, requireAccess(MODULE_KEYS.USER, ACTION_KEYS.READ), controller.getList);

router.get('/access-matrix', auth, requireAccess(MODULE_KEYS.USER, ACTION_KEYS.UPDATE), controller.getAccessMatrix);

router.post('/', auth, requireAccess(MODULE_KEYS.USER, ACTION_KEYS.CREATE), controller.create);

router.put('/:id', auth, requireAccess(MODULE_KEYS.USER, ACTION_KEYS.UPDATE), controller.update);

router.delete('/:id', auth, requireAccess(MODULE_KEYS.USER, ACTION_KEYS.UPDATE), controller.delete);


module.exports = router;