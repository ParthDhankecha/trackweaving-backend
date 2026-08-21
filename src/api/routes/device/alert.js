const router = require('express').Router();

const auth = require('../../middleware/auth');
const controller = require('../../controllers/device/alertController');


router.get('/', auth, controller.getAlertList);

router.post('/history', auth, controller.getMaintenanceHistory);

router.put('/:id', auth, controller.updateAlert);


module.exports = router;