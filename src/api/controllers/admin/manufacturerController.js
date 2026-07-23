const manufacturerService = require('../../services/manufacturerService');
const workspaceService = require('../../services/workspaceService');
const utilService = require('../../services/utilService');


module.exports = {
    /** Create a new manufacturer */
    create: async (req, res, next) => {
        try {
            const body = req.body;
            body.companyName = body.companyName?.toLowerCase?.()?.trim?.();
            utilService.checkRequiredParams(['companyName'], body);

            const existing = await manufacturerService.findOne(
                { companyName: { $regex: `^${body.companyName}$`, $options: 'i' } },
                { useLean: true, projection: { _id: 1 } }
            );
            if (existing) {
                throw global.config.message.IS_DUPLICATE;
            }

            await manufacturerService.create(body);
            return res.created(null, global.config.message.CREATED);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    /** Paginated list */
    getList: async (req, res, next) => {
        try {
            const body = req.body || {};
            const queryObj = {};

            if (body.hasOwnProperty('isActive') && typeof body.isActive === 'boolean') {
                queryObj.isActive = body.isActive;
            }
            if (body.companyName) {
                queryObj.companyName = { $regex: body.companyName, $options: 'i' };
            }

            const pageObj = {
                page: parseInt(body.page) || 1,
                limit: parseInt(body.limit) || 10
            };
            const queryOptions = utilService.getFilter(pageObj);
            queryOptions.sort = { createdAt: -1 };
            queryOptions.useLean = true;

            const data = {
                list: [],
                totalCount: await manufacturerService.countDocuments(queryObj)
            };
            if (data.totalCount > 0) {
                data.list = await manufacturerService.find(queryObj, queryOptions);
            }

            return res.ok(data, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    /** Full list for dropdowns */
    getAllList: async (req, res, next) => {
        try {
            const list = await manufacturerService.find({}, { projection: { companyName: 1 }, useLean: true });
            return res.ok(list, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    /** Get by ID (with assigned workspaces) */
    getById: async (req, res, next) => {
        try {
            utilService.checkRequiredParams(['id'], req.params);

            const manufacturer = await manufacturerService.findOne(
                { _id: req.params.id },
                { useLean: true }
            );
            if (!manufacturer) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            const workspaces = await workspaceModel.find(
                { manufacturerId: manufacturer._id, isDeleted: false },
                { firmName: 1, isActive: 1 }
            ).lean();

            return res.ok({ ...manufacturer, workspaces }, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    /** Update manufacturer details */
    updateById: async (req, res, next) => {
        try {
            const manufacturerId = req.params.id;
            if (!utilService.isValidObjectId(manufacturerId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const updateObj = {}, body = req.body;
            if (typeof body.companyName === 'string' && body.companyName.trim() !== '') {
                updateObj.companyName = body.companyName.toLowerCase().trim();
            }

            const query = { _id: manufacturerId };
            if (updateObj.companyName) {
                delete query._id;
                query.$or = [
                    {
                        companyName: { $regex: `^${updateObj.companyName}$`, $options: 'i' },
                        _id: { $ne: manufacturerId }
                    },
                    { _id: manufacturerId }
                ];
            }
            const manufacturer = await manufacturerService.findOne(query, { useLean: true });
            if (!manufacturer) {
                throw global.config.message.RECORD_NOT_FOUND;
            }
            if (String(manufacturer._id) !== manufacturerId) {
                throw global.config.message.IS_DUPLICATE;
            }

            if (typeof body.isActive === 'boolean') updateObj.isActive = body.isActive;

            if (Object.keys(updateObj).length === 0) {
                throw global.config.message.BAD_REQUEST;
            }

            const updated = await manufacturerService.findByIdAndUpdate(manufacturerId, updateObj, { useLean: true });

            return res.ok(updated, global.config.message.UPDATED);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    /** Soft-delete a manufacturer */
    deleteById: async (req, res, next) => {
        try {
            const manufacturerId = req.params.id;
            if (!utilService.isValidObjectId(manufacturerId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const workspace = await workspaceService.findOne({ manufacturerId: manufacturerId }, {
                projection: { _id: 1 },
                useLean: true
            });
            if (workspace) {
                throw global.config.message.RESOURCE_HAS_ASSOCIATIONS;
            }

            const manufacturer = await manufacturerService.findByIdAndUpdate(manufacturerId, { isDeleted: true }, { useLean: true });
            if (!manufacturer) {
                throw global.config.message.NOT_DELETED;
            }

            return res.ok(null, global.config.message.DELETED);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },
};