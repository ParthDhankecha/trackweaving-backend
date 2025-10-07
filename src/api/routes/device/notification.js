const router = require('express').Router();
const notificationController = require('../../controllers/device/notificationController');
const isAuth = require('../../middleware/auth');

router.post('/list', isAuth, notificationController.getNotifications);
router.put('/mark-as-read', isAuth, notificationController.readNotification);
router.get('/unread-count', isAuth, notificationController.unreadCount);

module.exports = router;