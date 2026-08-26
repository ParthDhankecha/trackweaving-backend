const router = require('express').Router();

const auth = require('../../middleware/auth');
const requireAccess = require('../../middleware/requireAccess');
const controller = require('../../controllers/device/reportController');

const { MODULE_KEYS, ACTION_KEYS } = require('../../services/accessService');


router.post('/', auth, requireAccess(MODULE_KEYS.REPORT, ACTION_KEYS.READ), controller.getReport);


module.exports = router;