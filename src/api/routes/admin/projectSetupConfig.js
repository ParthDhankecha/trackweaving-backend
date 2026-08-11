const router = require("express").Router();

const auth = require('../../middleware/adminAuth');
const controller = require('../../controllers/admin/projectSetupConfigController');


router.get('/project', auth, controller.getProjectConfig);

router.get('/setup', auth, controller.getSetupConfig);

router.put('/project', auth, controller.updateProjectConfig);

router.put('/setup', auth, controller.updateSetupConfig);


module.exports = router;