const router = require('express').Router();
const alertController = require('../../controllers/device/alertController');
const isAuth = require('../../middleware/auth');

router.get('/', isAuth, alertController.getAlertList);
router.put('/:id', isAuth, alertController.updateAlert);

module.exports = router;