const router = require('express').Router();

const dashboardController = require('../../controllers/manufacturer/dashboardController');
const isAuth = require('../../middleware/manufacturerAuth');


router.get('/overview', isAuth, dashboardController.getOverview);

router.get('/workspace-options', isAuth, dashboardController.getWorkspaceOptions);

router.get('/machine-group-options/:workspaceId', isAuth, dashboardController.getMachineGroupOptions);

router.get('/machines/:workspaceId', isAuth, dashboardController.getMachines);

router.get('/qualities/:workspaceId', isAuth, dashboardController.getQualities);

router.post('/machine-log-list', isAuth, dashboardController.getMachineLogList);

router.post('/machine-list', isAuth, dashboardController.getMachineList);

router.post('/report', isAuth, dashboardController.getReport);

router.post('/analytics', isAuth, dashboardController.getAnalytics);


module.exports = router;