const manufacturerService = require('../../services/manufacturerService');
const manufacturerUserService = require('../../services/manufacturerUserService');
const utilService = require('../../services/utilService');

const MANUFACTURER_POPULATE = { path: 'manufacturerId', select: 'companyName isActive isDeleted' };


module.exports = {
    /** Create a manufacturer user */
    create: async (req, res, next) => {
        try {
            const body = req.body;
            if (!utilService.isValidObjectId(body.manufacturerId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const createObj = {
                manufacturerId: body.manufacturerId,
                email: body.email?.toLowerCase?.()?.trim?.(),
                password: body.password?.trim?.(),
                contactPerson: body.contactPerson?.trim?.(),
                phone: body.phone?.trim?.(),
                isActive: Boolean(body.isActive)
            };

            utilService.checkRequiredParams(['manufacturerId', 'email', 'password', 'contactPerson', 'isActive'], body);

            const manufacturer = await manufacturerService.findOne(
                { _id: createObj.manufacturerId },
                { useLean: true, projection: { _id: 1 } }
            );
            if (!manufacturer) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            const existing = await manufacturerUserService.findOne(
                { email: createObj.email },
                { useLean: true, projection: { _id: 1 } }
            );
            if (existing) {
                throw global.config.message.IS_DUPLICATE;
            }

            await manufacturerUserService.create(createObj);

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

            if (body.manufacturerId) {
                if (!utilService.isValidObjectId(body.manufacturerId)) {
                    throw global.config.message.BAD_REQUEST;
                }
                queryObj.manufacturerId = body.manufacturerId;
            }
            if (body.hasOwnProperty('isActive') && typeof body.isActive === 'boolean') {
                queryObj.isActive = body.isActive;
            }
            if (body.email) {
                queryObj.email = { $regex: body.email, $options: 'i' };
            }
            if (body.contactPerson) {
                queryObj.contactPerson = { $regex: body.contactPerson, $options: 'i' };
            }

            const pageObj = {
                page: parseInt(body.page) || 1,
                limit: parseInt(body.limit) || 10
            };
            const queryOptions = utilService.getFilter(pageObj);
            queryOptions.sort = { createdAt: -1 };
            queryOptions.useLean = true;
            queryOptions.populate = MANUFACTURER_POPULATE;

            const data = {
                list: [],
                totalCount: await manufacturerUserService.countDocuments(queryObj)
            };
            if (data.totalCount > 0) {
                data.list = await manufacturerUserService.find(queryObj, queryOptions);
            }

            return res.ok(data, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    /** Get by ID */
    getById: async (req, res, next) => {
        try {
            const muId = req.params.id;
            if (!utilService.isValidObjectId(muId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const user = await manufacturerUserService.findOne({ _id: muId }, {
                useLean: true, populate: MANUFACTURER_POPULATE
            });
            if (!user) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            return res.ok(user, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    /** Update manufacturer user */
    updateById: async (req, res, next) => {
        try {
            const muId = req.params.id;
            if (!utilService.isValidObjectId(muId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const body = req.body;
            const updateObj = {};

            if (body.manufacturerId) {
                if (!utilService.isValidObjectId(body.manufacturerId)) {
                    throw global.config.message.BAD_REQUEST;
                }
                const manufacturer = await manufacturerService.findOne(
                    { _id: body.manufacturerId },
                    { useLean: true, projection: { _id: 1 } }
                );
                if (!manufacturer) {
                    throw global.config.message.RECORD_NOT_FOUND;
                }
                updateObj.manufacturerId = body.manufacturerId;
            }

            if (typeof body.email === 'string' && body.email.trim() !== '') {
                updateObj.email = body.email.toLowerCase().trim();
            }
            if (typeof body.contactPerson === 'string' && body.contactPerson.trim() !== '') {
                updateObj.contactPerson = body.contactPerson.trim();
            }
            if (typeof body.phone === 'string') {
                updateObj.phone = body.phone.trim();
            }
            if (typeof body.isActive === 'boolean') {
                updateObj.isActive = body.isActive;
            }
            if (body.password) {
                updateObj.password = body.password;
            }

            if (Object.keys(updateObj).length === 0) {
                throw global.config.message.BAD_REQUEST;
            }

            if (updateObj.email) {
                const existing = await manufacturerUserService.findOne({ email: updateObj.email, _id: { $ne: muId } }, {
                    useLean: true,
                    projection: { _id: 1 },
                });
                if (existing) {
                    throw global.config.message.IS_DUPLICATE;
                }
            }

            const updated = await manufacturerUserService.findByIdAndUpdate(muId, updateObj, {
                useLean: true,
                populate: MANUFACTURER_POPULATE
            });
            if (!updated) {
                throw global.config.message.NOT_UPDATED;
            }

            return res.ok(updated, global.config.message.UPDATED);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    /** Soft-delete a manufacturer user */
    deleteById: async (req, res, next) => {
        try {
            const userId = req.params.id;
            if (!utilService.isValidObjectId(userId)) {
                throw global.config.message.BAD_REQUEST;
            }

            const user = await manufacturerUserService.findByIdAndUpdate(userId, { isDeleted: true }, {
                useLean: true,
                projection: { _id: 1 }
            });
            if (!user) {
                throw global.config.message.NOT_DELETED;
            }

            return res.ok(null, global.config.message.DELETED);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    }
};