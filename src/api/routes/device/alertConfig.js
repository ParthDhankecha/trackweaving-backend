const router = require('express').Router();

const auth = require('../../middleware/auth');
const controller = require('../../controllers/device/alertConfigController');


function requireOwner(req, res, next) {
    if (!req.user?.isOwner) {
        return res.forbidden(null, global.config.message.ACCESS_DENIED);
    }
    next();
}


router.get('/', auth, requireOwner, controller.getDetails);

router.put('/', auth, requireOwner, controller.upsertWorkspace);

router.put('/user/:userId', auth, requireOwner, controller.upsertUser);

router.delete('/user/:userId', auth, requireOwner, controller.deleteUserOverride);


module.exports = router;