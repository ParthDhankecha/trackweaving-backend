const router = require('express').Router();

const alertConfigController = require('../../controllers/admin/alertConfigController');
const isAuth = require('../../middleware/auth');


router.get('/workspace/:workspaceId', isAuth, alertConfigController.getByWorkspace);

router.put('/workspace/:workspaceId', isAuth, alertConfigController.upsertWorkspace);

router.put('/user/:userId', isAuth, alertConfigController.upsertUser);

router.delete('/user/:userId', isAuth, alertConfigController.deleteUserOverride);


module.exports = router;