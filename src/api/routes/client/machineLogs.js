const router = require("express").Router();

const machineLogsController = require("../../controllers/client/machineLogsController");
const isAuth = require("../../middleware/auth");


router.get('/qualities', isAuth, machineLogsController.getQualityList);

router.post('/', machineLogsController.createLog);

router.post('/inovance', machineLogsController.createInovanceLog);

router.post('/list', isAuth, machineLogsController.getList);

router.post('/machine-list', machineLogsController.getMachineList);


module.exports = router;