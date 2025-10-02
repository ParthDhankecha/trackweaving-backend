const appVersionService = require("../../services/appVersionService");
const { checkRequiredParams, log } = require("../../services/utilService");


module.exports = {
    list: async (req, res, next) => {
        try {
            const body = req.body;

            let appVersions = [];
            if (body?.type) {
                appVersions = await appVersionService.find({ appType: body.type.trim().toLowerCase() }, { sort: { createdAt: -1 } });
            }

            return res.ok(appVersions, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    getById: async (req, res, next) => {
        try {
            const appVersion = await appVersionService.findOne({ _id: req.params.id });
            if (!appVersion) {
                throw global.config.message.RECORD_NOT_FOUND;
            }
            return res.ok(appVersion, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    create: async (req, res, next) => {
        try {
            checkRequiredParams(['appType', 'version'], req.body);
            const body = req.body;
            
            if (!['ios', 'android'].includes(body.appType)) {
                throw global.config.message.INVALID_APP_TYPE;
            }

            const isExist = await appVersionService.findOne({ appType: body.appType, version: body.version }, { useLean: true });
            if (isExist) {
                throw global.config.message.APP_VERSION_ALREADY_EXIST;
            }

            const appVersion = await appVersionService.create(body);

            return res.created(appVersion, global.config.message.CREATED);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    update: async (req, res, next) => {
        try {
            checkRequiredParams(['id'], req.params);

            if (Object.keys(req.body).length === 0) {
                throw global.config.message.BAD_REQUEST;
            }
            const body = req.body;

            const appVersion = await appVersionService.findOne({ _id: req.params.id });
            if (!appVersion) {
                throw global.config.message.RECORD_NOT_FOUND;
            }
            const updateData = {};

            if (body?.appType && body?.version) {
                const isExistQuery = {
                    _id: { $ne: req.params.id },
                };

                if (body?.appType) {
                    if (!['ios', 'android'].includes(body.appType)) {
                        throw global.config.message.INVALID_APP_TYPE;
                    }
                    isExistQuery.appType = body.appType;
                }
                if (body?.version) {
                    isExistQuery.version = body.version;
                }

                const isExist = await appVersionService.findOne(isExistQuery, { useLean: true });
                if (isExist) {
                    throw global.config.message.APP_VERSION_ALREADY_EXIST;
                }
                updateData.version = body.version;
                updateData.appType = body.appType;
            }
            if (body.hasOwnProperty('showPopup')) {
                updateData.showPopup = body.showPopup;
            }
            if (body.hasOwnProperty('hardUpdate')) {
                updateData.hardUpdate = body.hardUpdate;
            }

            if (Object.keys(updateData).length === 0) {
                throw global.config.message.BAD_REQUEST;
            }

            const updatedAppVersion = await appVersionService.findOneAndUpdate({ _id: req.params.id }, updateData);

            return res.ok(updatedAppVersion, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    delete: async (req, res, next) => {
        try {
            checkRequiredParams(['id'], req.params);

            const appVersion = await appVersionService.findOne({ _id: req.params.id });
            if (!appVersion) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            await appVersionService.findByIdAndDelete(req.params.id);

            return res.ok(null, global.config.message.DELETED);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    }
}