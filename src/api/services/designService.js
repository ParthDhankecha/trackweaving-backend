

module.exports = {
    async create(data) {
        const design = new designModel(data);
        return await design.save();
    },
    async find(queryFilter, queryOptions = {}) {
        queryOptions = {
            sort: undefined,
            projection: undefined,
            populate: undefined,
            useLean: false,
            page: undefined,
            limit: undefined,
            ...queryOptions
        };

        const query = designModel.find({ ...queryFilter, isDeleted: false });
        if (queryOptions.sort) query = query.sort(queryOptions.sort);
        if (queryOptions.projection) query = query.select(queryOptions.projection);
        if (queryOptions.populate) query = query.populate(queryOptions.populate);

        if (queryOptions.page || queryOptions.limit) {
            query = query.skip(skip).limit(queryOptions.limit);
        }

        if (queryOptions.useLean) query = query.lean();

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

        const query = designModel.findOne({ ...queryFilter, isDeleted: false });
        if (queryOptions.sort) query = query.sort(queryOptions.sort);
        if (queryOptions.projection) query = query.select(queryOptions.projection);
        if (queryOptions.populate) query = query.populate(queryOptions.populate);
        if (queryOptions.useLean) query = query.lean();

        return await query;
    },
    async findById(id, projection = {}) {
        projection = {
            createdAt: false,
            updatedAt: false,
            ...projection
        };

        return await designModel.findById({ _id: id, isDeleted: false }, projection).lean();
    },
    async findOneAndUpdate(queryFilter, updateData, queryOptions = {}) {
        queryOptions = {
            projection: undefined,
            populate: undefined,
            useLean: false,
            ...queryOptions
        };

        const query = designModel.findOneAndUpdate({ ...queryFilter, isDeleted: false }, updateData, { new: true });
        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },
    async findByIdAndDelete(id, queryOptions = {}) {
        queryOptions = {
            projection: undefined,
            populate: undefined,
            useLean: false,
            softDelete: true,
            ...queryOptions
        };

        let query = designModel.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
        if (!queryOptions.softDelete) {
            query = designModel.findByIdAndDelete(id);
        } else {
            if (queryOptions.projection) query.select(queryOptions.projection);
            if (queryOptions.populate) query.populate(queryOptions.populate);
            if (queryOptions.useLean) query.lean();
        }

        return await query;
    },
    async countDocuments(queryFilter) {
        return await designModel.countDocuments({ ...queryFilter, isDeleted: false });
    }
}