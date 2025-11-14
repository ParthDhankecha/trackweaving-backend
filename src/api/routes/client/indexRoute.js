const router = require('express').Router();


router.use('/auth', require('./auth'));

router.use('/users', require('./users'));

router.use('/sync', require('./sync'));

router.use('/machine-logs', require('./machineLogs'));

router.use('/machine-group', require('./machineGroup'));

router.use('/machines', require('./machine'));

router.use('/maintenance-categories', require('./maintenanceCategory'));

router.use('/alerts', require('./alert'));

router.use('/shift-wise-comments', require('./shiftWiseComment'));

router.use('/reports', require('./report'));

router.use('/part-change-logs', require('./partChangeLog'));


module.exports = router;