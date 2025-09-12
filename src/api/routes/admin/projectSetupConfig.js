const router = require("express").Router();

const authMiddleware = require('../../middleware/auth');
const controller = require('../../controllers/admin/projectSetupConfigController');


router.get('/project', authMiddleware, controller.getProjectConfig);

router.get('/setup', authMiddleware, controller.getSetupConfig);

router.put('/project', authMiddleware, controller.updateProjectConfig);

router.put('/setup', authMiddleware, controller.updateSetupConfig);


module.exports = router;