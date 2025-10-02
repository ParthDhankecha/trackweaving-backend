

module.exports = {
    async create(data) {
        const appVersion = new appVersionModel(data);
        return await appVersion.save();
    },

    async find(queryFilter, queryOptions = {}) {
        queryOptions = {
            sort: undefined,
            projection: undefined,
            populate: undefined,
            useLean: false,
            skip: undefined,
            limit: undefined,
            ...queryOptions
        };

        const query = appVersionModel.find({ ...queryFilter, isDeleted: false });
        if (queryOptions.sort) query.sort(queryOptions.sort);
        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);

        if (queryOptions.skip || queryOptions.limit) {
            query.skip(queryOptions.skip).limit(queryOptions.limit);
        }

        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async findOne(queryFilter, queryOptions = {}) {
        queryOptions = {
            sort: undefined,
            projection: undefined,
            populate: undefined,
            useLean: false,
            ...queryOptions
        };

        const query = appVersionModel.findOne({ ...queryFilter, isDeleted: false });
        if (queryOptions.sort) query.sort(queryOptions.sort);
        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async findOneAndUpdate(queryFilter, updateData, queryOptions = {}) {
        queryOptions = {
            projection: undefined,
            populate: undefined,
            useLean: false,
            ...queryOptions
        };
        const query = appVersionModel.findOneAndUpdate({ ...queryFilter, isDeleted: false }, updateData, { new: true });
        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async findByIdAndDelete(id, softDelete = true) {
        const query = softDelete ?
            appVersionModel.findByIdAndUpdate(id, { isDeleted: true }, { new: true }) :
            appVersionModel.findByIdAndDelete(id);

        return await query;
    },

    async countDocuments(queryFilter) {
        return await appVersionModel.countDocuments({ ...queryFilter });
    }
}