const router = require("express").Router();

const machineLogsController = require("../../controllers/client/machineLogsController");


router.post('/', machineLogsController.create);


module.exports = router;