const router = require('express').Router();
const alertController = require('../../controllers/client/alertController');
const isAuth = require('../../middleware/auth');


router.get('/', isAuth, alertController.getAlertList);

router.get('/history', isAuth, alertController.getMaintenanceHistory);

router.put('/:id', isAuth, alertController.updateAlert);


module.exports = router;