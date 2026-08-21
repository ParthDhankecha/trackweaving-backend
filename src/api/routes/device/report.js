const router = require('express').Router();

const auth = require('../../middleware/auth');
const controller = require('../../controllers/device/reportController');


router.post('/', auth, controller.getReport);


module.exports = router;