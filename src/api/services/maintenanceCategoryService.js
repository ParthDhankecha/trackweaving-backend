module.exports = {
    async find(options = {}, queryOptions = {}){
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

    async findByIdAndDelete(_id) {
        return await maintenanceCategoryModel.findByIdAndUpdate({ _id: _id }, { isDeleted: true }, { new: true });
    },

    async countDocuments(filter = {}) {
        return await maintenanceCategoryModel.countDocuments({ ...filter, isDeleted: false });
    },

    async findByIdAndUpdate(_id, data) {
        return await maintenanceCategoryModel.findByIdAndUpdate({ _id: _id }, data, { new: true });
    },
}
