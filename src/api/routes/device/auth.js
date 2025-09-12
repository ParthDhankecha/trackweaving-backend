const router = require('express').Router();
const authController = require('../../controllers/device/authController');


// router.get('/email-verification/:verificationToken', authController.emailVerification);

// router.post('/sign-in-with-mobile', authController.signInWithMobile);

// router.post('/verify-mobile-otp', authController.verifyMobileOTP);

router.post('/sign-in', authController.signIn);

// router.post('/sign-up', authController.signUp);

// router.post('/forgot-password', authController.forgotPassword);

// router.post('/reset-password', authController.resetPassword);


module.exports = router;