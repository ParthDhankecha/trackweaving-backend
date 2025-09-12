const router = require('express').Router();
const authController = require('../../controllers/admin/authController');


router.post('/sign-in', authController.signIn);


module.exports = router;