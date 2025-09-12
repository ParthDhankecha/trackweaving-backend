const adminUserService = require('../../services/adminUserService');
const authService = require('../../services/authService');
const jwtService = require('../../services/jwtService');
const { log, checkRequiredParams } = require('../../services/utilService');


module.exports = {
    async signIn(req, res, next) {
        try {
            checkRequiredParams(['data', 'date'], req.body);
            const reqBody = await authService.decryptData(req.body);
            checkRequiredParams(['email', 'password'], reqBody);

            const userData = await adminUserService.login(reqBody.email, reqBody.password);
            if (!userData) {
                throw global.config.message.INVALID_CREDENTIALS;
            }

            const token = jwtService.createToken(userData);
            const payload = {
                token: token,
                user: {
                    _id: userData._id,
                    type: userData.userType,
                    email: userData.email
                }
            };

            return res.ok(payload, global.config.message.LOGIN);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    }
}