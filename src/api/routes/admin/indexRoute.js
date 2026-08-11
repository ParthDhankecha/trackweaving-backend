const router = require('express').Router();


router.use('/auth', require('./auth'));

router.use('/config', require('./projectSetupConfig'));

router.use('/user', require('./user'));

router.use('/workspace', require('./workspace'));

router.use('/machine', require('./machine'));

router.use('/invoice', require('./invoice'));

router.use('/app-version', require('./appVersion'));

router.use('/lead', require('./lead'));

router.use('/manufacturer', require('./manufacturer'));

router.use('/manufacturer-user', require('./manufacturerUser'));

router.use('/alert-config', require('./alertConfig'));


module.exports = router;