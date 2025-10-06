

module.exports = {
    create: async (body) => {
        const machine = new partChangeLogModel(body);
        return await machine.save();
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

        const query = partChangeLogModel.find({ ...options, isDeleted: false });

        if (queryOptions.sort) query.sort(queryOptions.sort);
        if (queryOptions.skip) query.skip(queryOptions.skip);
        if (queryOptions.limit) query.limit(queryOptions.limit);
        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async getPartNamesList(workspaceId) {
        const parts = await partChangeLogModel.find({ workspaceId, isDeleted: false }).distinct('name');

        let list = [
            'LH Belt',
            'RH Belt',
            'LH Drive Wheel',
            'RH Drive Wheel',
            'LH Gripper',
            'RH Gripper'
        ];
        let partsSet = new Set(list);
        parts.map(part => partsSet.add(part.name));
        
        return Array.from(partsSet);
    },

    async findOne(options = {}, queryOptions = {}) {
        queryOptions = {
            projection: undefined,
            populate: undefined,
            useLean: false,
            ...queryOptions
        };

        const query = partChangeLogModel.findOne({ ...options, isDeleted: false });

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

        const query = partChangeLogModel.findOneAndUpdate({ ...queryFilter, isDeleted: false }, updateData, { new: true });
        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async findByIdAndDelete(_id) {
        return await partChangeLogModel.findByIdAndUpdate({ _id: _id }, { isDeleted: true }, { new: true });
    },

    async countDocuments(filter = {}) {
        return await partChangeLogModel.countDocuments({ ...filter, isDeleted: false });
    },

    async findByIdAndUpdate(_id, data) {
        return await partChangeLogModel.findByIdAndUpdate({ _id: _id }, data, { new: true });
    },
}
