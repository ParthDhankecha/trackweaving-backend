const router = require('express').Router();

const controller = require('../../controllers/device/authController');


// router.get('/email-verification/:verificationToken', controller.emailVerification);

// router.post('/sign-in-with-mobile', controller.signInWithMobile);

// router.post('/verify-mobile-otp', controller.verifyMobileOTP);

router.post('/sign-in', controller.signIn);

// router.post('/sign-up', controller.signUp);

// router.post('/forgot-password', controller.forgotPassword);

// router.post('/reset-password', controller.resetPassword);


module.exports = router;