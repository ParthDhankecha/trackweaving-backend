const authService = require('../../services/authService');
const usersService = require('../../services/usersService');
const { log, checkRequiredParams } = require('../../services/utilService');


module.exports = {

    getList: async (req, res, next) => {
        try {
            const users = await usersService.find({});

            return res.ok(users, global.config.message.OK);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    },

    getById: async (req, res, next) => {
        try {
            checkRequiredParams(['id'], req.params);

            const users = await usersService.findById(req.params.id, { password: false, verification: false, isDeleted: false });

            return res.ok(users, global.config.message.OK);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    },

    update: async (req, res, next) => {
        try {
            checkRequiredParams(['email'], req.body);
            checkRequiredParams(['id'], req.params);
            const body = req.body;
            const id = req.params.id;

            const user = await usersService.findOne({ _id: { $ne: id }, 'email': body.email });
            if (user) {
                return res.badRequest(null, global.config.message.EMAIL_ALREADY_REGISTERED);
            }

            if (body.password) body.password = await authService.generateHashValue(body.password);

            const result = await usersService.findByIdAndUpdate(id, body);
            if (!result) {
                throw global.config.message.USER_NOT_UPDATED;
            }

            return res.ok(null, global.config.message.OK);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    },

    delete: async (req, res, next) => {
        try {
            const params = req.params;
            const paramsToRequired = ['id'];
            checkRequiredParams(paramsToRequired, params);

            const result = await usersService.findByIdAndDelete(params.id);
            if (!result) {
                throw global.config.message.USER_NOT_DELETED;
            }

            return res.ok(null, global.config.message.OK);
        } catch (error) {
            log(error);

            return res.serverError(error);
        }
    },

}