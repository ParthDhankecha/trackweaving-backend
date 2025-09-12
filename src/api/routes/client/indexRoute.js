const router = require('express').Router();


router.use('/auth', require('./auth'));

router.use('/users', require('./users'));

router.use('/sync', require('./sync'));

router.use('/machine-logs', require('./machineLogs'));


module.exports = router;