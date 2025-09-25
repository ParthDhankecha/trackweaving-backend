const router = require('express').Router();


router.use('/auth', require('./auth'));

router.use('/user', require('./user'));

router.use('/machine-logs', require('./machineLogs'));

router.use('/machine-groups', require('./machineGroup'));

router.use('/machines', require('./machine'));

router.use('/maintenance-categories', require('./maintenanceCategory'));

router.use('/alerts', require('./alert'));

router.use('/shift-wise-comments', require('./shiftWiseComment'));

module.exports = router;