const router = require('express').Router();

const auth = require('../../middleware/auth');
const requireAccess = require('../../middleware/requireAccess');
const controller = require('../../controllers/client/userController');

const { MODULE_KEYS, ACTION_KEYS } = require('../../services/accessService');


// List is filtered to self for non-admins in the controller
router.get('/', auth, requireAccess(MODULE_KEYS.USER, ACTION_KEYS.READ), controller.getList);

router.get('/access-matrix', auth, requireAccess(MODULE_KEYS.USER, ACTION_KEYS.UPDATE), controller.getAccessMatrix);

router.post('/', auth, requireAccess(MODULE_KEYS.USER, ACTION_KEYS.CREATE), controller.create);

// Self-update allowed in controller; admin can update masters + access
router.put('/:id', auth, requireAccess(MODULE_KEYS.USER, ACTION_KEYS.UPDATE), controller.update);


module.exports = router;