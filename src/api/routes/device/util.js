const router = require('express').Router();

const auth = require('../../middleware/auth');
const controller = require('../../controllers/device/utilController');


router.get('/app-version', controller.getAppVersion);

router.get('/config', auth, controller.getConfig);


module.exports = router;