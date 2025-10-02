const CryptoJS = require('crypto-js');
const { hash, compare } = require('bcrypt');
const moment = require('moment');

const emailService = require('./emailService');
const utilService = require('./utilService');
const { masterOTP: _masterOTP } = require('../../config/env-vars');



module.exports = {
    async compareHashPassword(password, passwordHash) {
        return await compare(password, passwordHash);
    },

    async decryptData(body) {
        const bytes = CryptoJS.AES.decrypt(body.data, body.date);
        if (bytes.toString()) {
            return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        }
        return body;
    },

    async encryptData(data, encodeKey) {
        return CryptoJS.AES.encrypt(JSON.stringify(data), encodeKey).toString();
    },


    async createUser(data) {
        if (data.password) {
            data.password = await utilService.generateHashValue(data.password);
        }

        const createdUser = new userModel(data);
        return await createdUser.save();
    },

    async welcomeUserMail(email) {
        await emailService.send({
            subject: 'Account was created successfully',
            html: 'welcomeUser',
            to: email,
            data: {}
        });
    },

    /**
     * Sends a verification email to the user.
     * @param {Object} userData - User data containing email and verification details
     * @param {'verify' | 'forgot'} [emailType='verify'] - Type of email to send (default is 'verify')
     * @return {Promise<boolean>} - Returns true if the email was sent successfully
     * @throws {Error} - Throws an error if the user verification details could not be updated
     */
    async sendVerificationMail(userData, emailType = 'verify') {
        if (emailType === 'verify' && userData?.isEmailVerified) {
            throw global.config.message.EMAIL_ALREADY_VERIFIED;
        }

        let verificationToken = await utilService.generateHashValue(userData._id?.toString());
        verificationToken = `${verificationToken.replace(/[^a-zA-Z ]/g, '')}${userData._id}`;

        /** update user verification details */
        userData.emailVerification = {
            token: verificationToken,
            expiresAt: moment().add(1, 'hours').toDate()
        };
        await userData.save();

        /** sending verification mail */
        if (emailType === 'verify') {
            await emailService.send({
                subject: 'Verify your email',
                html: 'verifyEmail',
                to: userData.email,
                data: {
                    email: userData.email,
                    link: '/auth/email-verification/' + verificationToken
                }
            });
        } else if (emailType === 'forgot') {
            await emailService.send({
                subject: 'Reset Password',
                html: 'resetPassword',
                to: userData.email,
                data: {
                    email: userData.email,
                    link: '/auth/reset-password/' + verificationToken
                }
            });
        }

        return true;
    },

    async verifyEmailVerificationToken(token, throwError = true) {
        try {
            const userData = await userModel.findOne({ isDeleted: false, 'emailVerification.token': token }, '+emailVerification +isEmailVerified');
            if (!userData) throw global.config.message.INVALID_TOKEN;

            if (userData && userData?.isEmailVerified) {
                throw global.config.message.EMAIL_ALREADY_VERIFIED;
            }

            const isVerificationExpired = moment().isAfter(userData.emailVerification.expiresAt);
            if (isVerificationExpired) {
                throw global.config.message.VERIFICATION_TOKEN_EXPIRED;
            }

            userData.emailVerification = null; // Clear verification details
            userData.isEmailVerified = true; // Mark as verified
            await userData.save();

            if (!userData.isEmailVerified) {
                throw global.config.message.VERIFICATION_FAILED;
            }

            return userData;
        } catch (error) {
            if (throwError) { throw error; }
            else {
                console.log('Error in verifyEmailVerificationToken:', error);
            }
        }
    },

    /**
     * Verifies user credentials and returns user data if valid.
     * @param {string} userName - User's mobile number
     * @param {string} planePassword - User's plain text password
     * @param {boolean} throwError - Whether to throw an error if verification fails
     * @return {Promise<Object>} - Returns user data if credentials are valid, otherwise throws an error or returns an error object
     * @throws {Error} - Throws an error if user not found, email not verified, or invalid credentials
     * */
    async verifyingUser(userName, planePassword, throwError = true) {
        const errorObj = {
            notFound: false,
            invalidCredentials: false
        };

        const user = await userModel.findOne({ 'userName': { $regex: `^${userName}$`, $options: 'i' }, isDeleted: false }, '+password +userType').lean();
        if (!user) {
            errorObj.notFound = true;
            if (throwError) throw global.config.message.MOBILE_NOT_FOUND;
            return errorObj; // return early if not found
        };

        const isMatch = await compare(planePassword, user.password);
        if (!isMatch) {
            errorObj.invalidCredentials = true;
            if (throwError) throw global.config.message.INVALID_CREDENTIALS;
            return errorObj; // return early if credentials are invalid
        }

        const { password, ...result } = user;

        return result;
    },

    async verifyTokenAndResetPassword(body) {
        const userData = await userModel.findOne({ isDeleted: false, 'emailVerification.token': body.token }, '+emailVerification +isEmailVerified');
        if (!userData) throw global.config.message.RESET_PASSWORD_LINK_INVALID;

        // if (user && user?.isEmailVerified) throw global.config.message.EMAIL_ALREADY_VERIFIED;

        const isVerificationExpired = moment().isAfter(userData.emailVerification?.expiresAt);
        if (!userData?.emailVerification?.expiresAt || isVerificationExpired) {
            throw global.config.message.RESET_PASSWORD_LINK_EXPIRED;
        }

        userData.password = await utilService.generateHashValue(body.password);
        userData.emailVerification = null; // Clear verification details
        userData.isEmailVerified = true; // Mark as verified after password reset
        await userData.save();

        if (!userData.isEmailVerified) {
            throw global.config.message.VERIFICATION_FAILED;
        }
    },


    async verifyMobileUserAndSendOTP(mobile, throwError = true) {
        try {
            const OTP = utilService.generateOTP(6);
            const otpPayload = {
                mobileOTP: {
                    code: OTP,
                    expiresAt: moment().add(15, 'minutes').toDate()
                }
            };

            let userData = await userModel.findOneAndUpdate({ mobile: mobile, isDeleted: false }, {
                $set: otpPayload
            }, { new: true, projection: '+mobileOTP +isMobileVerified' }).lean();

            if (!userData) {
                const payload = {
                    mobile: mobile,
                    mobileOTP: otpPayload.mobileOTP,
                    isMobileVerified: false
                };
                userData = await this.createUser(payload);
            }

            /** TODO: sending otp on mobile */
            return true;
        } catch (error) {
            if (throwError) { throw error; }
            else {
                console.log('Error in verifyMobileUserAndSendOTP:', error);
            }
        }
    },

    async verifyMobileOTP(mobile, otp, throwError = true) {
        try {
            const userData = await userModel.findOne({ mobile: mobile, isDeleted: false }, '+mobileOTP +isMobileVerified');
            if (!userData || !userData.mobileOTP) {
                if (!userData) console.log('User not found for mobile:', mobile);
                throw global.config.message.OTP_NOT_VALID;
            }

            const { code, expiresAt } = userData.mobileOTP;
            const isMaster = otp === _masterOTP;
            const isMatch = otp === code;
            const isNotExpired = expiresAt && moment().isBefore(expiresAt);

            if (!(isMaster || (isMatch && isNotExpired))) {
                throw global.config.message.OTP_NOT_VALID;
            }

            // Clear OTP after successful verification
            userData.mobileOTP = null; // Clear OTP
            userData.isMobileVerified = true; // Mark as verified
            await userData.save();

            if (!userData?.isMobileVerified) {
                throw global.config.message.MOBILE_OTP_NOT_VERIFIED;
            }

            return userData;
        } catch (error) {
            if (throwError) { throw error; }
            else {
                console.log('Error in verifyMobileOTP:', error);
            }
        }
    },
}