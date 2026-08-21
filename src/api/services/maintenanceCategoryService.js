module.exports = {
    async create(body) {
        const category = new maintenanceCategoryModel(body);
        return await category.save();
    },

    async find(options = {}, queryOptions = {}) {
        queryOptions = {
            sort: undefined,
            skip: undefined,
            limit: undefined,
            projection: undefined,
            populate: undefined,
            useLean: false,
            ...queryOptions
        };

        const query = maintenanceCategoryModel.find({ ...options, isDeleted: false });

        if (queryOptions.sort) query.sort(queryOptions.sort);
        if (queryOptions.skip) query.skip(queryOptions.skip);
        if (queryOptions.limit) query.limit(queryOptions.limit);
        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async findOne(options = {}, queryOptions = {}) {
        queryOptions = {
            projection: undefined,
            populate: undefined,
            useLean: false,
            ...queryOptions
        };

        const query = maintenanceCategoryModel.findOne({ ...options, isDeleted: false });

        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async findByIdAndUpdate(_id, data) {
        return await maintenanceCategoryModel.findByIdAndUpdate({ _id: _id }, data, { new: true });
    },

    async findOneAndUpdate(options = {}, data, queryOptions = {}) {
        queryOptions = {
            new: true,
            projection: undefined,
            populate: undefined,
            useLean: false,
            ...queryOptions
        };

        const query = maintenanceCategoryModel.findOneAndUpdate(options, data, { new: queryOptions.new });

        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async findOneAndDelete(options = {}, queryOptions = {}) {
        queryOptions = {
            projection: undefined,
            populate: undefined,
            useLean: false,
            ...queryOptions
        };

        const query = maintenanceCategoryModel.findOneAndUpdate(options, { isDeleted: true }, { new: true });

        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async countDocuments(filter = {}) {
        return await maintenanceCategoryModel.countDocuments({ ...filter, isDeleted: false });
    },


    async bootstrapMaintenanceData(workspaceId, category) {
        const machines = await machineModel.distinct('_id', { workspaceId, isDeleted: false });
        if (!machines?.length) return;

        const now = new Date();
        const scheduleDays = Number(category.scheduleDays) || 0;
        const nextMaintenanceDate = new Date(now);
        nextMaintenanceDate.setDate(nextMaintenanceDate.getDate() + scheduleDays);

        const records = machines.map(mId => ({
            maintenanceCategoryId: category._id,
            workspaceId,
            machineId: mId,
            lastMaintenanceDate: now,
            nextMaintenanceDate,
            remarks: ''
        }));

        await maintenanceDataModel.insertMany(records);
    },
};