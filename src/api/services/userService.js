const moment = require('moment');
const utilService = require('./utilService');


// 2-no limit characters, start with a letter, and contain only letters, numbers, and underscores
const _userNameRegex = /^[a-zA-Z][a-zA-Z0-9_]+$/;

module.exports = {
    async findById(id, projection = {}) {
        projection = {
            createdAt: false,
            updatedAt: false,
            ...projection
        };

        return await userModel.findById({ _id: id }, projection).lean();
    },

    async findOne(options) {
        const projection = {
            createdAt: false,
            updatedAt: false
        };

        return await userModel.findOne({ isDeleted: false, ...options }, projection).lean();
    },

    /** 
     * @param {Object} queryFilter - The criteria to find the matching document(s).
     * @param {Object} queryOptions - Optional settings for the query execution.
     * @param {Object} queryOptions.sort - Sorting options for the result.
     * @param {Object} queryOptions.projection - Fields to include or exclude in the result.
     * @param {Object} queryOptions.populate - Populate options for related documents.
     * @param {boolean} queryOptions.useLean - If true, returns plain JavaScript objects instead of Mongoose documents.
     * @returns {Promise<Object>} - Returns a single document matching the query filter, or null if no match is found.
     */
    async findOneV2(queryFilter, queryOptions = {}) {
        queryOptions = {
            sort: undefined,
            projection: undefined,
            populate: undefined,
            useLean: false,
            ...queryOptions
        };
        if (queryFilter.email && typeof queryFilter.email === 'string') {
            queryFilter.email = { $regex: `^${queryFilter.email}$`, $options: 'i' };
        }

        const query = userModel.findOne({ ...queryFilter, isDeleted: false });

        if (queryOptions.sort) query.sort(queryOptions.sort);
        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async find(options = {}) {
        const projection = {
            createdAt: false,
            updatedAt: false
        };

        return await userModel.find({ isDeleted: false, ...options }, projection).lean();
    },

    /**
     * Finds multiple user documents based on the provided options and query options.
     * @param {Object} options - The criteria to find the matching documents.
     * @param {Object} queryOptions - Optional settings for the query execution.
     * @param {Object} queryOptions.sort - Sorting options for the result.
     * @param {number} queryOptions.skip - Number of documents to skip.
     * @param {number} queryOptions.limit - Maximum number of documents to return.
     * @param {Object} queryOptions.projection - Fields to include or exclude in the result.
     * @param {Object} queryOptions.populate - Populate options for related documents.
     * @param {boolean} queryOptions.useLean - If true, returns plain JavaScript objects instead of Mongoose documents.
     * @return {Promise<Array>} - Returns an array of user documents matching the criteria.
     */
    async findV2(options = {}, queryOptions = {}) {
        queryOptions = {
            sort: undefined,
            skip: undefined,
            limit: undefined,
            projection: undefined,
            populate: undefined,
            useLean: false,
            ...queryOptions
        };

        if (options.email && typeof options.email === 'string') {
            options.email = { $regex: `^${options.email}$`, $options: 'i' };
        }

        const query = userModel.find({ ...options, isDeleted: false });

        if (queryOptions.sort) query.sort(queryOptions.sort);
        if (queryOptions.skip) query.skip(queryOptions.skip);
        if (queryOptions.limit) query.limit(queryOptions.limit);
        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async findByIdAndUpdate(_id, data, queryOptions = {}) {
        queryOptions = {
            projection: undefined,
            populate: undefined,
            useLean: false,
            ...queryOptions
        };

        if (data.password) {
            data.password = await utilService.generateHashValue(data.password);
        }

        // Use $set so Mixed fields like `access` always replace the stored object
        const query = userModel.findByIdAndUpdate(
            { _id: _id },
            { $set: data },
            { new: true, runValidators: true }
        );

        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async findByIdAndDelete(_id) {
        return await userModel.findByIdAndUpdate({ _id: _id }, { isDeleted: true }, { new: true });
    },

    async getUserWithPagination(options = {}, queryOptions = {}) {
        queryOptions = {
            sort: { createdAt: -1 },
            skip: 0,
            limit: 10,
            projection: undefined,
            populate: undefined,
            useLean: true,
            ...queryOptions
        };

        const query = userModel.find({ ...options, isDeleted: false });

        if (queryOptions.sort) query.sort(queryOptions.sort);
        if (queryOptions.skip) query.skip(queryOptions.skip);
        if (queryOptions.limit) query.limit(queryOptions.limit);
        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        const users = await query;
        const totalCount = await userModel.countDocuments({ ...options, isDeleted: false });

        const result = {
            list: users,
            totalCount
        };

        return result;
    },

    async updateOne(queryFilter, updateData) {
        return await userModel.updateOne({ ...queryFilter, isDeleted: false }, updateData);
    },

    async updateMany(filter = {}, updatesObj = {}) {
        return await userModel.updateMany({
            ...filter,
            isDeleted: false
        }, updatesObj);
    },

    async create(data) {
        if (data.password) {
            data.password = await utilService.generateHashValue(data.password);
        }

        const user = new userModel(data);
        return await user.save();
    },

    async count(filter = {}) {
        return await userModel.countDocuments({ ...filter, isDeleted: false });
    },


    async getUserPlan(workspaceId, validatePlanAndThrowError = false) {
        const workspace = await workspaceModel.findById({ _id: workspaceId, isDeleted: false }, { userId: 1 }).populate('userId', 'plan').lean();
        if (validatePlanAndThrowError) {
            const plan = workspace?.userId?.plan ?? {};
            if (!plan?.endDate) {
                throw global.config.message.PLAN_NOT_FOUND;
            }
            const planExpired = moment(plan.endDate).endOf('day').isBefore(moment());
            if (planExpired) {
                throw global.config.message.PLAN_EXPIRED;
            }
            if (!utilService.isNumber(plan.subUserLimit, { min: 0 })) {
                throw global.config.message.INVALID_USER_LIMIT;
            }
            const userCount = await this.count({ workspaceId });
            if (userCount >= (plan.subUserLimit ?? 4)) {
                throw global.config.message.USER_LIMIT_EXCEEDED;
            }
        }
        return workspace?.userId?.plan ?? null;
    },

    async validatePlanForSignIn(workspaceId) {
        if (!workspaceId) return null;

        const workspace = await workspaceModel.findById({ _id: workspaceId, isDeleted: false }, { userId: 1, uid: 1, isActive: 1 }).populate('userId', 'plan isActive').lean();
        if (!workspace?.isActive || !workspace?.userId?.isActive) {
            throw global.config.message.INACTIVE_ACCOUNT;
        }
        const plan = workspace?.userId?.plan ?? {};
        if (!plan?.endDate) {
            throw global.config.message.PLAN_NOT_FOUND;
        }
        const planExpired = moment(plan.endDate).endOf('day').isBefore(moment());
        if (planExpired) {
            throw global.config.message.PLAN_EXPIRED;
        }
        return workspace;
    },

    /**
     * Request-time access check for admin/master tokens:
     * - Admin: self active → workspace active → plan valid
     * - Master: self active → workspace admin active → workspace active → plan valid
     */
    async validateUserSessionAccess(data = {}) {
        const { id, workspaceId } = data;
        if (!id || !workspaceId) {
            throw global.config.message.UNAUTHORIZED;
        }

        const user = await userModel.findOne(
            { _id: id, isDeleted: false },
            { isActive: 1, userType: 1, workspaceId: 1, access: 1 }
        ).lean();
        if (!user?.isActive) {
            throw global.config.message.INACTIVE_ACCOUNT;
        }

        const workspace = await workspaceModel.findById(
            { _id: workspaceId, isDeleted: false },
            { userId: 1, uid: 1, isActive: 1 }
        ).populate('userId', 'plan isActive').lean();

        if (!workspace?.isActive) {
            throw global.config.message.INACTIVE_ACCOUNT;
        }

        const admin = workspace.userId;
        if (!admin?.isActive) {
            throw global.config.message.INACTIVE_ACCOUNT;
        }

        // Check if the user is the owner of the workspace, if not then it is a sub-admin or master.
        data.isOwner = String(admin._id) === String(user._id);

        let hasAccess = false;
        switch (user.userType) {
            case global.config.USERS.TYPE.MASTER: {
                if (!user?.access) throw global.config.message.ACCESS_DENIED;
                data.access = user.access;

                hasAccess = String(user.workspaceId) === String(workspaceId);
                break;
            }
            case global.config.USERS.TYPE.ADMIN: {
                hasAccess = String(user.workspaceId) === String(workspaceId);
                break;
            }
        }
        if (!hasAccess) throw global.config.message.UNAUTHORIZED;

        const plan = admin.plan ?? {};
        if (!plan?.endDate) {
            throw global.config.message.PLAN_NOT_FOUND;
        }
        const planExpired = moment(plan.endDate).endOf('day').isBefore(moment());
        if (planExpired) {
            throw global.config.message.PLAN_EXPIRED;
        }
    },

    validateShift(shifts) {
        if (!Array.isArray(shifts) || shifts.length === 0) {
            throw global.config.message.INVALID_SHIFT;
        }

        const SHIFT_TYPE = Object.values(global.config.SHIFT_TYPE ?? {});
        if (shifts.some(shift => typeof shift !== 'number' || !SHIFT_TYPE.includes(shift))) {
            throw global.config.message.INVALID_SHIFT;
        }
        return shifts;
    },

    /**
     * Validates the user name.
     * @param {string} userName - The user name to validate.
     * @returns { { normalized: string, escaped: string } } The object containing the normalized and escaped strings.
     * @throws {Error} If the user name is not a valid string and throwError is true.
     */
    validateUserName(userName) {
        const obj = utilService.escapeRegex(userName, { throwError: true });
        if (!obj?.normalized) {
            throw global.config.message.BAD_REQUEST;
        }
        if (obj.normalized.length < 6) {
            throw global.config.message.INVALID_USER_NAME;
        }

        return { normalized: obj.normalized, escaped: obj.escaped };
    }
}