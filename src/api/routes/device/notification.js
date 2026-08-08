const router = require('express').Router();
const notificationController = require('../../controllers/device/notificationController');

const auth = require('../../middleware/auth');


router.post('/', auth, notificationController.getList);

router.post('/list', auth, notificationController.getNotifications);

router.put('/mark-as-read', auth, notificationController.readNotification);

router.get('/unread-count', auth, notificationController.unreadCount);

router.post('/test', auth, notificationController.testNotification);


module.exports = router;