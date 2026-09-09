const router = require('express').Router();

const auth = require('../../middleware/auth');
const controller = require('../../controllers/device/notificationController');


router.post('/', auth, controller.getList);

router.put('/mark-as-read', auth, controller.readNotification);

router.get('/unread-count', auth, controller.unreadCount);

router.post('/test', auth, controller.testNotification);


module.exports = router;