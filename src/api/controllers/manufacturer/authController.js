const manufacturerService = require('../../services/manufacturerService');
const jwtService = require('../../services/jwtService');
const { log, checkRequiredParams } = require('../../services/utilService');


module.exports = {

    signIn: async (req, res, next) => {
        try {
            checkRequiredParams(['email', 'password'], req.body);

            const { email, password } = req.body;
            const manufacturer = await manufacturerService.login(email, password);

            if (!manufacturer) {
                throw global.config.message.INVALID_CREDENTIALS;
            }

            const token = jwtService.createManufacturerToken(manufacturer);

            const payload = {
                token,
                manufacturer: {
                    _id:         manufacturer._id,
                    companyName: manufacturer.companyName,
                    email:       manufacturer.email,
                    contactPerson: manufacturer.contactPerson,
                    phone:       manufacturer.phone
                }
            };

            return res.ok(payload, global.config.message.LOGIN);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    getProfile: async (req, res, next) => {
        try {
            const manufacturer = await manufacturerService.findOne(
                { _id: req.manufacturer.id },
                { useLean: true }
            );
            if (!manufacturer) throw global.config.message.RECORD_NOT_FOUND;

            return res.ok(manufacturer, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    }
};
