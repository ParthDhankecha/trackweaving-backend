const router = require('express').Router();

const auth = require('../../middleware/auth');
const controller = require('../../controllers/device/shiftWiseCommentController');


router.post('/list', auth, controller.getShiftWiseComments);

router.put('/', auth, controller.updateShiftWiseComment);


module.exports = router;