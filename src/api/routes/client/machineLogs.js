const router = require("express").Router();

const auth = require("../../middleware/auth");
const controller = require("../../controllers/client/machineLogsController");


router.get('/qualities', auth, controller.getQualityList);

router.post('/', controller.createLog);

router.post('/shift', controller.createShiftLogs);

router.post('/list', auth, controller.getList);

router.post('/details', auth, controller.getFullDetails);

router.put('/beam-left', auth, controller.updateBeamLeft);

router.post('/machine-list', controller.getMachineList);


module.exports = router;