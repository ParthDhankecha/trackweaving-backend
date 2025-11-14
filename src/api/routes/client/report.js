const router = require('express').Router();
const reportController = require('../../controllers/client/reportController');
const isAuth = require('../../middleware/auth');


router.post('/', isAuth, reportController.getReport);


module.exports = router;