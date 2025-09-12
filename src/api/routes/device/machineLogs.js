const router = require('express').Router();
const machineLogsController = require('../../controllers/device/machineLogsController');
const isAuth = require('../../middleware/auth');

router.post('/list', isAuth, machineLogsController.getList);


module.exports = router;