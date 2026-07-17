const router = require("express").Router();

const machineLogsController = require("../../controllers/client/machineLogsController");
const isAuth = require("../../middleware/auth");


router.post('/', machineLogsController.createLog);

router.post('/list', isAuth, machineLogsController.getList);

router.post('/qualities', isAuth, machineLogsController.getQualityList);

router.post('/machine-list', machineLogsController.getMachineList);

module.exports = router;