const router = require('express').Router();


router.use('/auth', require('./auth'));

router.use('/user', require('./user'));

router.use('/machine-logs', require('./machineLogs'));


module.exports = router;