const router = require('express').Router();


router.use('/auth', require('./auth'));

router.use('/config', require('./projectSetupConfig'));

router.use('/user', require('./user'));

router.use('/workspace', require('./workspace'));

router.use('/machine', require('./machine'));

router.use('/invoice', require('./invoice'));

router.use('/app-version', require('./appVersion'));

module.exports = router;