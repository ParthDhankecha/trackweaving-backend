const router = require('express').Router();

const auth = require('../../middleware/manufacturerAuth');
const controller = require('../../controllers/manufacturer/dashboardController');


router.get('/overview', auth, controller.getOverview);

router.get('/workspace-options', auth, controller.getWorkspaceOptions);

router.get('/machine-group-options/:workspaceId', auth, controller.getMachineGroupOptions);

router.get('/machines/:workspaceId', auth, controller.getMachines);

router.get('/qualities/:workspaceId', auth, controller.getQualities);

router.post('/machine-log-list', auth, controller.getMachineLogList);

router.post('/report', auth, controller.getReport);

router.post('/analytics', auth, controller.getAnalytics);


module.exports = router;