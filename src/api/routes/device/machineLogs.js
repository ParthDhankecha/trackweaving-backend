const router = require('express').Router();

const auth = require('../../middleware/auth');
const controller = require('../../controllers/device/machineLogsController');


router.get('/qualities', auth, controller.getQualityList);

router.post('/list', auth, controller.getList);


module.exports = router;