const router = require('express').Router();


router.use('/auth', require('./auth'));

router.use('/user', require('./user'));

router.use('/machine-logs', require('./machineLogs'));

router.use('/machine-groups', require('./machineGroup'));

router.use('/machines', require('./machine'));

router.use('/maintenance-categories', require('./maintenanceCategory'));

router.use('/alerts', require('./alert'));

// TODO: remove this route after `new APP` release
router.use('/shift-wise-comments', require('./shiftWiseComment'));

router.use('/reports', require('./report'));

router.use('/part-change-logs', require('./partChangeLog'));

router.use('/notifications', require('./notification'));

router.use('*', (req, res) => res.notFound());


module.exports = router;