const router = require('express').Router();
const machineLogsController = require('../../controllers/device/machineLogsController');
const isAuth = require('../../middleware/auth');


router.get('/qualities', isAuth, machineLogsController.getQualityList);

router.post('/list', isAuth, machineLogsController.getList);


module.exports = router;