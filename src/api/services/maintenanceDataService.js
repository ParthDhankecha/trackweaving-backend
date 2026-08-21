module.exports = {
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

        const query = maintenanceDataModel.find({ ...options, isDeleted: false });

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

        const query = maintenanceDataModel.findOne({ ...options, isDeleted: false });

        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async findByIdAndUpdate(_id, data) {
        return await maintenanceDataModel.findByIdAndUpdate({ _id: _id }, data, { new: true });
    },

    async findByIdAndDelete(_id) {
        return await maintenanceDataModel.findByIdAndUpdate({ _id: _id }, { isDeleted: true }, { new: true });
    },

    async findOneAndDelete(options = {}, queryOptions = {}) {
        queryOptions = {
            projection: undefined,
            populate: undefined,
            useLean: false,
            ...queryOptions
        };
        
        const query = maintenanceDataModel.findOneAndUpdate(options, { isDeleted: true }, { new: true });

        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async deleteReferences(workspaceId, maintenanceCategoryId) {
        return await maintenanceDataModel.deleteMany({ workspaceId, maintenanceCategoryId });
    },

    async countDocuments(filter = {}) {
        return await maintenanceDataModel.countDocuments({ ...filter, isDeleted: false });
    },
}
