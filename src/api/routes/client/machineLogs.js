const router = require("express").Router();

const machineLogsController = require("../../controllers/client/machineLogsController");


router.post('/', machineLogsController.createLog);


module.exports = router;