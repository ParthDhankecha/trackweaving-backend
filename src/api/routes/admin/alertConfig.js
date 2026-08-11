const router = require('express').Router();

const auth = require('../../middleware/adminAuth');
const controller = require('../../controllers/admin/alertConfigController');


router.get('/workspace/:workspaceId', auth, controller.getByWorkspace);

router.put('/workspace/:workspaceId', auth, controller.upsertWorkspace);

router.put('/user/:userId', auth, controller.upsertUser);

router.delete('/user/:userId', auth, controller.deleteUserOverride);


module.exports = router;