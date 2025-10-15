const authService = require('../../services/authService');
const jwtService = require('../../services/jwtService');
const usersService = require('../../services/usersService');
const workspaceService = require('../../services/workspaceService');
const { log, checkRequiredParams } = require('../../services/utilService');


module.exports = {
    async emailVerification(req, res, next) {
        try {
            checkRequiredParams(['verificationToken'], req.params);

            const token = req.params.verificationToken;
            await authService.verifyEmailVerificationToken(token);

            return res.ok(null, global.config.message.EMAIL_VERIFIED);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    },

    async signInWithMobile(req, res, next) {
        try {
            const reqBody = req.body;
            checkRequiredParams(['mobile'], reqBody);

            await authService.verifyMobileUserAndSendOTP(reqBody.mobile, true);

            return res.ok(null, global.config.message.MOBILE_OTP_SENT);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    },

    async verifyMobileOTP(req, res, next) {
        try {
            const reqBody = req.body;
            checkRequiredParams(['mobile', 'otp'], reqBody);

            const userDetails = await authService.verifyMobileOTP(reqBody.mobile, reqBody.otp);
            if (!userDetails) {
                return res.notFound(null, global.config.message.USER_NOT_FOUND);
            }

            const token = jwtService.createToken(userDetails);
            const payload = {
                token: token,
                user: {
                    _id: userDetails._id,
                    type: userDetails.userType
                }
            };

            return res.ok(payload, global.config.message.MOBILE_OTP_VERIFIED);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    },

    async signIn(req, res, next) {
        try {
            const reqBody = req.body;
            checkRequiredParams(['userName', 'password'], reqBody);

            const userData = await authService.verifyingUser(reqBody.userName, reqBody.password);

            const token = jwtService.createToken(userData, 0);
            const workspace = await workspaceService.findOne({ _id: userData.workspaceId });
            if (!workspace) {
                throw global.config.message.BAD_REQUEST;
            }
            const payload = {
                token: token,
                user: {
                    _id: userData._id,
                    type: userData.userType,
                    email: userData.email,
                    userId: workspace.uid
                }
            };

            return res.ok(payload, global.config.message.LOGIN);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    },

    async signUp(req, res, next) {
        try {
            const reqBody = req.body;
            checkRequiredParams(['email', 'password'], reqBody);

            const existingUser = await usersService.findOneV2({ 'email': reqBody.email });
            if (existingUser) {
                throw global.config.message.EMAIL_ALREADY_REGISTERED;
            }

            reqBody.emailVerification = {};
            const userData = await authService.createUser(reqBody);
            if (!userData) {
                throw global.config.message.USER_REGISTER_FAILED;
            }

            // /** comment if not required auto login after register and remove 'payload' object from response */
            // const token = jwtService.createToken(userData);
            // const payload = {
            //     token: token,
            //     user: {
            //         _id: userData._id,
            //         type: userData.userType,
            //         email: userData.email
            //     }
            // };

            // await authService.welcomeUserMail(userData.email);
            /** comment, if account verification not required */
            await authService.sendVerificationMail(userData, 'verify');

            return res.created(null, global.config.message.USER_REGISTERED);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    },

    async forgotPassword(req, res, next) {
        try {
            const reqBody = req.body;
            checkRequiredParams(['email'], reqBody);

            const userDetails = await usersService.findOneV2({ email: reqBody.email });
            if (!userDetails) {
                return res.notFound(null, global.config.message.EMAIL_NOT_FOUND);
            }

            await authService.sendVerificationMail(userDetails, 'forgot');

            return res.ok(null, global.config.message.RESET_PASSWORD_EMAIL_SENT);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    },

    async resetPassword(req, res, next) {
        try {
            const reqBody = req.body;
            checkRequiredParams(['token', 'password'], reqBody);
            await authService.verifyTokenAndResetPassword(reqBody);

            return res.ok(null, global.config.message.RESET_PASSWORD_SUCCESS);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    },
}