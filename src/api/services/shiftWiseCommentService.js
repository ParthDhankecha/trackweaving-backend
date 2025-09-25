

module.exports = {
    create: async(body) =>{
        const machine = new shiftWiseCommentModel(body);
        return await machine.save();
    },

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

        const query = shiftWiseCommentModel.find({ ...options, isDeleted: false });

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

        const query = shiftWiseCommentModel.findOne({ ...options, isDeleted: false });

        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async findByIdAndUpdate(_id, data) {
        return await shiftWiseCommentModel.findByIdAndUpdate({ _id: _id }, data, { new: true });
    },

    async findByIdAndDelete(_id) {
        return await shiftWiseCommentModel.findByIdAndUpdate({ _id: _id }, { isDeleted: true }, { new: true });
    },

    async countDocuments(filter = {}) {
        return await shiftWiseCommentModel.countDocuments({ ...filter, isDeleted: false });
    },

    async findByIdAndUpdate(_id, data) {
        return await shiftWiseCommentModel.findByIdAndUpdate({ _id: _id }, data, { new: true });
    },

    async updateOne(filter = {}, data) {
        return await shiftWiseCommentModel.findOneAndUpdate({ ...filter, isDeleted: false }, data, { upsert: true });
    }
}
