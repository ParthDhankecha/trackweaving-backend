const router = require('express').Router();


router.use('/auth', require('./auth'));

router.use('/user', require('./user'));

router.use('/sync', require('./sync'));

router.use('/machine-logs', require('./machineLogs'));

router.use('/machine-group', require('./machineGroup'));

router.use('/machines', require('./machine'));

router.use('/maintenance-categories', require('./maintenanceCategory'));

router.use('/maintenance-entry', require('./maintenanceEntry'));

router.use('/reports', require('./report'));

router.use('/part-change-logs', require('./partChangeLog'));

router.use('/alert-config', require('./alertConfig'));

router.use('/operators', require('./operator'));


module.exports = router;