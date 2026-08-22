const appVersionService = require("../../services/appVersionService");
const utilService = require("../../services/utilService");


function requireFlavorsBody(body = {}) {
    if (!body.flavors || Array.isArray(body.flavors) || typeof body.flavors !== 'object') {
        throw global.config.message.BAD_REQUEST;
    }
    return body.flavors;
}


module.exports = {
    get: async (req, res, next) => {
        try {
            const appVersion = await appVersionService.getConfig({ useLean: true });
            const data = appVersionService.toResponse(appVersion);

            return res.ok(data, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    update: async (req, res, next) => {
        try {
            const flavors = requireFlavorsBody(req.body);

            const data = await appVersionService.updateFlavors(flavors);

            return res.ok(data, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    addHistory: async (req, res, next) => {
        try {
            utilService.checkRequiredParams(['build', 'version'], req.body);

            const data = await appVersionService.addHistory(req.body);

            return res.created(data, global.config.message.CREATED);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    updateHistory: async (req, res, next) => {
        try {
            const { id } = req.params;
            if (!utilService.isValidObjectId(id)) {
                throw global.config.message.BAD_REQUEST;
            }
            if (Object.keys(req.body || {}).length === 0) {
                throw global.config.message.BAD_REQUEST;
            }

            const data = await appVersionService.updateHistory(id, req.body);
            return res.ok(data, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    deleteHistory: async (req, res, next) => {
        try {
            const { id } = req.params;
            if (!utilService.isValidObjectId(id)) {
                throw global.config.message.BAD_REQUEST;
            }

            const data = await appVersionService.deleteHistory(id);

            return res.ok(data, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    }
};