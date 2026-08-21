const router = require('express').Router();

const auth = require('../../middleware/auth');
const requireAccess = require('../../middleware/requireAccess');
const controller = require('../../controllers/client/partChangeLogController');

const { MODULE_KEYS, ACTION_KEYS } = require('../../services/accessService');


router.get('/parts-list', auth, requireAccess(MODULE_KEYS.PART_CHANGE_ENTRY, ACTION_KEYS.READ), controller.partsList);

router.post('/list', auth, requireAccess(MODULE_KEYS.PART_CHANGE_ENTRY, ACTION_KEYS.READ), controller.list);

router.post('/', auth, requireAccess(MODULE_KEYS.PART_CHANGE_ENTRY, ACTION_KEYS.CREATE), controller.create);

router.put('/:id', auth, requireAccess(MODULE_KEYS.PART_CHANGE_ENTRY, ACTION_KEYS.UPDATE), controller.update);

router.delete('/:id', auth, requireAccess(MODULE_KEYS.PART_CHANGE_ENTRY, ACTION_KEYS.DELETE), controller.delete);


module.exports = router;