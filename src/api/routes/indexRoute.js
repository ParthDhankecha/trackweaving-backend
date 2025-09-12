const router = require('express').Router();


router.use('/', require('./client/indexRoute'));

router.use('/device', require('./device/indexRoute'));

router.use('/admin', require('./admin/indexRoute'));


module.exports = router;