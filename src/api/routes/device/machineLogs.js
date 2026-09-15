const router = require('express').Router();

const auth = require('../../middleware/auth');
const controller = require('../../controllers/device/machineLogsController');


router.post('/list', auth, controller.getList);

router.put('/beam-left', auth, controller.updateBeamLeft);


module.exports = router;