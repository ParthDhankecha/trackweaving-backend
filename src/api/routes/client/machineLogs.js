const router = require("express").Router();

const machineLogsController = require("../../controllers/client/machineLogsController");


router.post('/', machineLogsController.createLog);

router.post('/machine-list', machineLogsController.getMachineList);

module.exports = router;