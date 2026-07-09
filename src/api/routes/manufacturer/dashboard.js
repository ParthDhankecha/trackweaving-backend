const router = require('express').Router();

const dashboardController = require('../../controllers/manufacturer/dashboardController');
const isAuth = require('../../middleware/manufacturerAuth');

router.get('/overview', isAuth, dashboardController.getOverview);

router.post('/machine-list', isAuth, dashboardController.getMachineList);

router.post('/analytics', isAuth, dashboardController.getAnalytics);

router.get('/workspace-options', isAuth, dashboardController.getWorkspaceOptions);


module.exports = router;
