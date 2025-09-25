const router = require('express').Router();


router.use('/v1', require('./client/indexRoute'));

router.use('/v1/device', require('./device/indexRoute'));

router.use('/v1/admin', require('./admin/indexRoute'));


module.exports = router;