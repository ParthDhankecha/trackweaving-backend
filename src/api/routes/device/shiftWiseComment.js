const router = require('express').Router();
const shiftWiseCommentController = require('../../controllers/device/shiftWiseCommentController');
const isAuth = require('../../middleware/auth');

router.post('/list', isAuth, shiftWiseCommentController.getShiftWiseComments);
router.put('/', isAuth, shiftWiseCommentController.updateShiftWiseComment);

module.exports = router;