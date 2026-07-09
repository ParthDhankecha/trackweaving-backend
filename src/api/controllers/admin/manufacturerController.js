const manufacturerService = require('../../services/manufacturerService');
const utilService = require('../../services/utilService');
const { log, checkRequiredParams } = require('../../services/utilService');


module.exports = {

    /** Create a new manufacturer */
    create: async (req, res, next) => {
        try {
            const body = req.body;
            checkRequiredParams(['companyName', 'email', 'password'], body);

            const existing = await manufacturerService.findOne(
                { email: body.email.toLowerCase().trim() },
                { useLean: true, projection: { _id: 1 } }
            );
            if (existing) {
                throw global.config.message.IS_DUPLICATE;
            }

            await manufacturerService.create(body);
            return res.created(null, global.config.message.CREATED);
        } catch (error) {
            log(error);
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

            const [list, totalCount] = await Promise.all([
                manufacturerService.find(queryObj, queryOptions),
                manufacturerService.countDocuments(queryObj)
            ]);

            return res.ok({ list, totalCount }, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    /** Full list for dropdowns */
    getAllList: async (req, res, next) => {
        try {
            const list = await manufacturerService.find({}, { projection: { companyName: 1 }, useLean: true });
            return res.ok(list, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    /** Get by ID (with assigned workspaces) */
    getById: async (req, res, next) => {
        try {
            checkRequiredParams(['id'], req.params);

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
            log(error);
            return res.serverError(error);
        }
    },

    /** Update manufacturer details */
    updateById: async (req, res, next) => {
        try {
            checkRequiredParams(['id'], req.params);
            const body = req.body;

            const manufacturer = await manufacturerService.findOne({ _id: req.params.id });
            if (!manufacturer) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            const updateObj = {};
            if (body.companyName)   updateObj.companyName   = body.companyName;
            if (body.contactPerson !== undefined) updateObj.contactPerson = body.contactPerson;
            if (body.phone !== undefined)         updateObj.phone         = body.phone;
            if (typeof body.isActive === 'boolean') updateObj.isActive   = body.isActive;

            if (Object.keys(updateObj).length === 0) {
                throw global.config.message.BAD_REQUEST;
            }

            const updated = await manufacturerService.findByIdAndUpdate(req.params.id, updateObj, { useLean: true });
            return res.ok(updated, global.config.message.UPDATED);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    /** Soft-delete a manufacturer */
    deleteById: async (req, res, next) => {
        try {
            checkRequiredParams(['id'], req.params);

            const manufacturer = await manufacturerService.findOne({ _id: req.params.id });
            if (!manufacturer) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            await manufacturerService.findByIdAndUpdate(req.params.id, { isDeleted: true });
            return res.ok(null, global.config.message.DELETED);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    /**
     * Assign workspaces to a manufacturer (from the manufacturer update side).
     * Body: { workspaceIds: [...] }  — replaces the current assignment for this manufacturer.
     *
     * Steps:
     *  1. Remove this manufacturerId from all previously-assigned workspaces (and their machines).
     *  2. Set this manufacturerId on the provided workspaces (and cascade to their machines).
     */
    assignWorkspaces: async (req, res, next) => {
        try {
            checkRequiredParams(['id'], req.params);
            const { workspaceIds = [] } = req.body;

            const manufacturer = await manufacturerService.findOne({ _id: req.params.id });
            if (!manufacturer) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            const manufacturerId = manufacturer._id;

            // 1. Clear old assignments (workspaces that had this manufacturer but are not in the new list)
            const previousWorkspaces = await workspaceModel.find(
                { manufacturerId, isDeleted: false },
                { _id: 1 }
            ).lean();
            const previousIds = previousWorkspaces.map(w => w._id);
            const toRemove = previousIds.filter(id => !workspaceIds.map(String).includes(String(id)));

            if (toRemove.length) {
                await workspaceModel.updateMany(
                    { _id: { $in: toRemove } },
                    { $set: { manufacturerId: null } }
                );
                await machineModel.updateMany(
                    { workspaceId: { $in: toRemove } },
                    { $set: { manufacturerId: null } }
                );
            }

            // 2. Set new assignments
            if (workspaceIds.length) {
                await workspaceModel.updateMany(
                    { _id: { $in: workspaceIds }, isDeleted: false },
                    { $set: { manufacturerId } }
                );
                await machineModel.updateMany(
                    { workspaceId: { $in: workspaceIds }, isDeleted: false },
                    { $set: { manufacturerId } }
                );
            }

            return res.ok(null, global.config.message.UPDATED);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    }
};
