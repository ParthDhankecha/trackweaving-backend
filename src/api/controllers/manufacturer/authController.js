const manufacturerUserService = require('../../services/manufacturerUserService');
const jwtService = require('../../services/jwtService');
const utilService = require('../../services/utilService');


module.exports = {
    signIn: async (req, res, next) => {
        try {
            utilService.checkRequiredParams(['email', 'password'], req.body);

            const { email, password } = req.body;
            const user = await manufacturerUserService.login(email, password);

            if (!user) {
                throw global.config.message.INVALID_CREDENTIALS;
            }

            const manufacturer = user.manufacturerId;
            const token = jwtService.createManufacturerToken({ manufacturer, user });

            const payload = {
                token,
                mfrUser: {
                    _id: user._id,
                    manufacturerId: manufacturer._id,
                    email: user.email,
                    contactPerson: user.contactPerson,
                }
            };

            return res.ok(payload, global.config.message.LOGIN);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    getProfile: async (req, res, next) => {
        try {
            const userId = req.mfrUser?.id;
            if (!utilService.isValidObjectId(userId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const mfrUser = await manufacturerUserService.findOne(
                { _id: userId },
                { projection: 'manufacturerId email contactPerson phone isActive', useLean: true }
            );
            if (!mfrUser) throw global.config.message.RECORD_NOT_FOUND;

            return res.ok({ mfrUser }, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    }
};