const router = require('express').Router();

const auth = require('../../middleware/auth');
const requireAccess = require('../../middleware/requireAccess');
const controller = require('../../controllers/client/reportController');

const { MODULE_KEYS, ACTION_KEYS } = require('../../services/accessService');


router.post('/monthly-summary', auth, requireAccess(MODULE_KEYS.REPORT, ACTION_KEYS.READ), controller.getMonthlySummary);
router.post('/production-intelligence', auth, requireAccess(MODULE_KEYS.REPORT, ACTION_KEYS.READ), controller.getProductionIntelligence);
router.post('/', auth, requireAccess(MODULE_KEYS.REPORT, ACTION_KEYS.READ), controller.getReport);


module.exports = router;