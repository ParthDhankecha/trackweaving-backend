const router = require('express').Router();


router.use('/auth', require('./auth'));

router.use('/users', require('./users'));

router.use('/sync', require('./sync'));

router.use('/machine-logs', require('./machineLogs'));

router.use('/machine-group', require('./machineGroup'));


module.exports = router;