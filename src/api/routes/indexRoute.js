const router = require('express').Router();


router.use('/v1', require('./client/indexRoute'));

router.use('/v1/device', require('./device/indexRoute'));

router.use('/v1/admin', require('./admin/indexRoute'));

router.use('/v1/manufacturer', require('./manufacturer/indexRoute'));


module.exports = router;