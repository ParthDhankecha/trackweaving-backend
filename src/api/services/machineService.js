const { Types } = require('mongoose');

module.exports = {
    create: async (body) => {
        const machine = new machineModel(body);
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

        const query = machineModel.find({ ...options, isDeleted: false });

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

        const query = machineModel.findOne({ ...options, isDeleted: false });

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

        const query = machineModel.findOneAndUpdate({ ...queryFilter, isDeleted: false }, updateData, { new: true });
        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async findByIdAndDelete(_id) {
        return await machineModel.findByIdAndUpdate({ _id: _id }, { isDeleted: true }, { new: true });
    },

    async countDocuments(filter = {}) {
        return await machineModel.countDocuments({ ...filter, isDeleted: false });
    },

    async findByIdAndUpdate(_id, data, queryOptions = {}) {
        queryOptions = {
            projection: undefined,
            populate: undefined,
            ...queryOptions
        };

        const query = machineModel.findByIdAndUpdate({ _id: _id }, data, { new: true });

        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);

        return await query;
    },

    async getNextMachineCode(workspaceId) {
        const result = await machineModel.aggregate([
            { $match: { workspaceId: Types.ObjectId(workspaceId) } },
            {
                $addFields: {
                    numericCode: {
                        $toInt: { $substr: ["$machineCode", 1, -1] } // remove "M"
                    }
                }
            },
            { $sort: { numericCode: -1 } },
            { $limit: 1 }
        ]);

        let nextNumber = 1; // default if none exists
        if (result.length) {
            nextNumber = result[0].numericCode + 1;
        }

        return `M${nextNumber}`;
    }
}
