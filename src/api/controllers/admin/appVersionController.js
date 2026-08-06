const appVersionService = require("../../services/appVersionService");
const utilService = require("../../services/utilService");


module.exports = {
    get: async (req, res, next) => {
        try {
            const appVersion = await appVersionService.getConfig({ useLean: true });
            if (!appVersion) {
                return res.ok(null, global.config.message.OK);
            }

            const data = appVersionService.toResponse(appVersion);

            return res.ok(data, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    create: async (req, res, next) => {
        try {
            utilService.checkRequiredParams(['android', 'ios'], req.body);

            const appVersion = await appVersionService.create(req.body);
            return res.created(appVersion, global.config.message.CREATED);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    update: async (req, res, next) => {
        try {
            const body = req.body;
            if (Object.keys(body).length === 0) {
                throw global.config.message.BAD_REQUEST;
            }

            if (!body.android && !body.ios) {
                throw global.config.message.BAD_REQUEST;
            }

            const data = await appVersionService.update(body);

            return res.ok(data, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },
};