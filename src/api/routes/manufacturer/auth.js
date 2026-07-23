const router = require('express').Router();

const authController = require('../../controllers/manufacturer/authController');
const isAuth = require('../../middleware/manufacturerAuth');


router.post('/sign-in', authController.signIn);

router.get('/profile', isAuth, authController.getProfile);


module.exports = router;